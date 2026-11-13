"""Writes lab achievements (progress and attempt history) to Supabase.

Uses the PostgREST API with the service role key, which bypasses row level
security: these rows are written only after the *server* has verified the flag
or the fix, never on the client's word.

Every failure is logged and swallowed: the lab engine must keep working when
Supabase is unreachable or not configured at all.
"""
from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import quote

import httpx

from app.config import get_settings

log = logging.getLogger("lab.supabase")
TIMEOUT = httpx.Timeout(5.0, connect=3.0)


def configured() -> bool:
    s = get_settings()
    return bool(s.supabase_url and s.supabase_service_key)


async def health() -> dict[str, Any]:
    """Probe the database dependency for the health endpoint.

    This is a real request to PostgREST (one row, one column), not a cached or
    fabricated status. ``not_configured`` is distinct from a failed connection:
    local mode intentionally runs without Supabase.
    """
    if not configured():
        return {"status": "not_configured", "configured": False}
    s = get_settings()
    headers = {"apikey": s.supabase_service_key, "Authorization": f"Bearer {s.supabase_service_key}"}
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"{s.supabase_url}/rest/v1/profiles?select=id&limit=1", headers=headers)
    except httpx.HTTPError as exc:
        log.warning("Supabase health check could not connect: %s", exc.__class__.__name__)
        return {
            "status": "unavailable",
            "configured": True,
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            "error": exc.__class__.__name__,
        }
    latency_ms = round((time.perf_counter() - started) * 1000, 1)
    if resp.status_code >= 400:
        log.warning("Supabase health check returned %s", resp.status_code)
        return {"status": "error", "configured": True, "http_status": resp.status_code, "latency_ms": latency_ms}
    return {"status": "ok", "configured": True, "latency_ms": latency_ms}


async def _post(path: str, payload: Any, prefer: str | None = None) -> bool:
    if not configured():
        return False
    s = get_settings()
    headers = {
        "apikey": s.supabase_service_key,
        "Authorization": f"Bearer {s.supabase_service_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(f"{s.supabase_url}/rest/v1/{path}", json=payload, headers=headers)
        if resp.status_code >= 400:
            log.warning("Supabase write to %s failed with %s: %s", path, resp.status_code, resp.text[:300])
            return False
        return True
    except httpx.HTTPError as exc:
        log.warning("Supabase unreachable while writing to %s: %s", path, exc.__class__.__name__)
        return False


async def record_attempt(user_id: str, module_id: str, kind: str, *, correct: bool, detail: str | None = None) -> bool:
    """Append one row to the attempts audit table."""
    body = {"user_id": user_id, "module_id": module_id, "kind": kind, "correct": correct, "detail": detail}
    return await _post("attempts", body)


async def upsert_progress(user_id: str, module_id: str, **flags: bool) -> bool:
    """Merge one progress row. Only the supplied columns are updated."""
    body = {
        "user_id": user_id,
        "module_id": module_id,
        **flags,
        "updated_at": datetime.now(UTC).isoformat(),
    }
    return await _post("progress?on_conflict=user_id,module_id", body, prefer="resolution=merge-duplicates")


async def _get(path: str) -> Any | None:
    """Read rows with the service role key. None on any failure."""
    if not configured():
        return None
    s = get_settings()
    headers = {"apikey": s.supabase_service_key, "Authorization": f"Bearer {s.supabase_service_key}"}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"{s.supabase_url}/rest/v1/{path}", headers=headers)
        if resp.status_code >= 400:
            log.warning("Supabase read from %s failed with %s", path, resp.status_code)
            return None
        return resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("Supabase unreachable while reading %s: %s", path, exc.__class__.__name__)
        return None


async def has_flag(user_id: str, module_id: str) -> bool:
    """Whether this user already has the lab's flag recorded server-side."""
    rows = await _get(
        f"progress?select=flag&user_id=eq.{quote(user_id, safe='')}&module_id=eq.{quote(module_id, safe='')}"
    )
    return bool(rows and rows[0].get("flag"))


async def platform_stats() -> dict[str, int] | None:
    """Real learner and completion counts, or None when Supabase is unavailable."""
    rows = await _get("progress?select=user_id,flag,fixit")
    if rows is None:
        return None
    return {
        "learners": len({row["user_id"] for row in rows if row.get("user_id")}),
        "completions": sum(1 for row in rows if row.get("flag") and row.get("fixit")),
    }


async def leaderboard_rows() -> list[dict[str, Any]] | None:
    """Profiles + progress for the global leaderboard (None when unavailable).

    Only the fields the leaderboard publishes are fetched: display name, a
    masked identifier and per-module completion flags. Attempts, emails in the
    clear and everything else stay behind RLS.
    """
    profiles = await _get("profiles?select=id,email,full_name")
    progress = await _get("progress?select=user_id,module_id,explored,flag,fixit")
    if profiles is None or progress is None:
        return None
    by_user: dict[str, dict[str, int]] = {}
    for row in progress:
        stats = by_user.setdefault(row["user_id"], {"explored": 0, "flags": 0, "fixes": 0, "completed": 0})
        stats["explored"] += 1 if row.get("explored") else 0
        stats["flags"] += 1 if row.get("flag") else 0
        stats["fixes"] += 1 if row.get("fixit") else 0
        stats["completed"] += 1 if (row.get("flag") and row.get("fixit")) else 0
    rows = []
    for p in profiles:
        stats = by_user.get(p["id"], {"explored": 0, "flags": 0, "fixes": 0, "completed": 0})
        # Exploration is a status bit worth 0 points: reading, chatting, hints
        # and navigation must never award score. Only verified achievements do.
        score = stats["flags"] * 100 + stats["fixes"] * 150
        rows.append({
            "user_id": p["id"],
            "name": (p.get("full_name") or "").strip(),
            "email": p.get("email") or "",
            **stats,
            "score": score,
        })
    rows.sort(key=lambda r: (-r["score"], -r["completed"], r["email"]))
    return rows

# ── Platform reads and course storage ────────────────────────────────────────

def _headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    s = get_settings()
    headers = {
        "apikey": s.supabase_service_key,
        "Authorization": f"Bearer {s.supabase_service_key}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


async def _request(
    method: str,
    path: str,
    *,
    payload: Any = None,
    prefer: str | None = None,
    extra_headers: dict[str, str] | None = None,
) -> tuple[int, Any, dict[str, str]]:
    """One PostgREST request. Returns (status, body, headers); (-1, None, {}) on failure."""
    if not configured():
        return -1, None, {}
    s = get_settings()
    extra = dict(extra_headers or {})
    if prefer:
        extra["Prefer"] = prefer
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.request(
                method,
                f"{s.supabase_url}/rest/v1/{path}",
                headers=_headers(extra),
                json=payload,
            )
    except httpx.HTTPError as exc:
        log.warning("Supabase %s %s failed: %s", method, path, exc.__class__.__name__)
        return -1, None, {}
    try:
        body = response.json() if response.content else None
    except ValueError:
        body = None
    if response.status_code >= 400:
        log.warning("Supabase %s %s returned %s: %s", method, path, response.status_code, str(body)[:300])
    return response.status_code, body, dict(response.headers)


async def progress_rows(user_id: str) -> dict[str, dict[str, Any]] | None:
    rows = await _get(
        "progress?select=module_id,explored,flag,fixit,updated_at"
        f"&user_id=eq.{quote(user_id, safe='')}"
    )
    if rows is None:
        return None
    return {
        row["module_id"]: {
            "explored": bool(row.get("explored")),
            "flag": bool(row.get("flag")),
            "fixit": bool(row.get("fixit")),
            "at": row.get("updated_at"),
        }
        for row in rows
    }


async def delete_progress(user_id: str) -> bool:
    status, _, _ = await _request(
        "DELETE", f"progress?user_id=eq.{quote(user_id, safe='')}"
    )
    return 200 <= status < 300


async def admin_overview() -> dict[str, Any] | None:
    profiles = await _get("profiles?select=id,email,full_name,role,created_at,last_sign_in_at&order=created_at")
    progress = await _get("progress?select=user_id,module_id,explored,flag,fixit,updated_at")
    status, attempts, _ = await _request(
        "GET", "attempts?select=id,user_id,module_id,kind,correct,created_at&order=created_at.desc&limit=60"
    )
    count_status, _, count_headers = await _request(
        "GET", "attempts?select=id", prefer="count=exact", extra_headers={"Range": "0-0"}
    )
    if profiles is None or progress is None or status >= 400:
        return None
    try:
        count = int(count_headers.get("content-range", "0/0").split("/")[-1])
    except ValueError:
        count = len(attempts or [])
    return {
        "profiles": profiles,
        "progress": progress,
        "attempts": attempts or [],
        "attempt_count": count,
    }


async def course_rows(*, published_only: bool, include_source: bool = False) -> list[dict[str, Any]] | None:
    select = "*,course_lessons(id,position,title,slug,markdown)" if include_source else "*,course_lessons(id,position,title,slug)"
    filters = ["deleted_at=is.null", "order=created_at.desc"]
    if published_only:
        filters.insert(0, "status=eq.published")
    status, rows, _ = await _request("GET", f"courses?select={select}&{'&'.join(filters)}")
    if status == -1 or status >= 400:
        return None
    for row in rows or []:
        row["lessons"] = sorted(row.pop("course_lessons", []) or [], key=lambda item: item.get("position", 0))
    return rows or []


async def course_by_slug(slug: str, *, published_only: bool) -> dict[str, Any] | None:
    filters = ["deleted_at=is.null"]
    if published_only:
        filters.append("status=eq.published")
    status, rows, _ = await _request(
        "GET",
        "courses?select=*,course_lessons(id,position,title,slug,markdown)"
        f"&slug=eq.{quote(slug, safe='')}&{'&'.join(filters)}&limit=1",
    )
    if status == -1 or status >= 400 or not rows:
        return None
    row = rows[0]
    row["lessons"] = sorted(row.pop("course_lessons", []) or [], key=lambda item: item.get("position", 0))
    return row


async def course_by_id(course_id: str) -> dict[str, Any] | None:
    status, rows, _ = await _request(
        "GET",
        "courses?select=*,course_lessons(id,position,title,slug,markdown)"
        f"&id=eq.{quote(course_id, safe='')}&limit=1",
    )
    if status == -1 or status >= 400 or not rows:
        return None
    row = rows[0]
    row["lessons"] = sorted(row.pop("course_lessons", []) or [], key=lambda item: item.get("position", 0))
    return row


async def create_course(course: dict[str, Any], lessons: list[dict[str, Any]]) -> dict[str, Any] | None:
    body = {key: value for key, value in course.items() if key != "lessons"}
    status, rows, _ = await _request(
        "POST", "courses", payload=body, prefer="return=representation"
    )
    if status == -1 or status >= 400:
        return None
    lesson_rows = [
        {
            "id": lesson["id"],
            "course_id": course["id"],
            "position": position,
            "title": lesson["title"],
            "slug": lesson["slug"],
            "markdown": lesson["markdown"],
        }
        for position, lesson in enumerate(lessons)
    ]
    if lesson_rows:
        lesson_status, _, _ = await _request("POST", "course_lessons", payload=lesson_rows)
        if lesson_status == -1 or lesson_status >= 400:
            await _request("DELETE", f"courses?id=eq.{quote(course['id'], safe='')}")
            return None
    return await course_by_id(course["id"])


async def update_course(course_id: str, fields: dict[str, Any], lessons: list[dict[str, Any]] | None = None) -> dict[str, Any] | None:
    if fields:
        status, _, _ = await _request(
            "PATCH",
            f"courses?id=eq.{quote(course_id, safe='')}",
            payload=fields,
            prefer="return=minimal",
        )
        if status == -1 or status >= 400:
            return None
    if lessons is not None:
        status, _, _ = await _request(
            "DELETE", f"course_lessons?course_id=eq.{quote(course_id, safe='')}"
        )
        if status == -1 or status >= 400:
            return None
        if lessons:
            rows = [
                {
                    "id": lesson["id"],
                    "course_id": course_id,
                    "position": position,
                    "title": lesson["title"],
                    "slug": lesson["slug"],
                    "markdown": lesson["markdown"],
                }
                for position, lesson in enumerate(lessons)
            ]
            status, _, _ = await _request("POST", "course_lessons", payload=rows)
            if status == -1 or status >= 400:
                return None
    return await course_by_id(course_id)


async def archive_course(course_id: str) -> bool:
    now = datetime.now(UTC).isoformat()
    status, _, _ = await _request(
        "PATCH",
        f"courses?id=eq.{quote(course_id, safe='')}",
        payload={"status": "archived", "deleted_at": now, "updated_at": now},
    )
    return 200 <= status < 300


async def set_course_progress(user_id: str, course_id: str, *, completed: bool) -> bool:
    now = datetime.now(UTC).isoformat()
    status, _, _ = await _request(
        "POST",
        "course_progress?on_conflict=user_id,course_id",
        payload={
            "user_id": user_id,
            "course_id": course_id,
            "completed": bool(completed),
            "started_at": now,
            "completed_at": now if completed else None,
            "updated_at": now,
        },
        prefer="resolution=merge-duplicates",
    )
    return 200 <= status < 300


async def course_progress(user_id: str) -> dict[str, dict[str, Any]] | None:
    rows = await _get(
        "course_progress?select=course_id,completed,started_at,completed_at,updated_at"
        f"&user_id=eq.{quote(user_id, safe='')}"
    )
    if rows is None:
        return None
    return {
        row["course_id"]: {
            "completed": bool(row.get("completed")),
            "started_at": row.get("started_at"),
            "completed_at": row.get("completed_at"),
            "updated_at": row.get("updated_at"),
        }
        for row in rows
    }

# ── Backend sessions (production refresh-token store) ────────────────────────

async def profile(user_id: str) -> dict[str, Any] | None:
    status, rows, _ = await _request(
        "GET",
        f"profiles?select=id,email,full_name,role,created_at,last_sign_in_at&id=eq.{quote(user_id, safe='')}&limit=1",
    )
    if status == -1 or status >= 400 or not rows:
        return None
    row = rows[0]
    return {
        "id": row["id"],
        "email": row.get("email") or "",
        "full_name": row.get("full_name"),
        "role": row.get("role") or "student",
        "created_at": row.get("created_at"),
        "last_login_at": row.get("last_sign_in_at"),
        "provider": "supabase",
    }


async def create_session(
    *,
    user_id: str,
    refresh_hash: str,
    expires_at: str,
    user_agent: str | None = None,
    ip_hash: str | None = None,
) -> str:
    import uuid

    session_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()
    status, _, _ = await _request(
        "POST",
        "auth_sessions",
        payload={
            "id": session_id,
            "user_id": user_id,
            "refresh_hash": refresh_hash,
            "created_at": now,
            "expires_at": expires_at,
            "last_used_at": now,
            "user_agent": user_agent,
            "ip_hash": ip_hash,
        },
    )
    if status == -1 or status >= 400:
        raise RuntimeError("Could not persist the session")
    return session_id


async def get_session_by_refresh(refresh_hash: str) -> dict[str, Any] | None:
    status, rows, _ = await _request(
        "GET",
        f"auth_sessions?select=*&refresh_hash=eq.{quote(refresh_hash, safe='')}&limit=1",
    )
    if status == -1 or status >= 400 or not rows:
        return None
    return rows[0]


async def session_is_active(session_id: str) -> bool | None:
    """False when the session is definitively revoked, None if unverifiable.

    The caller treats False as a signed-out session. None means the store could
    not answer, so the short-lived signed access token remains the authority
    rather than taking the whole platform offline with the database.
    """
    status, rows, _ = await _request(
        "GET",
        f"auth_sessions?select=id,revoked_at&id=eq.{quote(session_id, safe='')}&limit=1",
    )
    if status == -1 or status >= 400:
        return None
    if not rows:
        return False
    return not rows[0].get("revoked_at")


async def rotate_session(old: dict[str, Any], *, new_hash: str, new_expires_at: str) -> str:
    import uuid

    new_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()
    status, _, _ = await _request(
        "PATCH",
        f"auth_sessions?id=eq.{quote(str(old['id']), safe='')}",
        payload={"revoked_at": now, "replaced_by": new_id, "last_used_at": now},
    )
    if status == -1 or status >= 400:
        raise RuntimeError("Could not rotate the session")
    status, _, _ = await _request(
        "POST",
        "auth_sessions",
        payload={
            "id": new_id,
            "user_id": old["user_id"],
            "refresh_hash": new_hash,
            "created_at": now,
            "expires_at": new_expires_at,
            "last_used_at": now,
            "user_agent": old.get("user_agent"),
            "ip_hash": old.get("ip_hash"),
        },
    )
    if status == -1 or status >= 400:
        raise RuntimeError("Could not persist the rotated session")
    return new_id


async def revoke_all_for_user(user_id: str) -> None:
    await _request(
        "PATCH",
        f"auth_sessions?user_id=eq.{quote(user_id, safe='')}&revoked_at=is.null",
        payload={"revoked_at": datetime.now(UTC).isoformat()},
    )


async def record_auth_event(kind: str, *, user_id: str | None = None, detail: str | None = None) -> None:
    await _request(
        "POST",
        "auth_events",
        payload={
            "user_id": user_id,
            "kind": kind,
            "detail": detail[:400] if detail else None,
            "created_at": datetime.now(UTC).isoformat(),
        },
    )

async def update_profile(user_id: str, full_name: str | None) -> bool:
    status, _, _ = await _request(
        "PATCH",
        f"profiles?id=eq.{quote(user_id, safe='')}",
        payload={"full_name": full_name},
    )
    return 200 <= status < 300
