#!/usr/bin/env python3
"""Create one companion course for each of the twenty-two labs.

The local SQLite store is the default target. A deployment that has Supabase
configuration present must opt in explicitly with ``--allow-remote`` so this
development helper cannot publish courses to production by accident.

Usage (from the repository root):

    python scripts/seed_courses.py
    python scripts/seed_courses.py --update
    python scripts/seed_courses.py --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services import course_seed, course_service, db, supabase_store  # noqa: E402
from app.vulnerabilities import MODULES  # noqa: E402


async def run(*, update: bool, dry_run: bool, allow_remote: bool) -> int:
    if supabase_store.configured() and not allow_remote:
        print(
            "Supabase is configured. Refusing to write to the remote database; "
            "pass --allow-remote after verifying the target.",
            file=sys.stderr,
        )
        return 2

    if dry_run:
        for module in MODULES:
            parsed = course_service.parse_course(course_seed.build_lab_course(module))
            print(f"would seed {parsed.slug}: {parsed.title} ({len(parsed.lessons)} lessons)")
        print(f"{len(MODULES)} courses validated; no rows written.")
        return 0

    await asyncio.to_thread(db.init)
    result = await course_seed.seed_catalog(update=update)
    print(
        f"created={len(result['created'])} updated={len(result['updated'])} "
        f"skipped={len(result['skipped'])} failed={len(result['failed'])}"
    )
    for label in ("created", "updated", "skipped"):
        for slug in result[label]:
            print(f"  {label}: {slug}")
    for failure in result["failed"]:
        print(f"  failed: {failure['slug']}: {failure['error']}", file=sys.stderr)
    return 1 if result["failed"] else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--update", action="store_true", help="Refresh existing seeded courses in place.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print the courses without writing.")
    parser.add_argument("--allow-remote", action="store_true", help="Permit writes when Supabase is configured.")
    args = parser.parse_args()
    return asyncio.run(run(update=args.update, dry_run=args.dry_run, allow_remote=args.allow_remote))


if __name__ == "__main__":
    raise SystemExit(main())
