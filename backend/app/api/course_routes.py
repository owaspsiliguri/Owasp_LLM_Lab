"""Public course catalogue and learner completion.

Courses are authored by administrators and published server-side. Only
``status='published'`` rows are visible here; drafts and archived courses stay
in the admin API.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict

from app.core import auth
from app.services import course_service, platform_store

router = APIRouter(prefix="/courses", tags=["courses"])


class CompletionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    completed: bool = True


@router.get("")
async def list_courses() -> dict[str, Any]:
    courses = await platform_store.list_courses(published_only=True)
    return {
        "courses": [course_service.summary(course) for course in courses],
        "source": platform_store.backend_name(),
    }


@router.get("/{slug}")
async def course_detail(slug: str) -> dict[str, Any]:
    course = await platform_store.get_course_by_slug(slug, published_only=True)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    return course_service.detail(course)


@router.post("/{slug}/complete")
async def complete(slug: str, body: CompletionBody, user: auth.OptionalUser) -> dict[str, Any]:
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in to save course progress.")
    course = await platform_store.get_course_by_slug(slug, published_only=True)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    await platform_store.set_course_progress(user["id"], course["id"], completed=body.completed)
    return {"ok": True, "course_id": course["id"], "completed": body.completed}
