"""Parse, validate and sanitise administrator-uploaded Markdown courses.

The on-disk filename is never trusted or stored. A course is identified by a
server-generated UUID and a validated slug. The original Markdown is kept in
the database for auditability; lessons are derived server-side from level-two
headings so the structure is deterministic.

Frontmatter (YAML) is required::

    ---
    title: Prompt Injection Essentials
    slug: prompt-injection-essentials
    description: A short course description.
    category: LLM01:2025 Prompt Injection
    difficulty: Beginner
    estimated_minutes: 45
    ---

    Course introduction (optional overview lesson).

    ## First lesson
    Lesson body...

    ## Second lesson
    Lesson body...
"""
from __future__ import annotations

import hashlib
import re
import uuid
from dataclasses import dataclass
from typing import Any

import yaml

from app.config import get_settings

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DANGEROUS_URL_RE = re.compile(r"\]\(\s*(?:javascript|vbscript|data):", re.IGNORECASE)
RAW_HREF_RE = re.compile(r"""(?:href|src)\s*=\s*["']?\s*(?:javascript|vbscript|data):""", re.IGNORECASE)
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
DIFFICULTIES = {"Beginner", "Intermediate", "Advanced", "Expert"}
MAX_LESSONS = 60
MAX_LESSON_BYTES = 120_000


class CourseValidationError(ValueError):
    """Raised when an upload cannot be accepted. The message is user-facing."""


@dataclass(frozen=True)
class ParsedCourse:
    title: str
    slug: str
    description: str
    category: str
    difficulty: str
    estimated_minutes: int
    lessons: list[dict[str, str]]
    source_markdown: str
    checksum: str


def slugify(value: str, *, fallback: str = "lesson") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)[:80].strip("-")
    return slug or fallback


def _as_text(value: Any, field: str, *, max_length: int, required: bool = True) -> str:
    if value is None:
        if required:
            raise CourseValidationError(f"Frontmatter is missing '{field}'.")
        return ""
    text = CONTROL_RE.sub("", str(value)).strip()
    if required and not text:
        raise CourseValidationError(f"Frontmatter field '{field}' cannot be empty.")
    if len(text) > max_length:
        raise CourseValidationError(f"Frontmatter field '{field}' is longer than {max_length} characters.")
    return text


def _split_frontmatter(source: str) -> tuple[dict[str, Any], str]:
    normalised = source.replace("\r\n", "\n").replace("\r", "\n")
    if not normalised.startswith("---\n"):
        raise CourseValidationError("The file must start with YAML frontmatter delimited by '---'.")
    end = normalised.find("\n---", 4)
    if end == -1:
        raise CourseValidationError("The YAML frontmatter is not closed with '---'.")
    header = normalised[4:end]
    body = normalised[end + 4:]
    if body.startswith("\n"):
        body = body[1:]
    try:
        metadata = yaml.safe_load(header)
    except yaml.YAMLError as exc:
        mark = getattr(exc, "problem_mark", None)
        where = f" on line {mark.line + 1}" if mark else ""
        raise CourseValidationError(f"The YAML frontmatter is invalid{where}.") from exc
    if not isinstance(metadata, dict):
        raise CourseValidationError("The YAML frontmatter must be a mapping of fields.")
    return metadata, body


def _lesson_sections(body: str) -> list[dict[str, str]]:
    """Split on level-two headings, ignoring headings inside fenced code."""
    lines = body.split("\n")
    sections: list[tuple[str, list[str]]] = []
    intro: list[str] = []
    current_title: str | None = None
    current: list[str] = []
    in_fence = False

    def flush() -> None:
        nonlocal current_title, current
        if current_title is not None:
            sections.append((current_title, current))
        current_title, current = None, []

    for line in lines:
        if line.strip().startswith("```"):
            in_fence = not in_fence
        if not in_fence and re.match(r"^##\s+\S", line):
            flush()
            current_title = line[2:].strip()
            current = []
            continue
        if current_title is None:
            intro.append(line)
        else:
            current.append(line)
    flush()

    if not sections:
        text = body.strip()
        if not text:
            raise CourseValidationError("The course has no lesson content.")
        return [{"title": "Course content", "markdown": text}]

    intro_text = "\n".join(intro).strip()
    lessons: list[dict[str, str]] = []
    if intro_text:
        lessons.append({"title": "Overview", "markdown": intro_text})
    for title, content in sections:
        text = "\n".join(content).strip()
        if not text:
            raise CourseValidationError(f"Lesson '{title}' has no content.")
        lessons.append({"title": title[:120], "markdown": text})
    return lessons


def _reject_unsafe_markdown(body: str) -> None:
    if DANGEROUS_URL_RE.search(body) or RAW_HREF_RE.search(body):
        raise CourseValidationError(
            "The Markdown contains a javascript:, vbscript: or data: link. "
            "Use ordinary https:// links only."
        )


def parse_course(source: str) -> ParsedCourse:
    settings = get_settings()
    if not isinstance(source, str):
        raise CourseValidationError("The upload must be a text file.")
    if len(source.encode("utf-8")) > settings.max_course_bytes:
        raise CourseValidationError(
            f"The file is larger than the {settings.max_course_bytes // 1024} KiB limit."
        )
    if not source.strip():
        raise CourseValidationError("The file is empty.")
    if "\x00" in source:
        raise CourseValidationError("The file is not a valid UTF-8 Markdown document.")

    metadata, body = _split_frontmatter(source)
    title = _as_text(metadata.get("title"), "title", max_length=120)
    slug = _as_text(metadata.get("slug", slugify(title)), "slug", max_length=80).lower()
    if not SLUG_RE.fullmatch(slug):
        raise CourseValidationError("The slug may contain lowercase letters, digits and single hyphens only.")
    description = _as_text(metadata.get("description"), "description", max_length=600)
    category = _as_text(metadata.get("category", "LLM Security"), "category", max_length=120)
    difficulty = _as_text(metadata.get("difficulty", "Beginner"), "difficulty", max_length=20).title()
    if difficulty not in DIFFICULTIES:
        raise CourseValidationError("Difficulty must be Beginner, Intermediate, Advanced or Expert.")
    try:
        estimated_minutes = int(metadata.get("estimated_minutes", 30))
    except (TypeError, ValueError) as exc:
        raise CourseValidationError("estimated_minutes must be a whole number of minutes.") from exc
    if not 1 <= estimated_minutes <= 600:
        raise CourseValidationError("estimated_minutes must be between 1 and 600.")

    _reject_unsafe_markdown(body)
    raw_lessons = _lesson_sections(body)
    if len(raw_lessons) > MAX_LESSONS:
        raise CourseValidationError(f"A course can have at most {MAX_LESSONS} lessons.")

    used: set[str] = set()
    lessons: list[dict[str, str]] = []
    for index, lesson in enumerate(raw_lessons):
        markdown = lesson["markdown"]
        if len(markdown.encode("utf-8")) > MAX_LESSON_BYTES:
            raise CourseValidationError(f"Lesson '{lesson['title']}' is too large.")
        base = slugify(lesson["title"], fallback=f"lesson-{index + 1}")
        lesson_slug = base
        suffix = 2
        while lesson_slug in used:
            lesson_slug = f"{base}-{suffix}"
            suffix += 1
        used.add(lesson_slug)
        lessons.append({
            "id": str(uuid.uuid4()),
            "title": lesson["title"],
            "slug": lesson_slug,
            "markdown": markdown,
        })

    return ParsedCourse(
        title=title,
        slug=slug,
        description=description,
        category=category,
        difficulty=difficulty,
        estimated_minutes=estimated_minutes,
        lessons=lessons,
        source_markdown=source.replace("\r\n", "\n"),
        checksum=hashlib.sha256(source.encode("utf-8")).hexdigest(),
    )


def course_record(parsed: ParsedCourse, *, created_by: str | None, status: str = "draft") -> tuple[dict[str, Any], list[dict[str, Any]]]:
    course = {
        "id": str(uuid.uuid4()),
        "slug": parsed.slug,
        "title": parsed.title,
        "description": parsed.description,
        "category": parsed.category,
        "difficulty": parsed.difficulty,
        "estimated_minutes": parsed.estimated_minutes,
        "thumbnail_url": None,
        "status": status,
        "source_markdown": parsed.source_markdown,
        "checksum": parsed.checksum,
        "created_by": created_by,
    }
    return course, parsed.lessons


def summary(course: dict[str, Any], *, include_source: bool = False) -> dict[str, Any]:
    """Public shape of a course: no full source, no author UUID."""
    lessons = [
        {
            "id": lesson["id"],
            "position": position,
            "title": lesson["title"],
            "slug": lesson["slug"],
        }
        for position, lesson in enumerate(course.get("lessons") or [])
    ]
    result = {
        "id": course["id"],
        "slug": course["slug"],
        "title": course["title"],
        "description": course["description"],
        "category": course["category"],
        "difficulty": course["difficulty"],
        "estimated_minutes": course["estimated_minutes"],
        "thumbnail_url": course.get("thumbnail_url"),
        "status": course.get("status"),
        "created_at": course.get("created_at"),
        "updated_at": course.get("updated_at"),
        "published_at": course.get("published_at"),
        "version": course.get("version", 1),
        "lessons": lessons,
        "lesson_count": len(lessons),
    }
    if include_source:
        result["source_markdown"] = course.get("source_markdown")
        result["checksum"] = course.get("checksum")
    return result


def detail(course: dict[str, Any]) -> dict[str, Any]:
    result = summary(course)
    result["lessons"] = [
        {
            "id": lesson["id"],
            "position": position,
            "title": lesson["title"],
            "slug": lesson["slug"],
            "markdown": lesson["markdown"],
        }
        for position, lesson in enumerate(course.get("lessons") or [])
    ]
    return result
