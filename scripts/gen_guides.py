#!/usr/bin/env python3
"""Generate labs/guided/*.md from the module source.

The guided labs are rendered from the very metadata the app serves, so a
written guide can never drift from the lab it documents.

Usage (from the repository root, after `pip install -r backend/requirements-dev.txt`):

    python scripts/gen_guides.py
"""
from __future__ import annotations

import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

if sys.platform == "win32":
    # The Fix-It sandbox imports the Unix-only `resource` module at import
    # time. This script only reads metadata, so a stub keeps it runnable on
    # Windows; run the real tests under WSL or Docker instead.
    sys.modules.setdefault("resource", types.ModuleType("resource"))

from app.vulnerabilities import MODULES  # noqa: E402

OUT = ROOT / "labs" / "guided"

ORDER_NOTE = (
    "Recommended order for the whole path: llm01, llm02, llm10, llm03, llm05, llm04, "
    "llm06, llm07, llm09, llm08."
)


def md_escape(text: str) -> str:
    return text.replace("|", "\\|")


def fence(text: str) -> str:
    return "```text\n" + text + "\n```"


def guide(module) -> str:
    spec = module.fixit_spec()
    lines: list[str] = []
    a = lines.append
    a(f"# {module.owasp_id} guided lab - {module.name}")
    a("")
    a(f"> **Difficulty:** {module.difficulty} | **Time:** ~{module.estimated_minutes} minutes | "
      f"**OWASP mapping:** {module.category}")
    a(f"> **Prerequisites:** {', '.join(module.prerequisites)}")
    a("")
    a("> Proposed by OWASP Siliguri; not an official OWASP project. Run this lab only against the")
    a("> local training application.")
    a("")
    a("## Why this matters")
    a("")
    a(module.overview)
    a("")
    a(f"**Threat:** {module.threat}")
    a("")
    a(f"**Impact if exploited:** {module.impact}")
    a("")
    a("## Learning objectives")
    a("")
    for objective in module.objectives:
        a(f"- {objective}")
    a("")
    a("## Before you start")
    a("")
    a(f"1. Open the lab in the application: **Labs -> {module.name}**.")
    a("2. Keep the learning mode on **Beginner** for the guided walkthrough; the app shows these")
    a("   guided steps inline on the Learn tab.")
    a("3. Everything runs locally. Do not try these payloads against any system you do not own.")
    a("")
    a("## Guided walkthrough")
    a("")
    for i, step in enumerate(module.guided_steps, 1):
        a(f"{i}. {step}")
    a("")
    if module.variants:
        a(f"## Variants ({module.variant_label})")
        a("")
        a(f"The lab lets you switch the target with the **{module.variant_label}** selector:")
        a("")
        for variant in module.variants:
            help_text = module.variant_help.get(variant, "")
            a(f"- **{variant}** - {help_text}" if help_text else f"- **{variant}**")
        a("")
    if module.example_payloads:
        a("## Attack payloads to try")
        a("")
        a("| Payload | Variant | What to send |")
        a("|---|---|---|")
        for payload in module.example_payloads:
            variant = payload.get("variant") or ("-")
            sent = md_escape(payload["input"]).replace("`", "'")
            a(f"| {md_escape(payload['label'])} | {variant} | `{sent}` |")
        a("")
        a("Click the payload button in the app (Beginner mode shows them on the Exploit tab) or type")
        a("them yourself. Compare the vulnerable result with the secure result every time.")
        a("")
    a("## Expected outcome")
    a("")
    a(module.expected_outcome)
    a("")
    a("## Capture the flag")
    a("")
    a(module.challenge)
    a("")
    a("Submit it in the lab's **Validate** tab (Intermediate mode reveals hints one at a time if you")
    a("get stuck). Flags are derived per installation with HMAC, so yours is unique to this")
    a("deployment - do not expect to copy it from anywhere else.")
    a("")
    a("## Fix it (Advanced mode)")
    a("")
    a(f"**{spec.TITLE}** - {spec.BRIEF}")
    a("")
    a(f"Open the **Validate** tab in Advanced mode, edit `{spec.FUNC_NAME}()` and submit. Your code")
    a("runs in a resource-limited sandbox against deterministic attack tests: it must stop every")
    a("attack and still behave correctly for benign input.")
    a("")
    a("## Mitigations to apply")
    a("")
    for item in module.mitigation:
        a(f"- {item}")
    a("")
    a(module.remediation)
    a("")
    a("## Completion checklist")
    a("")
    a("- [ ] Ran the vulnerable implementation and observed the failure")
    a("- [ ] Reproduced it with at least two different payloads")
    a("- [ ] Ran the secure implementation and identified the control that stopped the attack")
    a("- [ ] Compared the vulnerable and secure source in the Code tab")
    a("- [ ] Captured the flag and submitted it")
    a("- [ ] Passed Fix-It validation with your own remediation")
    a("")
    a("---")
    a("")
    a(f"*Generated from the module source by `scripts/gen_guides.py`. Edit `{module.id}.py` or the")
    a("fix-it spec, then regenerate - do not edit this file by hand.*")
    a("")
    return "\n".join(lines)


def index() -> str:
    lines: list[str] = []
    a = lines.append
    a("# Guided labs")
    a("")
    a("One hands-on, step-by-step lab per OWASP Top 10 for LLM Applications risk. Each guide walks")
    a("through the same loop the platform teaches: **learn -> exploit -> understand -> fix ->")
    a("validate**.")
    a("")
    a(ORDER_NOTE)
    a("")
    a("| # | Lab | OWASP | Difficulty | Guide |")
    a("|---|---|---|---|---|")
    for i, m in enumerate(MODULES, 1):
        a(f"| {i} | {m.name} | {m.owasp_id} | {m.difficulty} | [{m.id}.md]({m.id}.md) |")
    a("")
    a("## How to use a guide")
    a("")
    a("1. Open the lab in the application (**Labs** -> pick a module), mode **Beginner**.")
    a("2. Follow the guide side by side with the Learn and Exploit tabs.")
    a("3. Use the payload table, compare vulnerable vs. secure output, then read the Code tab.")
    a("4. Submit the flag (Intermediate), then fix the code and pass Fix-It validation (Advanced).")
    a("")
    a("The guides contain no flags: every installation derives its own with HMAC.")
    a("")
    a("---")
    a("")
    a("*Generated by `scripts/gen_guides.py` from the module source.*")
    a("")
    return "\n".join(lines)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    written = []
    for module in MODULES:
        path = OUT / f"{module.id}.md"
        path.write_text(guide(module), encoding="utf-8")
        written.append(path)
    readme = OUT / "README.md"
    readme.write_text(index(), encoding="utf-8")
    written.append(readme)
    for path in written:
        print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
