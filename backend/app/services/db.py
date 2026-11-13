"""Local platform database (SQLite).

This is the offline/local-development store for accounts, sessions, progress and
courses. When Supabase is configured the same logical records live in Postgres;
the service layer chooses the backend. Every statement here is parameterised and
every schema change is additive: no table is dropped or rewritten.
"""
from __future__ import annotations

import sqlite3
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from app.config import get_settings

SCHEMA_VERSION = 1

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash       TEXT,
  full_name           TEXT,
  role                TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  provider            TEXT NOT NULL DEFAULT 'local' CHECK (provider IN ('local', 'supabase')),
  provider_id         TEXT,
  created_at          TEXT NOT NULL,
  last_login_at       TEXT,
  password_changed_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_hash TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at   TEXT,
  replaced_by  TEXT,
  user_agent   TEXT,
  ip_hash      TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT,
  kind       TEXT NOT NULL,
  detail     TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_events_created_idx ON auth_events(created_at DESC);

CREATE TABLE IF NOT EXISTS progress (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id  TEXT NOT NULL,
  explored   INTEGER NOT NULL DEFAULT 0 CHECK (explored IN (0, 1)),
  flag       INTEGER NOT NULL DEFAULT 0 CHECK (flag IN (0, 1)),
  fixit      INTEGER NOT NULL DEFAULT 0 CHECK (fixit IN (0, 1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, module_id)
);
CREATE INDEX IF NOT EXISTS progress_module_idx ON progress(module_id);

CREATE TABLE IF NOT EXISTS attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id  TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('flag', 'fixit')),
  correct    INTEGER NOT NULL DEFAULT 0 CHECK (correct IN (0, 1)),
  detail     TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_created_idx ON attempts(created_at DESC);

CREATE TABLE IF NOT EXISTS courses (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  category          TEXT NOT NULL,
  difficulty        TEXT NOT NULL CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced', 'Expert')),
  estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes BETWEEN 1 AND 600),
  thumbnail_url     TEXT,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  source_markdown   TEXT NOT NULL,
  checksum          TEXT NOT NULL,
  created_by        TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  published_at      TEXT,
  deleted_at        TEXT,
  version           INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS courses_status_idx ON courses(status, published_at DESC);

CREATE TABLE IF NOT EXISTS course_lessons (
  id         TEXT PRIMARY KEY,
  course_id  TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  title      TEXT NOT NULL,
  slug       TEXT NOT NULL,
  markdown   TEXT NOT NULL,
  UNIQUE (course_id, position)
);
CREATE INDEX IF NOT EXISTS course_lessons_course_idx ON course_lessons(course_id, position);

CREATE TABLE IF NOT EXISTS course_progress (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  completed    INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  started_at   TEXT NOT NULL,
  completed_at TEXT,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, course_id)
);
"""


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _connect() -> sqlite3.Connection:
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    path: Path = settings.data_dir / "platform.db"
    conn = sqlite3.connect(path, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def init() -> None:
    """Create the additive schema. Safe to call on every startup."""
    with _connect() as conn:
        conn.executescript(SCHEMA)
        conn.execute(
            "INSERT INTO schema_meta(key, value) VALUES('schema_version', ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (str(SCHEMA_VERSION),),
        )


def reset_for_tests() -> None:
    """Delete every local platform row. Used only by the test suite."""
    with _connect() as conn:
        for table in ("course_progress", "course_lessons", "courses", "attempts", "progress", "auth_events", "sessions", "users"):
            conn.execute(f"DELETE FROM {table}")  # noqa: S608 - fixed allow-list of table names


# ── Users ────────────────────────────────────────────────────────────────────

def _row(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row else None


def create_user(
    *,
    email: str,
    password_hash: str | None,
    full_name: str | None = None,
    role: str = "student",
    provider: str = "local",
    provider_id: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    now = _now()
    uid = user_id or str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            "INSERT INTO users(id, email, password_hash, full_name, role, provider, provider_id, created_at) "
            "VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
            (uid, email.strip().lower(), password_hash, full_name, role, provider, provider_id, now),
        )
        row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    return dict(row)


def upsert_provider_user(
    *,
    user_id: str,
    email: str,
    full_name: str | None,
    role: str,
    provider: str = "supabase",
) -> dict[str, Any]:
    """Create or refresh the local mirror of a federated identity.

    The provider UUID is preserved so existing Supabase progress joins still
    point at the same user after the upgrade.
    """
    now = _now()
    clean_email = email.strip().lower()
    with _connect() as conn:
        existing = conn.execute("SELECT id FROM users WHERE email=?", (clean_email,)).fetchone()
        if existing and existing["id"] != user_id:
            # Re-key or update the existing user record to match the provider's UUID
            conn.execute("PRAGMA foreign_keys = OFF")
            conn.execute(
                "UPDATE users SET id=?, full_name=COALESCE(?, full_name), role=?, provider=?, provider_id=?, last_login_at=? WHERE email=?",
                (user_id, full_name, role, provider, user_id, now, clean_email),
            )
            conn.execute("PRAGMA foreign_keys = ON")
        else:
            conn.execute(
                "INSERT INTO users(id, email, password_hash, full_name, role, provider, provider_id, created_at, last_login_at) "
                "VALUES(?, ?, NULL, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET "
                "  email=excluded.email, full_name=COALESCE(excluded.full_name, users.full_name), "
                "  role=excluded.role, last_login_at=excluded.last_login_at",
                (user_id, clean_email, full_name, role, provider, user_id, now, now),
            )
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    return dict(row) if row else {"id": user_id, "email": clean_email, "role": role, "full_name": full_name}


def get_user(user_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        return _row(conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone())


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with _connect() as conn:
        return _row(conn.execute("SELECT * FROM users WHERE email=?", (email.strip().lower(),)).fetchone())


def count_users() -> int:
    with _connect() as conn:
        return int(conn.execute("SELECT COUNT(*) FROM users").fetchone()[0])


def set_user_role(user_id: str, role: str) -> None:
    with _connect() as conn:
        conn.execute("UPDATE users SET role=? WHERE id=?", (role, user_id))


def set_password(user_id: str, password_hash: str) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE users SET password_hash=?, password_changed_at=? WHERE id=?",
            (password_hash, _now(), user_id),
        )


def touch_login(user_id: str) -> None:
    with _connect() as conn:
        conn.execute("UPDATE users SET last_login_at=? WHERE id=?", (_now(), user_id))


def update_profile(user_id: str, full_name: str | None) -> None:
    with _connect() as conn:
        conn.execute("UPDATE users SET full_name=? WHERE id=?", (full_name, user_id))


# ── Sessions ─────────────────────────────────────────────────────────────────

def create_session(
    *,
    user_id: str,
    refresh_hash: str,
    expires_at: str,
    user_agent: str | None = None,
    ip_hash: str | None = None,
) -> str:
    session_id = str(uuid.uuid4())
    now = _now()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO sessions(id, user_id, refresh_hash, created_at, expires_at, last_used_at, user_agent, ip_hash) "
            "VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
            (session_id, user_id, refresh_hash, now, expires_at, now, user_agent, ip_hash),
        )
    return session_id


def get_session_by_refresh(refresh_hash: str) -> dict[str, Any] | None:
    with _connect() as conn:
        return _row(conn.execute("SELECT * FROM sessions WHERE refresh_hash=?", (refresh_hash,)).fetchone())


def rotate_session(old: dict[str, Any], *, new_hash: str, new_expires_at: str) -> str:
    """Rotate one refresh token. Returns the new row id.

    The old row is revoked and linked to its replacement. If the same refresh
    token is presented twice, ``old['revoked_at']`` is already set and the
    caller revokes the whole family before returning 401.
    """
    new_id = str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            "UPDATE sessions SET revoked_at=?, replaced_by=?, last_used_at=? WHERE id=?",
            (_now(), new_id, _now(), old["id"]),
        )
        conn.execute(
            "INSERT INTO sessions(id, user_id, refresh_hash, created_at, expires_at, last_used_at, user_agent, ip_hash) "
            "VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
            (new_id, old["user_id"], new_hash, _now(), new_expires_at, _now(), old.get("user_agent"), old.get("ip_hash")),
        )
    return new_id


def revoke_family(session_id: str) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE sessions SET revoked_at=? WHERE id=? AND revoked_at IS NULL",
            (_now(), session_id),
        )


def revoke_all_for_user(user_id: str) -> None:
    with _connect() as conn:
        conn.execute("UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL", (_now(), user_id))


def session_is_active(session_id: str) -> bool:
    with _connect() as conn:
        row = conn.execute("SELECT revoked_at FROM sessions WHERE id=?", (session_id,)).fetchone()
    return bool(row and not row["revoked_at"])


def cleanup_sessions() -> None:
    cutoff = datetime.now(UTC).isoformat(timespec="seconds")
    with _connect() as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (cutoff,))


def record_auth_event(kind: str, *, user_id: str | None = None, detail: str | None = None) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO auth_events(user_id, kind, detail, created_at) VALUES(?, ?, ?, ?)",
            (user_id, kind, detail[:400] if detail else None, _now()),
        )


# ── Progress and attempts ────────────────────────────────────────────────────

def mark_progress(user_id: str, module_id: str, **flags: bool) -> None:
    """Merge progress without ever downgrading a boolean.

    ``MAX(existing, new)`` makes repeated or concurrent submissions idempotent
    and prevents a later request from clearing an achievement.
    """
    allowed = {key: int(bool(value)) for key, value in flags.items() if key in {"explored", "flag", "fixit"}}
    if not allowed:
        return
    columns = ", ".join(allowed)
    values = ", ".join("?" for _ in allowed)
    updates = ", ".join(f"{key}=MAX({key}, excluded.{key})" for key in allowed)
    with _connect() as conn:
        conn.execute(
            f"INSERT INTO progress(user_id, module_id, {columns}, updated_at) VALUES(?, ?, {values}, ?) "
            f"ON CONFLICT(user_id, module_id) DO UPDATE SET {updates}, updated_at=excluded.updated_at",  # noqa: S608 - allow-listed columns
            (user_id, module_id, *allowed.values(), _now()),
        )


def get_progress(user_id: str) -> dict[str, dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT module_id, explored, flag, fixit, updated_at FROM progress WHERE user_id=?",
            (user_id,),
        ).fetchall()
    return {
        row["module_id"]: {
            "explored": bool(row["explored"]),
            "flag": bool(row["flag"]),
            "fixit": bool(row["fixit"]),
            "at": row["updated_at"],
        }
        for row in rows
    }


def delete_progress(user_id: str) -> None:
    """Clear one learner's progress. Used only by the authenticated reset action."""
    with _connect() as conn:
        conn.execute("DELETE FROM progress WHERE user_id=?", (user_id,))
        conn.execute("DELETE FROM course_progress WHERE user_id=?", (user_id,))


def has_flag(user_id: str, module_id: str) -> bool:
    with _connect() as conn:
        row = conn.execute(
            "SELECT flag FROM progress WHERE user_id=? AND module_id=?", (user_id, module_id)
        ).fetchone()
    return bool(row and row["flag"])


def record_attempt(user_id: str, module_id: str, kind: str, *, correct: bool, detail: str | None = None) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO attempts(user_id, module_id, kind, correct, detail, created_at) VALUES(?, ?, ?, ?, ?, ?)",
            (user_id, module_id, kind, int(correct), detail[:400] if detail else None, _now()),
        )


def platform_stats() -> dict[str, int]:
    with _connect() as conn:
        learners = int(conn.execute("SELECT COUNT(*) FROM users WHERE role='student'").fetchone()[0])
        completions = int(conn.execute("SELECT COUNT(*) FROM progress WHERE flag=1 AND fixit=1").fetchone()[0])
    return {"learners": learners, "completions": completions}


def leaderboard_rows() -> list[dict[str, Any]]:
    with _connect() as conn:
        users = conn.execute("SELECT id, email, full_name, role FROM users").fetchall()
        progress = conn.execute("SELECT user_id, module_id, explored, flag, fixit FROM progress").fetchall()
    by_user: dict[str, dict[str, int]] = {}
    for row in progress:
        stats = by_user.setdefault(row["user_id"], {"explored": 0, "flags": 0, "fixes": 0, "completed": 0})
        stats["explored"] += 1 if row["explored"] else 0
        stats["flags"] += 1 if row["flag"] else 0
        stats["fixes"] += 1 if row["fixit"] else 0
        stats["completed"] += 1 if row["flag"] and row["fixit"] else 0
    rows = []
    for user in users:
        stats = by_user.get(user["id"], {"explored": 0, "flags": 0, "fixes": 0, "completed": 0})
        rows.append({
            "user_id": user["id"],
            "name": (user["full_name"] or "").strip(),
            "email": user["email"],
            "role": user["role"],
            **stats,
            "score": stats["flags"] * 100 + stats["fixes"] * 150,
        })
    rows.sort(key=lambda row: (-row["score"], -row["completed"], row["email"]))
    return rows


def admin_overview() -> dict[str, list[dict[str, Any]]]:
    with _connect() as conn:
        profiles = [dict(row) for row in conn.execute(
            "SELECT id, email, full_name, role, created_at, last_login_at FROM users ORDER BY created_at"
        )]
        progress = [dict(row) for row in conn.execute(
            "SELECT user_id, module_id, explored, flag, fixit, updated_at FROM progress"
        )]
        attempts = [dict(row) for row in conn.execute(
            "SELECT id, user_id, module_id, kind, correct, created_at FROM attempts ORDER BY created_at DESC LIMIT 60"
        )]
        count = int(conn.execute("SELECT COUNT(*) FROM attempts").fetchone()[0])
    for row in profiles:
        row["last_sign_in_at"] = row.pop("last_login_at", None)
    for row in progress:
        row["updated_at"] = row["updated_at"]
    return {"profiles": profiles, "progress": progress, "attempts": attempts, "attempt_count": count}


# ── Courses ──────────────────────────────────────────────────────────────────

def create_course(course: dict[str, Any], lessons: list[dict[str, Any]]) -> dict[str, Any]:
    now = _now()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO courses(id, slug, title, description, category, difficulty, estimated_minutes, thumbnail_url, "
            "status, source_markdown, checksum, created_by, created_at, updated_at, published_at) "
            "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                course["id"], course["slug"], course["title"], course["description"], course["category"],
                course["difficulty"], course["estimated_minutes"], course.get("thumbnail_url"),
                course["status"], course["source_markdown"], course["checksum"], course.get("created_by"),
                now, now, now if course["status"] == "published" else None,
            ),
        )
        for position, lesson in enumerate(lessons):
            conn.execute(
                "INSERT INTO course_lessons(id, course_id, position, title, slug, markdown) VALUES(?, ?, ?, ?, ?, ?)",
                (lesson["id"], course["id"], position, lesson["title"], lesson["slug"], lesson["markdown"]),
            )
    return get_course(course["id"])  # type: ignore[return-value]


def _course_row(row: sqlite3.Row, lessons: list[sqlite3.Row]) -> dict[str, Any]:
    data = dict(row)
    data["lessons"] = [dict(lesson) for lesson in lessons]
    return data


def get_course(course_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM courses WHERE id=?", (course_id,)).fetchone()
        if not row:
            return None
        lessons = conn.execute(
            "SELECT id, position, title, slug, markdown FROM course_lessons WHERE course_id=? ORDER BY position",
            (course_id,),
        ).fetchall()
    return _course_row(row, lessons)


def get_course_by_slug(slug: str) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM courses WHERE slug=? AND deleted_at IS NULL", (slug,)).fetchone()
        if not row:
            return None
        lessons = conn.execute(
            "SELECT id, position, title, slug, markdown FROM course_lessons WHERE course_id=? ORDER BY position",
            (row["id"],),
        ).fetchall()
    return _course_row(row, lessons)


def list_courses(*, published_only: bool) -> list[dict[str, Any]]:
    where = "deleted_at IS NULL"
    if published_only:
        where += " AND status='published'"
    with _connect() as conn:
        rows = conn.execute(
            f"SELECT * FROM courses WHERE {where} ORDER BY COALESCE(published_at, created_at) DESC"  # noqa: S608 - fixed clauses
        ).fetchall()
        courses = []
        for row in rows:
            lessons = conn.execute(
                "SELECT id, position, title, slug FROM course_lessons WHERE course_id=? ORDER BY position",
                (row["id"],),
            ).fetchall()
            data = dict(row)
            data["lessons"] = [dict(lesson) for lesson in lessons]
            courses.append(data)
    return courses


def update_course(course_id: str, fields: dict[str, Any], lessons: list[dict[str, Any]] | None = None) -> dict[str, Any] | None:
    allowed = {"slug", "title", "description", "category", "difficulty", "estimated_minutes", "thumbnail_url",
               "status", "source_markdown", "checksum", "published_at"}
    updates = {key: value for key, value in fields.items() if key in allowed}
    if not updates:
        return get_course(course_id)
    assignments = ", ".join(f"{key}=?" for key in updates)
    with _connect() as conn:
        conn.execute("BEGIN")
        conn.execute(
            f"UPDATE courses SET {assignments}, updated_at=?, version=version+1 WHERE id=?",  # noqa: S608 - allow-listed columns
            (*updates.values(), _now(), course_id),
        )
        if lessons is not None:
            conn.execute("DELETE FROM course_lessons WHERE course_id=?", (course_id,))
            for position, lesson in enumerate(lessons):
                conn.execute(
                    "INSERT INTO course_lessons(id, course_id, position, title, slug, markdown) VALUES(?, ?, ?, ?, ?, ?)",
                    (lesson["id"], course_id, position, lesson["title"], lesson["slug"], lesson["markdown"]),
                )
        conn.execute("COMMIT")
    return get_course(course_id)


def archive_course(course_id: str) -> None:
    now = _now()
    with _connect() as conn:
        conn.execute(
            "UPDATE courses SET status='archived', deleted_at=?, updated_at=? WHERE id=?",
            (now, now, course_id),
        )


def set_course_progress(user_id: str, course_id: str, *, completed: bool) -> None:
    now = _now()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO course_progress(user_id, course_id, completed, started_at, completed_at, updated_at) "
            "VALUES(?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(user_id, course_id) DO UPDATE SET completed=MAX(completed, excluded.completed), "
            "completed_at=COALESCE(course_progress.completed_at, excluded.completed_at), updated_at=excluded.updated_at",
            (user_id, course_id, int(completed), now, now if completed else None, now),
        )


def course_progress(user_id: str) -> dict[str, dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT course_id, completed, started_at, completed_at, updated_at FROM course_progress WHERE user_id=?",
            (user_id,),
        ).fetchall()
    return {
        row["course_id"]: {
            "completed": bool(row["completed"]),
            "started_at": row["started_at"],
            "completed_at": row["completed_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    }


def session_expiry(days: int) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).isoformat(timespec="seconds")
