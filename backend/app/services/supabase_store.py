"""Writes lab achievements (progress and attempt history) to Supabase.

Uses the PostgREST API with the service role key, which bypasses row level
security: these rows are written only after the *server* has verified the flag
or the fix, never on the client's word.

Every failure is logged and swallowed: the lab engine must keep working when
Supabase is unreachable or not configured at all.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

import httpx

from app.config import get_settings

log = logging.getLogger("lab.supabase")
TIMEOUT = httpx.Timeout(5.0, connect=3.0)


def configured() -> bool:
    s = get_settings()
    return bool(s.supabase_url and s.supabase_service_key)


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
        score = stats["flags"] * 100 + stats["fixes"] * 150 + stats["explored"] * 10
        rows.append({
            "user_id": p["id"],
            "name": (p.get("full_name") or "").strip(),
            "email": p.get("email") or "",
            **stats,
            "score": score,
        })
    rows.sort(key=lambda r: (-r["score"], -r["completed"], r["email"]))
    return rows
