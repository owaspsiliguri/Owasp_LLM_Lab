import pytest

from app.core.secrets import flag_for


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["modules"] == 10


def test_list_and_detail(client):
    mods = client.get("/api/modules").json()
    assert [m["id"] for m in mods] == ["llm01", "llm02", "llm10", "llm03", "llm04", "llm06", "llm09", "llm05", "llm07", "llm08"]
    for m in mods:
        d = client.get(f"/api/modules/{m['id']}").json()
        for key in ("vulnerable_code", "secure_code", "fixit", "objectives", "guided_steps", "remediation"):
            assert d[key]
        assert "FLAG{" not in d["vulnerable_code"] + d["secure_code"]
        assert d["fixit"]["starter_code"].startswith(("def", "import"))


def test_unknown_module_404(client):
    assert client.get("/api/modules/llm99").status_code == 404


def test_hints(client):
    assert client.get("/api/modules/llm01/hints/1").status_code == 200
    assert client.get("/api/modules/llm01/hints/9").status_code == 404


ALL = ["llm01", "llm02", "llm10", "llm03", "llm04", "llm06", "llm09", "llm05", "llm07", "llm08"]


@pytest.mark.parametrize("mid", ALL)
def test_flag_roundtrip(client, mid):
    assert client.post(f"/api/modules/{mid}/flag", json={"flag": flag_for(mid)}).json()["correct"] is True
    assert client.post(f"/api/modules/{mid}/flag", json={"flag": "FLAG{wrong}"}).json()["correct"] is False


def test_flags_are_module_specific(client):
    assert client.post("/api/modules/llm01/flag", json={"flag": flag_for("llm02")}).json()["correct"] is False


@pytest.mark.parametrize("body", [{}, {"input": ""}, {"input": "x" * 2001}, {"input": "a", "extra": 1}, {"input": "a", "engine": "gpt"}, {"input": "a", "engine": "ollama"}])
def test_input_validation(client, body):
    assert client.post("/api/modules/llm01/vulnerable", json=body).status_code == 422


def test_health_reports_chroma(client):
    chroma = client.get("/api/health").json()["chroma"]
    assert chroma["reachable"] is True and chroma["mode"] in ("in-process", "server")


def test_unknown_variant_rejected(client):
    r = client.post("/api/modules/llm03/vulnerable", json={"input": "x", "variant": "nope"})
    assert r.status_code == 400
    assert client.post("/api/modules/llm03/vulnerable", json={"input": "x", "variant": "BAD VARIANT!"}).status_code == 422


@pytest.mark.parametrize("mid", ["llm03", "llm04", "llm05", "llm06", "llm07", "llm08", "llm09"])
def test_simulated_modules_reject_real_engines(client, mid):
    r = client.post(f"/api/modules/{mid}/vulnerable", json={"input": "1", "engine": "groq"})
    assert r.status_code == 400
