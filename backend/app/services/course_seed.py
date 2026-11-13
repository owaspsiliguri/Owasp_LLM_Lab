"""Deterministic companion courses for the twenty-two labs.

The course body is derived from the same metadata the lab serves, so a generated
course cannot drift from the target it documents. Seeding is idempotent by slug:
an existing course is skipped unless ``update=True``, and an update never changes
its publication status or learner completions.

Run ``python scripts/seed_courses.py`` to create the missing courses locally.
The script refuses to write to Supabase unless ``--allow-remote`` is passed, so a
development command cannot silently publish content to production.
"""
from __future__ import annotations

from typing import Any

import yaml

from app.services import course_service, platform_store


def course_slug(module: Any) -> str:
    return f"{module.id}-essentials"


def course_title(module: Any) -> str:
    return f"{module.name} Essentials"


def _clean(value: Any) -> str:
    return " ".join(str(value or "").split())


def _inline(value: Any) -> str:
    """Keep metadata safe inside an inline Markdown code span."""
    return _clean(value).replace("`", "'")


def _bullets(items: Any) -> str:
    rows = [_clean(item) for item in (items or []) if _clean(item)]
    return "\n".join(f"- {row}" for row in rows) or "- None beyond the lab brief."


def _steps(items: Any) -> str:
    rows = [_clean(item) for item in (items or []) if _clean(item)]
    return "\n".join(f"{index}. {row}" for index, row in enumerate(rows, 1)) or (
        "This lab intentionally ships without step-by-step hints. Work the mechanism "
        "out from the target's responses and the Code tab."
    )


def _payloads(items: Any) -> str:
    rows = []
    for payload in items or []:
        label = _inline(payload.get("label", "Example"))
        variant = _inline(payload.get("variant", ""))
        suffix = f" ({variant})" if variant else ""
        rows.append(f"- **{label}**{suffix}: `{_inline(payload.get('input', ''))}`")
    return "\n".join(rows) or (
        "No sample payloads are provided. Advanced labs expect you to build the attack "
        "yourself from the mechanism described above."
    )


def build_lab_course(module: Any) -> str:
    """Return a complete Markdown course source for one vulnerability module."""
    spec = module.fixit_spec()
    metadata = {
        "title": course_title(module),
        "slug": course_slug(module),
        "description": (
            f"A guided companion to the {module.name} lab. Understand the failure, "
            "exploit the live target, and prove a remediation the server sandbox validates."
        ),
        "category": module.category,
        "difficulty": module.difficulty,
        "estimated_minutes": max(20, min(600, int(module.estimated_minutes) + 15)),
    }
    frontmatter = yaml.safe_dump(metadata, sort_keys=False, allow_unicode=True, width=1000).strip()

    lines = [
        "---",
        frontmatter,
        "---",
        "",
        (
            f"This course accompanies the **{module.name}** lab. Each lesson maps to a step "
            "in the live target: read the mechanism, run the exploit, then prove the control "
            "in Fix-It. The lab awards 100 points for the flag and 150 points for a validated "
            "fix, for 250 points in total."
        ),
        "",
        "## Understand the failure",
        "",
        _clean(module.overview),
        "",
        f"**Threat:** {_clean(module.threat)}",
        "",
        f"**Impact if exploited:** {_clean(module.impact)}",
        "",
        "### Learning objectives",
        "",
        _bullets(module.objectives),
        "",
        "### Prerequisites",
        "",
        _bullets(module.prerequisites),
        "",
        "## Exploit the vulnerable build",
        "",
        "Open the lab and run the vulnerable build first. Read what the target returns, then "
        "change one variable at a time until the failure is reproducible.",
        "",
        f"**Challenge:** {_clean(module.challenge)}",
        "",
        "### Guided walkthrough",
        "",
        _steps(module.guided_steps),
        "",
        "### Example payloads",
        "",
        _payloads(module.example_payloads),
        "",
        "### What success looks like",
        "",
        _clean(module.expected_outcome),
        "",
        "Submit the flag in the lab's flag form. It is validated server-side and recorded once; "
        "a message that merely looks like an attack earns nothing.",
        "",
        "## Apply the control",
        "",
        "### Mitigations",
        "",
        _bullets(module.mitigation),
        "",
        _clean(module.remediation),
        "",
        "Defence in depth matters here: a single input filter is not a security boundary. Keep "
        "trusted instructions separate from untrusted data, enforce authorization in server-side "
        "code, and treat every model output as untrusted input for the next system.",
        "",
        "## Prove the fix",
        "",
        f"**Fix-It: {_clean(spec.TITLE)}**",
        "",
        _clean(spec.BRIEF),
        "",
        f"Open the lab's **Fix-It** tab and implement `{_clean(spec.FUNC_NAME)}()`. The server "
        "replays the original attack and runs regression checks, so a shortcut that breaks "
        "legitimate input does not pass. The per-check list is the verdict; a passing patch is "
        "worth 150 points and is recorded once.",
        "",
        "### Completion checklist",
        "",
        "- [ ] Ran the vulnerable implementation and observed the failure",
        "- [ ] Reproduced it with more than one input",
        "- [ ] Ran the secure implementation and identified the control that fired",
        "- [ ] Compared the vulnerable and secure source in the Code tab",
        "- [ ] Captured the flag and submitted it (100 points)",
        "- [ ] Passed Fix-It with a remediation of my own (150 points)",
        "",
        "## Check your understanding",
        "",
        "- Where exactly does trusted instruction text meet untrusted input in this lab?",
        "- Which control in the secure build stops the original payload, and what does it still not cover?",
        "- What evidence would you log or alert on in production without storing the secret itself?",
        "- Why is blocking one known payload different from fixing the underlying vulnerability?",
        "",
        (
            "Continue with the [OWASP Top 10 for LLM Applications]"
            "(https://genai.owasp.org/llm-top-10/) and reopen the "
            f"[{module.name} lab](/labs/{module.id})."
        ),
        "",
    ]
    return "\n".join(lines)


async def seed_catalog(*, update: bool = False, created_by: str | None = None) -> dict[str, list[str]]:
    """Create the missing lab courses and return what happened, by slug.

    Existing rows are skipped by default. ``update=True`` refreshes their source
    and lessons while preserving status, publication time and completions.
    """
    from app.vulnerabilities import MODULES  # local import keeps module startup light

    created: list[str] = []
    updated: list[str] = []
    skipped: list[str] = []
    failed: list[dict[str, str]] = []

    for module in MODULES:
        source = build_lab_course(module)
        try:
            parsed = course_service.parse_course(source)
        except course_service.CourseValidationError as exc:  # generator bug, not user input
            failed.append({"slug": course_slug(module), "error": str(exc)})
            continue

        existing = await platform_store.get_course_by_slug(parsed.slug, published_only=False)
        fields = {
            "slug": parsed.slug,
            "title": parsed.title,
            "description": parsed.description,
            "category": parsed.category,
            "difficulty": parsed.difficulty,
            "estimated_minutes": parsed.estimated_minutes,
            "source_markdown": parsed.source_markdown,
            "checksum": parsed.checksum,
        }
        if existing:
            if not update:
                skipped.append(parsed.slug)
                continue
            saved = await platform_store.update_course(existing["id"], fields, parsed.lessons)
            if saved:
                updated.append(parsed.slug)
            else:
                failed.append({"slug": parsed.slug, "error": "update failed"})
            continue

        record, lessons = course_service.course_record(parsed, created_by=created_by, status="published")
        saved = await platform_store.create_course(record, lessons)
        if saved:
            created.append(parsed.slug)
        else:
            failed.append({"slug": parsed.slug, "error": "create failed (slug conflict or database unavailable)"})

    return {"created": created, "updated": updated, "skipped": skipped, "failed": failed}
