"""Thin Ollama client (local runtime, no cloud API keys)."""
from __future__ import annotations

import httpx

from app.config import get_settings


class OllamaError(RuntimeError):
    pass


def available() -> bool:
    s = get_settings()
    try:
        r = httpx.get(f"{s.ollama_url}/api/tags", timeout=3)
        return r.status_code == 200
    except httpx.HTTPError:
        return False


def model_ready() -> bool:
    s = get_settings()
    try:
        r = httpx.get(f"{s.ollama_url}/api/tags", timeout=3)
        names = {m.get("name", "") for m in r.json().get("models", [])}
    except (httpx.HTTPError, ValueError):
        return False
    wanted = s.ollama_model
    return wanted in names or (":" not in wanted and f"{wanted}:latest" in names)


def chat(messages: list[dict[str, str]]) -> str:
    s = get_settings()
    try:
        r = httpx.post(
            f"{s.ollama_url}/api/chat",
            json={"model": s.ollama_model, "messages": messages, "stream": False, "options": {"temperature": 0.2, "num_predict": 300}},
            timeout=s.ollama_timeout_seconds,
        )
        r.raise_for_status()
        return str(r.json()["message"]["content"])
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise OllamaError(f"Ollama request failed: {exc.__class__.__name__}. Is the model pulled? (docker compose logs ollama-init)") from exc
