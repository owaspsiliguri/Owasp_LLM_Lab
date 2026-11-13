"""Course authoring: in-place edits, status preservation and the lab catalogue seed."""
from __future__ import annotations

import asyncio
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services import course_seed, course_service, db
from app.vulnerabilities import MODULES

PASSWORD = "Correct-Horse-9-Battery"
JWT_SECRET = "test-jwt-secret-for-course-tests-only"


@pytest.fixture()
def admin_client(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", JWT_SECRET)
    monkeypatch.setenv("AUTH_REQUIRED", "1")
    monkeypatch.setenv("COOKIE_SECURE", "0")
    monkeypatch.setenv("LOGIN_RATE_LIMIT_PER_MINUTE", "1000")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    db.init()
    client = TestClient(create_app())
    email = f"admin-{uuid.uuid4().hex}@example.org"
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": "Course Admin"},
    )
    assert response.status_code == 200, response.text
    db.set_user_role(response.json()["user"]["id"], "admin")
    try:
        yield client
    finally:
        client.close()


def csrf(client: TestClient) -> str:
    return client.cookies.get("llm_csrf")


def source(slug: str, title: str = "Course under edit") -> str:
    return (
        "---\n"
        f"title: {title}\n"
        f"slug: {slug}\n"
        "description: A course used to verify the admin editor.\n"
        "category: LLM01:2025 Prompt Injection\n"
        "difficulty: Beginner\n"
        "estimated_minutes: 30\n"
        "---\n\n"
        "Overview text.\n\n"
        "## First lesson\nFirst body.\n\n"
        "## Second lesson\nSecond body.\n"
    )


def upload(client: TestClient, slug: str, title: str = "Course under edit") -> dict:
    response = client.post(
        "/api/admin/courses",
        files={"file": ("course.md", source(slug, title), "text/markdown")},
        data={"status": "draft"},
        headers={"X-CSRF-Token": csrf(client)},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_edit_source_preserves_status_and_replaces_lessons(admin_client):
    slug = f"edit-{uuid.uuid4().hex[:10]}"
    course = upload(admin_client, slug)
    edited = source(slug, "Course under edit, revised").replace(
        "## Second lesson\nSecond body.\n",
        "## Second lesson\nSecond body.\n\n## Third lesson\nThird body.\n",
    )

    response = admin_client.put(
        f"/api/admin/courses/{course['id']}/source",
        json={"source": edited},
        headers={"X-CSRF-Token": csrf(admin_client)},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["title"] == "Course under edit, revised"
    assert body["status"] == "draft"
    assert body["lesson_count"] == 4
    assert body["version"] == 2
    assert body["checksum"] and body["source_markdown"] == edited

    detail = admin_client.get(f"/api/admin/courses/{course['id']}")
    assert detail.status_code == 200
    assert [lesson["title"] for lesson in detail.json()["lessons"]] == [
        "Overview", "First lesson", "Second lesson", "Third lesson",
    ]


def test_edit_source_rejects_a_slug_collision(admin_client):
    first = upload(admin_client, f"first-{uuid.uuid4().hex[:10]}")
    second = upload(admin_client, f"second-{uuid.uuid4().hex[:10]}")

    response = admin_client.put(
        f"/api/admin/courses/{first['id']}/source",
        json={"source": source(second["slug"], "Stolen slug")},
        headers={"X-CSRF-Token": csrf(admin_client)},
    )

    assert response.status_code == 409
    assert "slug" in response.json()["detail"].lower()


def test_edit_source_rejects_invalid_markdown(admin_client):
    course = upload(admin_client, f"invalid-{uuid.uuid4().hex[:10]}")

    response = admin_client.put(
        f"/api/admin/courses/{course['id']}/source",
        json={"source": "No frontmatter here."},
        headers={"X-CSRF-Token": csrf(admin_client)},
    )

    assert response.status_code == 422
    assert "frontmatter" in response.json()["detail"].lower()


def test_every_lab_has_a_valid_companion_course():
    for module in MODULES:
        parsed = course_service.parse_course(course_seed.build_lab_course(module))
        assert parsed.slug == f"{module.id}-essentials"
        assert parsed.title == f"{module.name} Essentials"
        assert parsed.category == module.category
        assert parsed.difficulty == module.difficulty
        assert len(parsed.lessons) >= 5
        assert all(lesson["markdown"].strip() for lesson in parsed.lessons)
        assert "250 points" in parsed.source_markdown


def test_seed_catalog_is_idempotent_and_publishes_every_lab(monkeypatch, tmp_path):
    monkeypatch.setenv("LAB_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    db.init()

    first = asyncio.run(course_seed.seed_catalog())
    assert len(first["created"]) == len(MODULES)
    assert not first["failed"]

    second = asyncio.run(course_seed.seed_catalog())
    assert second["created"] == []
    assert len(second["skipped"]) == len(MODULES)

    refreshed = asyncio.run(course_seed.seed_catalog(update=True))
    assert len(refreshed["updated"]) == len(MODULES)

    courses = db.list_courses(published_only=True)
    assert len(courses) == len(MODULES)
    assert {course["slug"] for course in courses} == {f"{module.id}-essentials" for module in MODULES}
    assert all(course["status"] == "published" for course in courses)
