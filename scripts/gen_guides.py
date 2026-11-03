#!/usr/bin/env python3
"""Generate labs/guided/*.md and the in-page guide module from the module source.

The guided labs are rendered from the very metadata the app serves, so a
written guide can never drift from the lab it documents. Besides the markdown
files (documentation / repo browsing), the same content is emitted as
``frontend/src/content/guides.js`` so the application renders the complete
guide **inside the lab page** - no external links, works offline.

Usage (from the repository root, after `pip install -r backend/requirements-dev.txt`):

    python scripts/gen_guides.py
"""
from __future__ import annotations

import json
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
FRONTEND_OUT = ROOT / "frontend" / "src" / "content" / "guides.js"

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
    a("2. Read the **Learn** tab first: it carries the objectives, the threat model and the")
    a("   mitigation for this lab.")
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
        a("Click a payload button on the **Exploit** tab or type the payload yourself. Compare the")
        a("vulnerable result with the secure result every time.")
        a("")
    a("## Expected outcome")
    a("")
    a(module.expected_outcome)
    a("")
    a("## Capture the flag")
    a("")
    a(module.challenge)
    a("")
    a("Submit it in the lab's **Validate** tab - press Enter or use the button. If you get stuck,")
    a("the **Exploit** tab reveals hints one at a time (advanced labs have none). Flags are derived")
    a("per installation with HMAC, so yours is unique to this deployment - do not expect to copy")
    a("it from anywhere else.")
    a("")
    a(f"## This lab's level: {module.difficulty}")
    a("")
    a("- **Beginner** - guided steps on the Learn tab, one-click example payloads on the Exploit tab.")
    a("- **Intermediate** - no guided steps and no ready-made payloads; hints unlock one at a time.")
    a("- **Advanced** - no hints, no samples, and textbook payloads are rejected by the server, so the")
    a("  attack has to be your own. Fix-It is required to count the lab as finished.")
    a("")
    a(f"This lab is set to **{module.difficulty}**.")
    a("")
    a("## Point value")
    a("")
    a("Every lab is worth **260 points**: +10 for running the vulnerable implementation,")
    a("+100 for capturing the flag and +150 for passing Fix-It. The same table drives the global")
    a("leaderboard, and your score for this lab is shown in the right-hand rail.")
    a("")
    a("## Fix it")
    a("")
    a(f"**{spec.TITLE}** - {spec.BRIEF}")
    a("")
    a(f"Open the **Validate** tab, edit `{spec.FUNC_NAME}()` and submit. Your code runs in a")
    a("resource-limited sandbox against deterministic attack tests: it must stop every attack and")
    a("still behave correctly for benign input. The per-check pass/fail list is the verdict; any")
    a("LLM note under it is advisory only.")
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
    a("- [ ] Captured the flag and submitted it (+100)")
    a("- [ ] Passed Fix-It validation with your own remediation (+150)")
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
    a("1. Open the lab in the application (**Labs** -> pick a module).")
    a("2. Follow the guide side by side with the Learn and Exploit tabs.")
    a("3. Use the payload table where the lab has one, compare vulnerable vs. secure output, then")
    a("   read the Code tab.")
    a("4. Submit the flag, then rewrite the vulnerable function and pass Fix-It validation.")
    a("5. Every lab is worth 260 points (+10 run, +100 flag, +150 Fix-It); totals feed the")
    a("   global leaderboard.")
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
    guides: dict[str, str] = {}
    for module in MODULES:
        path = OUT / f"{module.id}.md"
        text = guide(module)
        path.write_text(text, encoding="utf-8")
        guides[module.id] = text
        written.append(path)
    readme = OUT / "README.md"
    readme.write_text(index(), encoding="utf-8")
    written.append(readme)
    # In-page copy: the app renders these strings on each lab's Guide tab.
    FRONTEND_OUT.parent.mkdir(parents=True, exist_ok=True)
    FRONTEND_OUT.write_text(
        "// Generated by scripts/gen_guides.py - do not edit by hand.\n"
        f"export const GUIDES = {json.dumps(guides, ensure_ascii=False, indent=0)}\n",
        encoding="utf-8",
    )
    written.append(FRONTEND_OUT)
    for path in written:
        print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
