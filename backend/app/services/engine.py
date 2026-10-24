"""Engine dispatch: Groq and Gemini are the only real engines.

There is no engine picker anywhere in the product: requests default to
``auto`` and the server resolves it. When a Groq (or Gemini) key is
configured and the module supports real models, the request is served by that
LLM; otherwise the built-in deterministic simulator keeps the lab
reproducible and key-free. Modules that simply cannot run on a real model (the
simulated infrastructure labs) always resolve to the simulator.
"""
from __future__ import annotations

import logging

from app.config import get_settings
from app.services import llm_clients, simllm
from app.services.engine_base import EngineUnavailable

log = logging.getLogger("lab.engine")

__all__ = ["EngineUnavailable", "run_flat", "run_chat", "run_context", "real_llm_engines", "resolve_engine"]

REAL_LLM_ENGINES = ("groq", "gemini")


def _fallback_order(preferred: str) -> list[str]:
    """``preferred`` first, then any other provider that has a key configured."""
    s = get_settings()
    others = [p for p in REAL_LLM_ENGINES if p != preferred
              and (s.groq_api_key if p == "groq" else s.gemini_api_key)]
    return [preferred, *others]


def _chat_with_fallback(preferred: str, messages: list[dict[str, str]]) -> str:
    """Call ``preferred`` and degrade to the other provider, then to the
    simulator, rather than surfacing a 503 on a transient rate limit.

    Two different failures get two different treatments:

    * a provider with **no key configured** is a configuration error - the
      first (requested) provider raises immediately so the caller sees the
      real "set X_API_KEY" message instead of a silently different engine;
    * a configured provider that fails at runtime (rate limit, outage) falls
      through to the other configured provider, then to the simulator, so a
      free-tier rate limit never takes a lab offline.
    """
    s = get_settings()
    errors: list[str] = []
    for index, provider in enumerate(_fallback_order(preferred)):
        configured = bool(s.groq_api_key if provider == "groq" else s.gemini_api_key)
        if not configured:
            if index == 0:
                # Explicitly requested a provider that has no key: surface it.
                return llm_clients.chat(provider, messages)
            continue  # never use an unkeyed provider as a fallback
        try:
            return llm_clients.chat(provider, messages)
        except EngineUnavailable as exc:
            errors.append(f"{provider}: {exc}")
    # Every configured provider failed at runtime: keep the lab usable.
    log.warning("All real providers failed, falling back to simulator: %s", "; ".join(errors))
    return simllm.complete_chat(messages)


def real_llm_engines() -> tuple[str, ...]:
    return REAL_LLM_ENGINES


def resolve_engine(supports_real_llm: bool, requested: str) -> str:
    """Map the request's engine (default ``auto``) to a concrete provider.

    Returns ``"groq"``/``"gemini"`` for real-model runs and ``"sim"`` for the
    built-in simulator. Simulator-only modules always resolve to ``"sim"``;
    an explicit real-engine request for such a module is rejected by the route.

    Reads ``GROQ_API_KEY``/``GEMINI_API_KEY`` at call time rather than caching
    availability, so a key added to the environment is honoured immediately.
    """
    if not supports_real_llm:
        return "sim"
    if requested in REAL_LLM_ENGINES:
        return requested
    s = get_settings()
    preferred = s.lab_provider if s.lab_provider in REAL_LLM_ENGINES else "groq"
    ordered = (preferred,) + tuple(e for e in REAL_LLM_ENGINES if e != preferred)
    for provider in ordered:
        if (s.groq_api_key if provider == "groq" else s.gemini_api_key):
            return provider
    return "sim"


def run_flat(engine: str, prompt: str) -> str:
    if engine in REAL_LLM_ENGINES:
        return _chat_with_fallback(engine, [{"role": "user", "content": prompt}])
    return simllm.complete_flat(prompt)


def run_chat(engine: str, messages: list[dict[str, str]]) -> str:
    if engine in REAL_LLM_ENGINES:
        return _chat_with_fallback(engine, messages)
    return simllm.complete_chat(messages)


def run_context(engine: str, context: str, question: str) -> str:
    if engine in REAL_LLM_ENGINES:
        return _chat_with_fallback(engine, [{"role": "system", "content": context}, {"role": "user", "content": question}])
    return simllm.complete_with_context(context, question)
