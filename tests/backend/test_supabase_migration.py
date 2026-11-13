"""Static checks for the additive Supabase migration.

No production project is contacted. These checks keep the committed SQL in
sync with the columns the backend store actually queries, and guard the most
important security property: browsers must not be able to write progress.
"""
from __future__ import annotations

import re
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "20261111_platform_upgrade.sql"

TABLES = {
    "courses": {
        "id", "slug", "title", "description", "category", "difficulty", "estimated_minutes",
        "thumbnail_url", "status", "source_markdown", "checksum", "created_by", "created_at",
        "updated_at", "published_at", "deleted_at", "version",
    },
    "course_lessons": {"id", "course_id", "position", "title", "slug", "markdown"},
    "course_progress": {"user_id", "course_id", "completed", "started_at", "completed_at", "updated_at"},
    "auth_sessions": {
        "id", "user_id", "refresh_hash", "created_at", "expires_at", "last_used_at",
        "revoked_at", "replaced_by", "user_agent", "ip_hash",
    },
    "auth_events": {"id", "user_id", "kind", "detail", "created_at"},
}


def sql() -> str:
    return MIGRATION.read_text(encoding="utf-8").lower()


def table_body(name: str) -> str:
    match = re.search(
        rf"create table if not exists public\.{name} \((.*?)\n\);",
        sql(),
        re.S,
    )
    assert match, f"missing create table for {name}"
    return match.group(1)


def test_migration_is_additive_and_idempotent():
    text = sql()
    for table in TABLES:
        assert f"create table if not exists public.{table}" in text
    assert "drop table" not in text


def test_every_table_has_the_columns_the_backend_queries():
    for table, columns in TABLES.items():
        body = table_body(table)
        missing = [column for column in columns if not re.search(rf"\b{re.escape(column)}\b", body)]
        assert not missing, f"{table} is missing columns: {missing}"


def test_browser_progress_writes_are_revoked_and_removed():
    text = sql()
    assert "revoke insert, update, delete on public.progress from anon, authenticated;" in text
    for policy in ("insert progress", "update progress", "delete progress"):
        assert f'create policy "{policy}"' not in text
    assert text.count('drop policy if exists "insert progress"') == 1
    assert "grant select on public.progress to authenticated;" in text


def test_sessions_and_events_are_service_role_only():
    text = sql()
    for table in ("auth_sessions", "auth_events"):
        assert re.search(rf"alter table public\.{table}\s+enable row level security;", text)
        assert f"revoke all on public.{table} from anon, authenticated;" in text
        assert f"grant all on public.{table}" in text
        # No browser-facing policy for credential material.
        assert f'create policy "read {table}' not in text


def test_published_courses_are_readable_but_not_writable_by_browsers():
    text = sql()
    assert 'create policy "read published courses"' in text
    assert 'create policy "read published lessons"' in text
    assert "revoke insert, update, delete on public.courses from anon, authenticated;" in text
    assert "revoke insert, update, delete on public.course_lessons from anon, authenticated;" in text
    assert 'create policy "read own course progress"' in text
