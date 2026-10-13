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
