"""Judge and provider failure modes must never fake an award or break a lab."""
from __future__ import annotations

import asyncio
import json

import pytest

from app.api import routes
from app.models.schemas import RunRequest
from app.services import judge
from app.services.engine_base import EngineUnavailable


def configure_judge(monkeypatch, *, groq: bool = True, gemini: bool = False) -> None:
    monkeypatch.setenv("JUDGE_PROVIDER", "groq")
    if groq:
        monkeypatch.setenv("GROQ_API_KEY", "test-groq-key")
    else:
        monkeypatch.delenv("GROQ_API_KEY", raising=False)
    if gemini:
        monkeypatch.setenv("GEMINI_API_KEY", "test-gemini-key")
    else:
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)


def test_judge_timeout_is_advisory_only_and_returns_none(monkeypatch):
    configure_judge(monkeypatch)

    def timeout(*args, **kwargs):
        raise EngineUnavailable("Judge request timed out.")

    monkeypatch.setattr(judge.llm_clients, "chat", timeout)
    assert judge.assess_leak("question", "reply") is None


def test_judge_falls_back_to_the_other_configured_provider(monkeypatch):
    configure_judge(monkeypatch, groq=True, gemini=True)

    def chat(provider, *args, **kwargs):
        if provider == "groq":
            raise EngineUnavailable("rate limited")
        return json.dumps({"verdict": "blocked", "reason": "no secret in the reply"})

    monkeypatch.setattr(judge.llm_clients, "chat", chat)
    verdict = judge.assess_leak("question", "reply")
    assert verdict is not None
    assert verdict["verdict"] == "blocked" and verdict["provider"] == "gemini"


def test_judge_uncertain_is_returned_as_uncertain_not_as_a_leak(monkeypatch):
    configure_judge(monkeypatch)
    monkeypatch.setattr(
        judge.llm_clients,
        "chat",
        lambda *a, **k: json.dumps({"verdict": "uncertain", "reason": "the reply alludes to a code"}),
    )
    verdict = judge.assess_leak("question", "reply")
    assert verdict is not None and verdict["verdict"] == "uncertain"


@pytest.mark.parametrize("raw", ["not json at all", "{broken", '{"verdict": "maybe"}', '{"reason": "no verdict"}'])
def test_judge_malformed_answers_are_ignored(monkeypatch, raw):
    configure_judge(monkeypatch)
    monkeypatch.setattr(judge.llm_clients, "chat", lambda *a, **k: raw)
    assert judge.assess_leak("question", "reply") is None


def test_judge_exception_never_breaks_a_run(monkeypatch):
    configure_judge(monkeypatch)

    def explode(*args, **kwargs):
        raise RuntimeError("judge crashed")

    monkeypatch.setattr(judge, "assess_leak", explode)
    result = {"output": "ordinary answer", "leaked": False}
    asyncio.run(routes._judge_output(RunRequest(input="hello", engine="groq"), result))
    assert result == {"output": "ordinary answer", "leaked": False}


def test_explicit_real_engine_without_a_key_returns_503(client, monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    response = client.post(
        "/api/modules/llm01/vulnerable",
        json={"input": "hello", "engine": "groq"},
    )
    assert response.status_code == 503
    assert "GROQ_API_KEY" in response.json()["detail"]
