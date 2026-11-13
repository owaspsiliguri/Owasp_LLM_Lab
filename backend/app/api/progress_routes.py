"""Server-authoritative progress reads and the explicit reset action.

Achievements are written only by the lab run/flag/fix endpoints after the
server verifies them. This router never accepts a client-supplied boolean.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.core import auth
from app.services import platform_store

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("")
async def progress(user: auth.OptionalUser) -> dict[str, Any]:
    if user is None:
        return {"modules": {}, "courses": {}, "source": "open", "auth_required": False}
    modules = await platform_store.get_progress(user["id"])
    courses = await platform_store.course_progress(user["id"])
    return {
        "modules": modules,
        "courses": courses,
        "source": platform_store.backend_name(),
        "auth_required": True,
    }


@router.post("/reset")
async def reset(user: auth.CurrentUser) -> dict[str, Any]:
    await platform_store.delete_progress(user["id"])
    return {"ok": True, "modules": {}, "courses": {}}
