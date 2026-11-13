"""Administrator console API: roster/audit data and Markdown course authoring.

Every route depends on ``AdminUser``, which checks the database role on each
request. Hiding the frontend link is never the access control.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict

from app.config import get_settings
from app.core import auth
from app.services import course_service, platform_store

router = APIRouter(prefix="/admin", tags=["admin"])

Status = Literal["draft", "published", "archived"]


class StatusBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Status


class SourceBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: str


def _parsed_fields(parsed: course_service.ParsedCourse) -> dict[str, Any]:
    """Editable course columns. Status and published_at stay under PATCH."""
    return {
        "slug": parsed.slug,
        "title": parsed.title,
        "description": parsed.description,
        "category": parsed.category,
        "difficulty": parsed.difficulty,
        "estimated_minutes": parsed.estimated_minutes,
        "source_markdown": parsed.source_markdown,
        "checksum": parsed.checksum,
    }


@router.get("/overview")
async def overview(_: auth.AdminUser) -> dict[str, Any]:
    data = await platform_store.admin_overview()
    if data is None:
        raise HTTPException(status_code=503, detail="The reporting database is unavailable.")
    return {**data, "source": platform_store.backend_name()}


@router.get("/courses")
async def courses(_: auth.AdminUser) -> dict[str, Any]:
    rows = await platform_store.list_courses(published_only=False, include_source=True)
    return {
        "courses": [course_service.summary(course, include_source=True) for course in rows],
        "source": platform_store.backend_name(),
    }


@router.get("/courses/{course_id}")
async def course(course_id: str, _: auth.AdminUser) -> dict[str, Any]:
    record = await platform_store.get_course(course_id)
    if not record:
        raise HTTPException(status_code=404, detail="Course not found.")
    result = course_service.detail(record)
    result["source_markdown"] = record.get("source_markdown")
    result["checksum"] = record.get("checksum")
    return result


async def _read_upload(upload: UploadFile) -> str:
    settings = get_settings()
    filename = (upload.filename or "").lower()
    if not filename.endswith((".md", ".markdown", ".txt")):
        raise HTTPException(status_code=422, detail="Upload a Markdown file ending in .md or .markdown.")
    raw = await upload.read(settings.max_course_bytes + 1)
    if len(raw) > settings.max_course_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"The file is larger than the {settings.max_course_bytes // 1024} KiB limit.",
        )
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="The file must be UTF-8 encoded text.") from exc
    if "\x00" in text:
        raise HTTPException(status_code=422, detail="The file must be a text Markdown document.")
    return text


@router.post("/courses", status_code=201)
async def upload_course(
    user: auth.AdminUser,
    file: Annotated[UploadFile, File()],
    status: Annotated[Status, Form()] = "draft",
) -> dict[str, Any]:
    text = await _read_upload(file)
    try:
        parsed = course_service.parse_course(text)
    except course_service.CourseValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if status == "archived":
        raise HTTPException(status_code=422, detail="Upload as a draft or publish it explicitly.")
    existing = await platform_store.get_course_by_slug(parsed.slug, published_only=False)
    if existing:
        raise HTTPException(status_code=409, detail="A course with that slug already exists.")
    record, lessons = course_service.course_record(parsed, created_by=user["id"], status=status)
    created = await platform_store.create_course(record, lessons)
    if not created:
        raise HTTPException(status_code=409, detail="Could not save the course. The slug may already exist.")
    result = course_service.summary(created, include_source=True)
    return result


@router.put("/courses/{course_id}")
async def replace_course(
    course_id: str,
    user: auth.AdminUser,
    file: Annotated[UploadFile, File()],
) -> dict[str, Any]:
    current = await platform_store.get_course(course_id)
    if not current:
        raise HTTPException(status_code=404, detail="Course not found.")
    text = await _read_upload(file)
    try:
        parsed = course_service.parse_course(text)
    except course_service.CourseValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    clash = await platform_store.get_course_by_slug(parsed.slug, published_only=False)
    if clash and clash["id"] != course_id:
        raise HTTPException(status_code=409, detail="Another course already uses that slug.")
    updated = await platform_store.update_course(course_id, _parsed_fields(parsed), parsed.lessons)
    if not updated:
        raise HTTPException(status_code=409, detail="Could not replace the course.")
    return course_service.summary(updated, include_source=True)


@router.put("/courses/{course_id}/source")
async def edit_course_source(
    course_id: str,
    body: SourceBody,
    _: auth.AdminUser,
) -> dict[str, Any]:
    """Save an in-place Markdown edit without changing the publication state."""
    current = await platform_store.get_course(course_id)
    if not current:
        raise HTTPException(status_code=404, detail="Course not found.")
    try:
        parsed = course_service.parse_course(body.source)
    except course_service.CourseValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    clash = await platform_store.get_course_by_slug(parsed.slug, published_only=False)
    if clash and clash["id"] != course_id:
        raise HTTPException(status_code=409, detail="Another course already uses that slug.")
    updated = await platform_store.update_course(course_id, _parsed_fields(parsed), parsed.lessons)
    if not updated:
        raise HTTPException(status_code=409, detail="Could not save the edited course.")
    return course_service.summary(updated, include_source=True)


@router.patch("/courses/{course_id}")
async def change_status(course_id: str, body: StatusBody, _: auth.AdminUser) -> dict[str, Any]:
    current = await platform_store.get_course(course_id)
    if not current:
        raise HTTPException(status_code=404, detail="Course not found.")
    if body.status == "archived":
        await platform_store.archive_course(course_id)
    else:
        now = datetime.now(UTC).isoformat()
        fields: dict[str, Any] = {"status": body.status}
        if body.status == "published" and not current.get("published_at"):
            fields["published_at"] = now
        if body.status == "draft":
            fields["published_at"] = None
        await platform_store.update_course(course_id, fields)
    updated = await platform_store.get_course(course_id)
    if not updated:
        return {"ok": True, "id": course_id, "status": body.status}
    return course_service.summary(updated, include_source=True)


@router.delete("/courses/{course_id}")
async def delete_course(course_id: str, _: auth.AdminUser) -> dict[str, Any]:
    current = await platform_store.get_course(course_id)
    if not current:
        raise HTTPException(status_code=404, detail="Course not found.")
    # Soft archive: the row remains for auditability and future restoration.
    await platform_store.archive_course(course_id)
    return {"ok": True, "id": course_id, "status": "archived"}
