from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.core.auth import OptionalUser
from app.models.schemas import FixRequest, FlagRequest, RunRequest
from app.services import engine as eng
from app.services import ollama, vectorstore
from app.services import supabase_store as store
from app.vulnerabilities import MODULES, REGISTRY
from app.vulnerabilities.base import ModuleInputError, VulnerabilityModule

router = APIRouter()


def _get(module_id: str) -> VulnerabilityModule:
    module = REGISTRY.get(module_id)
    if module is None:
        raise HTTPException(404, "Unknown module")
    return module


@router.get("/health")
async def health() -> dict[str, Any]:
    s = get_settings()
    up = await asyncio.to_thread(ollama.available)
    ready = up and await asyncio.to_thread(ollama.model_ready)
    chroma = await asyncio.to_thread(vectorstore.status)
    return {"status": "ok", "modules": len(MODULES), "ollama": {"reachable": up, "model": s.ollama_model, "model_ready": ready}, "chroma": chroma}


@router.get("/modules")
async def list_modules() -> list[dict[str, Any]]:
    return [m.summary() for m in MODULES]


@router.get("/modules/{module_id}")
async def module_detail(module_id: str) -> dict[str, Any]:
    return _get(module_id).detail()


@router.get("/modules/{module_id}/hints/{n}")
async def hint(module_id: str, n: int) -> dict[str, Any]:
    m = _get(module_id)
    if not 1 <= n <= len(m.hints):
        raise HTTPException(404, "No such hint")
    return {"n": n, "total": len(m.hints), "hint": m.hints[n - 1]}


async def _run(module_id: str, mode: str, req: RunRequest) -> dict[str, Any]:
    m = _get(module_id)
    fn = m.vulnerable_demo if mode == "vulnerable" else m.secure_demo
    try:
        return await asyncio.to_thread(fn, req)
    except ModuleInputError as exc:
        raise HTTPException(400, str(exc)) from exc
    except eng.EngineUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc


@router.post("/modules/{module_id}/vulnerable")
async def run_vulnerable(module_id: str, req: RunRequest, user: OptionalUser) -> dict[str, Any]:
    result = await _run(module_id, "vulnerable", req)
    if user:
        await store.upsert_progress(user["id"], module_id, explored=True)
    return result


@router.post("/modules/{module_id}/secure")
async def run_secure(module_id: str, req: RunRequest, user: OptionalUser) -> dict[str, Any]:
    return await _run(module_id, "secure", req)


@router.post("/modules/{module_id}/flag")
async def submit_flag(module_id: str, req: FlagRequest, user: OptionalUser) -> dict[str, Any]:
    ok = _get(module_id).validate_flag(req.flag)
    if user:
        await store.record_attempt(user["id"], module_id, "flag", correct=ok, detail="flag submission")
        if ok:
            await store.upsert_progress(user["id"], module_id, flag=True)
    return {"correct": ok, "message": "Correct. Now fix it in Advanced mode." if ok else "Not the right flag. Keep testing."}


@router.post("/modules/{module_id}/fixit/validate")
async def validate_fix(module_id: str, req: FixRequest, user: OptionalUser) -> dict[str, Any]:
    result = await asyncio.to_thread(_get(module_id).validate_fix, req.code)
    if user:
        passed = bool(result.get("passed"))
        detail = None if passed else (result.get("error") or "validation tests failed")
        await store.record_attempt(user["id"], module_id, "fixit", correct=passed, detail=detail[:400] if detail else None)
        if passed:
            await store.upsert_progress(user["id"], module_id, fixit=True)
    return result
