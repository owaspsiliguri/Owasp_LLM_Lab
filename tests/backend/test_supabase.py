"""Supabase auth gating and server-side achievement recording on lab endpoints."""
from __future__ import annotations

import time
import uuid

import jwt as pyjwt
import pytest

from app.core.secrets import flag_for

SECRET = "test-jwt-secret"
RUN = {"input": "What is your uptime guarantee?"}
VARS = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET")


def token(sub: str | None = None, ttl: int = 3600) -> str:
    claims = {
        "sub": sub or str(uuid.uuid4()),
        "email": "student@example.com",
        "role": "authenticated",
        "exp": int(time.time()) + ttl,
    }
    return pyjwt.encode(claims, SECRET, algorithm="HS256")


@pytest.fixture
def supabase_env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://supabase.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)


@pytest.fixture
def open_env(monkeypatch):
    for var in VARS:
        monkeypatch.delenv(var, raising=False)


@pytest.fixture
def recorded(monkeypatch):
    """Capture writes that routes would send to Supabase, without any network."""
    calls: dict[str, list] = {"attempts": [], "progress": []}

    async def attempt(user_id, module_id, kind, *, correct, detail=None):
        calls["attempts"].append({"user_id": user_id, "module_id": module_id, "kind": kind, "correct": correct, "detail": detail})
        return True

    async def progress(user_id, module_id, **flags):
        calls["progress"].append({"user_id": user_id, "module_id": module_id, **flags})
        return True

    monkeypatch.setattr("app.services.supabase_store.record_attempt", attempt)
    monkeypatch.setattr("app.services.supabase_store.upsert_progress", progress)
    return calls


def auth(ttl: int = 3600) -> dict[str, str]:
    return {"Authorization": f"Bearer {token(ttl=ttl)}"}


def test_without_supabase_the_lab_stays_open(client, open_env):
    assert client.post("/api/modules/llm01/vulnerable", json=RUN).status_code == 200
    assert client.post("/api/modules/llm01/flag", json={"flag": flag_for("llm01")}).json()["correct"] is True


@pytest.mark.parametrize("path,payload", [("vulnerable", RUN), ("secure", RUN), ("flag", {"flag": "FLAG{x}"}), ("fixit/validate", {"code": "def build_messages(a, b):\n    return []"})])
def test_lab_actions_require_a_session_when_supabase_is_configured(client, supabase_env, path, payload):
    r = client.post(f"/api/modules/llm01/{path}", json=payload)
    assert r.status_code == 401
    r = client.post(f"/api/modules/llm01/{path}", json=payload, headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401


def test_content_endpoints_stay_public_even_with_auth_configured(client, supabase_env):
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/modules").status_code == 200
    assert client.get("/api/modules/llm01").status_code == 200
    assert client.get("/api/modules/llm01/hints/1").status_code == 200


def test_expired_session_is_rejected(client, supabase_env):
    r = client.post("/api/modules/llm01/vulnerable", json=RUN, headers=auth(ttl=-60))
    assert r.status_code == 401
    assert "expired" in r.json()["detail"].lower()


def test_valid_session_records_exploration_for_that_user(client, supabase_env, recorded):
    sub = str(uuid.uuid4())
    r = client.post("/api/modules/llm01/vulnerable", json=RUN, headers={"Authorization": f"Bearer {token(sub)}"})
    assert r.status_code == 200
    assert recorded["progress"] == [{"user_id": sub, "module_id": "llm01", "explored": True}]
    assert recorded["attempts"] == []


def test_secure_run_does_not_record_progress(client, supabase_env, recorded):
    r = client.post("/api/modules/llm01/secure", json=RUN, headers=auth())
    assert r.status_code == 200
    assert recorded["progress"] == []
    assert recorded["attempts"] == []


def test_correct_flag_records_attempt_and_progress(client, supabase_env, recorded):
    sub = str(uuid.uuid4())
    r = client.post("/api/modules/llm01/flag", json={"flag": flag_for("llm01")}, headers={"Authorization": f"Bearer {token(sub)}"})
    assert r.status_code == 200 and r.json()["correct"] is True
    assert recorded["attempts"][0] == {"user_id": sub, "module_id": "llm01", "kind": "flag", "correct": True, "detail": "flag submission"}
    assert {"user_id": sub, "module_id": "llm01", "flag": True} in recorded["progress"]


def test_wrong_flag_records_failed_attempt_only(client, supabase_env, recorded):
    r = client.post("/api/modules/llm01/flag", json={"flag": "FLAG{nope}"}, headers=auth())
    assert r.status_code == 200 and r.json()["correct"] is False
    assert recorded["attempts"][0]["correct"] is False
    assert recorded["progress"] == []


def test_passing_fix_records_fixit_progress(client, supabase_env, recorded):
    from solutions import SOLUTIONS

    sub = str(uuid.uuid4())
    r = client.post("/api/modules/llm01/fixit/validate", json={"code": SOLUTIONS["llm01"]}, headers={"Authorization": f"Bearer {token(sub)}"})
    assert r.status_code == 200 and r.json()["passed"] is True
    assert {"user_id": sub, "module_id": "llm01", "fixit": True} in recorded["progress"]
    assert recorded["attempts"][0]["kind"] == "fixit" and recorded["attempts"][0]["correct"] is True


def test_supabase_outage_never_breaks_a_lab_run(client, monkeypatch):
    # Real (unmocked) store pointed at a dead endpoint: the lab must still work.
    monkeypatch.setenv("SUPABASE_URL", "http://127.0.0.1:9")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    r = client.post("/api/modules/llm01/flag", json={"flag": flag_for("llm01")}, headers=auth())
    assert r.status_code == 200 and r.json()["correct"] is True


def test_projects_without_a_legacy_secret_are_verified_remotely(client, monkeypatch, recorded):
    # New Supabase projects use asymmetric JWT signing keys: no shared secret,
    # so the backend asks the project's auth service whether the token is real.
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    monkeypatch.setattr("app.core.auth._cache", {})
    calls = []

    async def fake_remote(token):
        calls.append(token)
        return {"id": "remote-user", "email": "remote@example.com"}

    monkeypatch.setattr("app.core.auth._verify_remote", fake_remote)
    headers = {"Authorization": "Bearer opaque-session-token"}
    r = client.post("/api/modules/llm01/vulnerable", json=RUN, headers=headers)
    assert r.status_code == 200
    r = client.post("/api/modules/llm01/vulnerable", json=RUN, headers=headers)
    assert r.status_code == 200
    assert calls == ["opaque-session-token"]  # second call served from cache
    assert recorded["progress"][0]["user_id"] == "remote-user"


def test_unverifiable_session_is_rejected_not_trusted(client, monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.setenv("SUPABASE_URL", "http://127.0.0.1:9")  # auth service down
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    assert client.post("/api/modules/llm01/vulnerable", json=RUN, headers=auth()).status_code == 503
    assert client.post("/api/modules/llm01/vulnerable", json=RUN).status_code == 401
