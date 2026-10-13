"""Engine dispatch: deterministic simulator (default) or a real local model through Ollama."""
from __future__ import annotations

from app.services import ollama, simllm


class EngineUnavailable(RuntimeError):
    pass


def run_flat(engine: str, prompt: str) -> str:
    if engine == "ollama":
        try:
            return ollama.chat([{"role": "user", "content": prompt}])
        except ollama.OllamaError as exc:
            raise EngineUnavailable(str(exc)) from exc
    return simllm.complete_flat(prompt)


def run_chat(engine: str, messages: list[dict[str, str]]) -> str:
    if engine == "ollama":
        try:
            return ollama.chat(messages)
        except ollama.OllamaError as exc:
            raise EngineUnavailable(str(exc)) from exc
    return simllm.complete_chat(messages)


def run_context(engine: str, context: str, question: str) -> str:
    if engine == "ollama":
        return run_chat(engine, [{"role": "system", "content": context}, {"role": "user", "content": question}])
    return simllm.complete_with_context(context, question)
