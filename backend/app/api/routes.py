from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from app.core.auth import OptionalUser
from app.core.redaction import scrub
from app.models.schemas import FixRequest, FlagRequest, RunRequest
from app.services import engine as eng
from app.services import judge, llm_clients, vectorstore
from app.services import supabase_store as store
from app.vulnerabilities import MODULES, REGISTRY
from app.vulnerabilities.base import ModuleInputError, VulnerabilityModule

router = APIRouter()
log = logging.getLogger("lab.api")


def _failure_brief(result: dict[str, Any]) -> str:
    """Deterministic description of a failed Fix-It run.

    The sandbox tests are authoritative, so the feedback the learner sees is
    derived from them: the names of the checks that failed and why. An LLM
    review is only ever added on top of this as advisory prose.
    """
    tests = result.get("tests") or []
    failed = [t for t in tests if not t.get("passed")]
    if failed:
        lines = [f"- {t.get('name')}" + (f" ({t['detail']})" if t.get("detail") else "") for t in failed[:12]]
        return f"{len(failed)} of {len(tests)} checks failed:\n" + "\n".join(lines)
    return str(result.get("error") or "the sandbox reported no passing result")


def _get(module_id: str) -> VulnerabilityModule:
    module = REGISTRY.get(module_id)
    if module is None:
        raise HTTPException(404, "Unknown module")
    return module


@router.get("/health")
async def health() -> dict[str, Any]:
    chroma = await asyncio.to_thread(vectorstore.status)
    engines = {
        "groq": llm_clients.groq_available(),
        "gemini": llm_clients.gemini_available(),
        "judge": judge.judge_provider() or "off",
    }
    return {"status": "ok", "modules": len(MODULES), "chroma": chroma, "engines": engines}


@router.get("/modules")
async def list_modules() -> list[dict[str, Any]]:
    return [m.summary() for m in MODULES]


@router.get("/modules/{module_id}")
async def module_detail(module_id: str) -> dict[str, Any]:
    """Difficulty is a property of the lab itself, never a client choice."""
    m = _get(module_id)
    detail = m.detail()
    level = m.difficulty.lower()
    guided = level == "beginner"
    if not guided:
        # Harder labs keep their full walkthrough (the teaching content lives in
        # the page), but never hand out a ready-made exploit payload.
        detail["example_payloads"] = []
    detail["training_wheels"] = guided  # lets the UI know what to show
    return detail


@router.get("/modules/{module_id}/hints/{n}")
async def hint(module_id: str, n: int) -> dict[str, Any]:
    m = _get(module_id)
    if m.difficulty.lower() == "advanced":
        raise HTTPException(403, "Advanced labs have no hints. You are on your own.")
    if not 1 <= n <= len(m.hints):
        raise HTTPException(404, "No such hint")
    return {"n": n, "total": len(m.hints), "hint": m.hints[n - 1]}


async def _judge_output(req: RunRequest, result: dict[str, Any]) -> None:
    """Real-model runs get an independent judge verdict (best effort only)."""
    if req.engine not in eng.real_llm_engines() or not judge.judge_provider():
        return
    try:
        verdict = await asyncio.to_thread(judge.assess_leak, req.input, str(result.get("output", "")))
    except Exception:  # noqa: BLE001 - the judge must never break a lab run
        log.exception("judge failed")
        return
    if verdict:
        result["judge"] = verdict


async def _run(module_id: str, vulnerable: bool, req: RunRequest) -> dict[str, Any]:
    m = _get(module_id)
    # There is no engine picker in the UI. `auto` (the only value the frontend
    # sends) resolves to Groq or Gemini when a key is configured and the module
    # supports real models, else the built-in simulator. Explicitly naming a
    # real engine for a simulator-only lab is rejected.
    if req.engine in eng.real_llm_engines() and not getattr(m, "supports_real_llm", False):
        raise HTTPException(400, "This lab runs on the built-in simulator only; it does not use a real model.")
    req = req.model_copy(update={"engine": eng.resolve_engine(bool(getattr(m, "supports_real_llm", False)), req.engine)})
    fn = m.vulnerable_demo if vulnerable else m.secure_demo
    try:
        result = await asyncio.to_thread(fn, req)
    except ModuleInputError as exc:
        raise HTTPException(400, str(exc)) from exc
    except eng.EngineUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    result = scrub(result)
    if vulnerable:
        await _judge_output(req, result)
    return result


@router.post("/modules/{module_id}/vulnerable")
async def run_vulnerable(module_id: str, req: RunRequest, user: OptionalUser) -> dict[str, Any]:
    result = await _run(module_id, True, req)
    if user:
        await store.upsert_progress(user["id"], module_id, explored=True)
    return result


@router.post("/modules/{module_id}/secure")
async def run_secure(module_id: str, req: RunRequest, user: OptionalUser) -> dict[str, Any]:
    return await _run(module_id, False, req)


@router.post("/modules/{module_id}/flag")
async def submit_flag(module_id: str, req: FlagRequest, user: OptionalUser) -> dict[str, Any]:
    m = _get(module_id)
    ok = m.validate_flag(req.flag)
    if user:
        await store.record_attempt(user["id"], module_id, "flag", correct=ok, detail="flag submission")
        if ok:
            await store.upsert_progress(user["id"], module_id, flag=True)
    if ok:
        message = (
            "Correct. Now pass Fix-It to finish this lab."
            if m.difficulty.lower() == "advanced" else "Correct."
        )
    else:
        message = "Denied." if m.difficulty.lower() == "advanced" else "Not the right flag. Keep testing."
    return {"correct": ok, "message": message}


@router.post("/modules/{module_id}/fixit/validate")
async def validate_fix(module_id: str, req: FixRequest, user: OptionalUser) -> dict[str, Any]:
    m = _get(module_id)
    result = await asyncio.to_thread(m.validate_fix, req.code)
    tests = result.get("tests") or []
    failed = [t for t in tests if not t.get("passed")]
    result["failed"] = [str(t.get("name")) for t in failed]
    result["total"] = len(tests)
    result["summary"] = _failure_brief(result) if not result.get("passed") else f"All {len(tests)} checks passed."
    if user:
        passed = bool(result.get("passed"))
        detail = None if passed else result["summary"]
        await store.record_attempt(user["id"], module_id, "fixit", correct=passed, detail=detail[:400] if detail else None)
        if passed:
            await store.upsert_progress(user["id"], module_id, fixit=True)
    if not result.get("passed") and judge.judge_provider():
        # Deterministic tests decide pass/fail; the judge only explains the failure.
        try:
            spec = m.fixit_spec()
            review = await asyncio.to_thread(
                judge.review_fix,
                title=spec.TITLE,
                brief=spec.BRIEF,
                code=req.code,
                error=result["summary"],
            )
            if review:
                result["review"] = review
        except Exception:  # noqa: BLE001 - the judge must never break validation
            log.exception("judge review failed")
    return result


@router.get("/leaderboard")
async def leaderboard(user: OptionalUser) -> dict[str, Any]:
    """Global ranking: computed server-side from progress, masked identities."""
    rows = await store.leaderboard_rows()
    if rows is None:
        return {"enabled": False, "entries": [], "me": None, "formula": "flag 100 · fix-it 150 · explored 10"}
    rows = sorted(rows, key=lambda r: (-r["score"], -r["completed"], r["email"]))

    def display(row: dict[str, Any]) -> str:
        if row["name"]:
            return row["name"]
        local, _, domain = row["email"].partition("@")
        return f"{local[:1]}****@{domain}" if domain else "Anonymous"

    entries = [
        {"rank": i + 1, "display": display(r), "score": r["score"], "flags": r["flags"],
         "fixes": r["fixes"], "explored": r["explored"], "completed": r["completed"]}
        for i, r in enumerate(rows[:50])
    ]
    me = None
    if user:
        for i, r in enumerate(rows):
            if r["user_id"] == user["id"]:
                me = {"rank": i + 1, "display": display(r), "score": r["score"], "flags": r["flags"],
                      "fixes": r["fixes"], "explored": r["explored"], "completed": r["completed"]}
                break
    return {"enabled": True, "entries": entries, "me": me, "formula": "flag 100 · fix-it 150 · explored 10"}
