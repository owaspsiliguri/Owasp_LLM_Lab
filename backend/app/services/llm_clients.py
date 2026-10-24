"""Real-model inference through Groq and Google Gemini (optional).

Both providers are server-side only: keys live in environment variables and
never reach the browser. Every failure raises ``EngineUnavailable`` with a
safe message so a missing key or an outage degrades to a clear 503 instead of
breaking the lab.

The same clients power two things:

* the **engine** - Groq/Gemini can be chosen as the model behind a lab's
  vulnerable/secure implementation, so exploits behave like real models;
* the **judge** - an independent model call that assesses whether an exploit
  output really disclosed the secret, and reviews student Fix-It code.
"""
from __future__ import annotations

import logging

import httpx

from app.config import get_settings
from app.services.engine_base import EngineUnavailable

log = logging.getLogger("lab.llm")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
TIMEOUT = httpx.Timeout(30.0, connect=5.0)


def groq_available() -> bool:
    return bool(get_settings().groq_api_key)


def gemini_available() -> bool:
    return bool(get_settings().gemini_api_key)


def _headers() -> dict[str, str]:
    s = get_settings()
    return {"Authorization": f"Bearer {s.groq_api_key}", "Content-Type": "application/json"}


def groq_chat(messages: list[dict[str, str]], *, temperature: float = 0.2, max_tokens: int = 600, model: str | None = None) -> str:
    s = get_settings()
    if not s.groq_api_key:
        raise EngineUnavailable("Groq is not configured (set GROQ_API_KEY on the server).")
    payload = {"model": model or s.groq_model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    try:
        with httpx.Client(timeout=httpx.Timeout(s.llm_timeout_seconds, connect=5.0)) as client:
            resp = client.post(GROQ_URL, json=payload, headers=_headers())
    except httpx.HTTPError as exc:
        log.warning("Groq unreachable: %s", exc.__class__.__name__)
        raise EngineUnavailable("The Groq API is unreachable right now. Try again shortly.") from exc
    if resp.status_code == 429:
        raise EngineUnavailable("Groq rate limit hit. Try again in a moment.")
    if resp.status_code >= 400:
        log.warning("Groq returned %s", resp.status_code)
        raise EngineUnavailable("Groq rejected the request. Check GROQ_API_KEY / GROQ_MODEL.")
    try:
        content = resp.json()["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError) as exc:
        raise EngineUnavailable("Unexpected response from Groq.") from exc
    if not isinstance(content, str) or not content.strip():
        raise EngineUnavailable("Groq returned an empty completion.")
    return content


def gemini_chat(messages: list[dict[str, str]], *, temperature: float = 0.2, max_tokens: int = 600, model: str | None = None) -> str:
    s = get_settings()
    if not s.gemini_api_key:
        raise EngineUnavailable("Gemini is not configured (set GEMINI_API_KEY on the server).")
    system = "\n\n".join(m["content"] for m in messages if m.get("role") == "system")
    contents = [
        {"role": "model" if m.get("role") == "assistant" else "user", "parts": [{"text": m.get("content", "")}]}
        for m in messages if m.get("role") in ("user", "assistant")
    ]
    payload = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": system}]} if system else None,
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
    }
    if payload["systemInstruction"] is None:
        del payload["systemInstruction"]
    url = GEMINI_URL.format(model=model or s.gemini_model)
    try:
        with httpx.Client(timeout=httpx.Timeout(s.llm_timeout_seconds, connect=5.0)) as client:
            resp = client.post(url, json=payload, params={"key": s.gemini_api_key})
    except httpx.HTTPError as exc:
        log.warning("Gemini unreachable: %s", exc.__class__.__name__)
        raise EngineUnavailable("The Gemini API is unreachable right now. Try again shortly.") from exc
    if resp.status_code == 429:
        raise EngineUnavailable("Gemini rate limit hit. Try again in a moment.")
    if resp.status_code >= 400:
        log.warning("Gemini returned %s", resp.status_code)
        raise EngineUnavailable("Gemini rejected the request. Check GEMINI_API_KEY / GEMINI_MODEL.")
    try:
        parts = resp.json()["candidates"][0]["content"]["parts"]
        content = "".join(p.get("text", "") for p in parts)
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise EngineUnavailable("Unexpected response from Gemini.") from exc
    if not content.strip():
        raise EngineUnavailable("Gemini returned an empty completion.")
    return content


def chat(provider: str, messages: list[dict[str, str]], **kwargs) -> str:
    if provider == "groq":
        return groq_chat(messages, **kwargs)
    if provider == "gemini":
        return gemini_chat(messages, **kwargs)
    raise EngineUnavailable(f"Unknown LLM provider: {provider}.")
