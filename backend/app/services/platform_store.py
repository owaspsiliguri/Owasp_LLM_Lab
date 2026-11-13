"""Server-authoritative storage façade.

Supabase is the production store when configured. SQLite is the local and
offline store. All scoring decisions are made by the API routes before they
call this module; the browser never writes progress or course completion.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.services import db, supabase_store

log = logging.getLogger("lab.platform_store")


def backend_name() -> str:
    return "supabase" if supabase_store.configured() else "sqlite"


async def health() -> dict[str, Any]:
    if supabase_store.configured():
        return await supabase_store.health()
    try:
        await _local(db.init)
        return {"status": "ok", "configured": True, "engine": "sqlite"}
    except Exception as exc:  # noqa: BLE001 - health reports, never raises
        return {"status": "unavailable", "configured": True, "engine": "sqlite", "error": exc.__class__.__name__}


async def _local(fn, *args, **kwargs):
    return await asyncio.to_thread(fn, *args, **kwargs)


# ── Learner progress ─────────────────────────────────────────────────────────

async def get_progress(user_id: str) -> dict[str, dict[str, Any]]:
    if supabase_store.configured():
        rows = await supabase_store.progress_rows(user_id)
        return rows or {}
    return await _local(db.get_progress, user_id)


async def mark_progress(user_id: str, module_id: str, **flags: bool) -> None:
    if supabase_store.configured():
        await supabase_store.upsert_progress(user_id, module_id, **flags)
    else:
        await _local(db.mark_progress, user_id, module_id, **flags)


async def has_flag(user_id: str, module_id: str) -> bool:
    if supabase_store.configured():
        return await supabase_store.has_flag(user_id, module_id)
    return await _local(db.has_flag, user_id, module_id)


async def record_attempt(user_id: str, module_id: str, kind: str, *, correct: bool, detail: str | None = None) -> None:
    if supabase_store.configured():
        await supabase_store.record_attempt(user_id, module_id, kind, correct=correct, detail=detail)
    else:
        await _local(db.record_attempt, user_id, module_id, kind, correct=correct, detail=detail)


async def delete_progress(user_id: str) -> None:
    if supabase_store.configured():
        await supabase_store.delete_progress(user_id)
    else:
        await _local(db.delete_progress, user_id)


async def platform_stats() -> dict[str, int] | None:
    if supabase_store.configured():
        return await supabase_store.platform_stats()
    return await _local(db.platform_stats)


async def leaderboard_rows() -> list[dict[str, Any]] | None:
    if supabase_store.configured():
        return await supabase_store.leaderboard_rows()
    return await _local(db.leaderboard_rows)


async def admin_overview() -> dict[str, Any] | None:
    if supabase_store.configured():
        return await supabase_store.admin_overview()
    return await _local(db.admin_overview)


# ── Courses ──────────────────────────────────────────────────────────────────

async def list_courses(*, published_only: bool, include_source: bool = False) -> list[dict[str, Any]]:
    if supabase_store.configured():
        return await supabase_store.course_rows(published_only=published_only, include_source=include_source) or []
    return await _local(db.list_courses, published_only=published_only)


async def get_course_by_slug(slug: str, *, published_only: bool) -> dict[str, Any] | None:
    if supabase_store.configured():
        return await supabase_store.course_by_slug(slug, published_only=published_only)
    course = await _local(db.get_course_by_slug, slug)
    if not course:
        return None
    if published_only and course.get("status") != "published":
        return None
    return course


async def get_course(course_id: str) -> dict[str, Any] | None:
    if supabase_store.configured():
        return await supabase_store.course_by_id(course_id)
    return await _local(db.get_course, course_id)


async def create_course(course: dict[str, Any], lessons: list[dict[str, Any]]) -> dict[str, Any] | None:
    if supabase_store.configured():
        return await supabase_store.create_course(course, lessons)
    try:
        return await _local(db.create_course, course, lessons)
    except Exception:  # unique slug or foreign-key conflict
        return None


async def update_course(course_id: str, fields: dict[str, Any], lessons: list[dict[str, Any]] | None = None) -> dict[str, Any] | None:
    if supabase_store.configured():
        return await supabase_store.update_course(course_id, fields, lessons)
    try:
        return await _local(db.update_course, course_id, fields, lessons)
    except Exception:
        return None


async def archive_course(course_id: str) -> bool:
    if supabase_store.configured():
        return await supabase_store.archive_course(course_id)
    await _local(db.archive_course, course_id)
    return True


async def set_course_progress(user_id: str, course_id: str, *, completed: bool) -> None:
    if supabase_store.configured():
        await supabase_store.set_course_progress(user_id, course_id, completed=completed)
    else:
        await _local(db.set_course_progress, user_id, course_id, completed=completed)


async def course_progress(user_id: str) -> dict[str, dict[str, Any]]:
    if supabase_store.configured():
        return await supabase_store.course_progress(user_id) or {}
    return await _local(db.course_progress, user_id)

# ── Users and refresh sessions ───────────────────────────────────────────────

async def get_user(user_id: str) -> dict[str, Any] | None:
    if supabase_store.configured():
        record = await supabase_store.profile(user_id)
        if record:
            return record
    return await _local(db.get_user, user_id)


async def get_user_by_email(email: str) -> dict[str, Any] | None:
    return await _local(db.get_user_by_email, email)


async def touch_login(user_id: str) -> None:
    if supabase_store.configured():
        return
    await _local(db.touch_login, user_id)


async def create_session(*, user_id: str, refresh_hash: str, expires_at: str, user_agent: str | None = None, ip_hash: str | None = None) -> str:
    if supabase_store.configured():
        try:
            return await supabase_store.create_session(
                user_id=user_id,
                refresh_hash=refresh_hash,
                expires_at=expires_at,
                user_agent=user_agent,
                ip_hash=ip_hash,
            )
        except Exception as exc:
            log.warning("Supabase create_session failed: %s; falling back to local SQLite session", exc)
    return await _local(
        db.create_session,
        user_id=user_id,
        refresh_hash=refresh_hash,
        expires_at=expires_at,
        user_agent=user_agent,
        ip_hash=ip_hash,
    )


async def get_session_by_refresh(refresh_hash: str) -> dict[str, Any] | None:
    if supabase_store.configured():
        try:
            sess = await supabase_store.get_session_by_refresh(refresh_hash)
            if sess:
                return sess
        except Exception as exc:
            log.warning("Supabase get_session_by_refresh failed: %s", exc)
    return await _local(db.get_session_by_refresh, refresh_hash)


async def rotate_session(old: dict[str, Any], *, new_hash: str, new_expires_at: str) -> str:
    if supabase_store.configured():
        try:
            return await supabase_store.rotate_session(old, new_hash=new_hash, new_expires_at=new_expires_at)
        except Exception as exc:
            log.warning("Supabase rotate_session failed: %s; falling back to SQLite", exc)
    return await _local(db.rotate_session, old, new_hash=new_hash, new_expires_at=new_expires_at)


async def revoke_all_for_user(user_id: str) -> None:
    if supabase_store.configured():
        try:
            await supabase_store.revoke_all_for_user(user_id)
        except Exception as exc:
            log.warning("Supabase revoke_all_for_user failed: %s", exc)
    await _local(db.revoke_all_for_user, user_id)


async def session_active(session_id: str) -> bool | None:
    if supabase_store.configured():
        try:
            active = await supabase_store.session_is_active(session_id)
            if active is not None:
                return active
        except Exception as exc:
            log.warning("Supabase session_active failed: %s", exc)
    return await _local(db.session_is_active, session_id)


async def record_auth_event(kind: str, *, user_id: str | None = None, detail: str | None = None) -> None:
    if supabase_store.configured():
        try:
            await supabase_store.record_auth_event(kind, user_id=user_id, detail=detail)
            return
        except Exception as exc:
            log.warning("Supabase record_auth_event failed: %s", exc)
    await _local(db.record_auth_event, kind, user_id=user_id, detail=detail)

async def update_user_name(user_id: str, full_name: str | None) -> None:
    if supabase_store.configured():
        await supabase_store.update_profile(user_id, full_name)
    else:
        await _local(db.update_profile, user_id, full_name)
