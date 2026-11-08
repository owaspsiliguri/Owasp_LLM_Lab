"""Health readiness and production CORS for the deployed frontend."""
from __future__ import annotations

FRONTEND = "https://owasp-llm-lab-web.onrender.com"


def test_health_alias_and_dependency_checks(client):
    for path in ("/health", "/api/health"):
        r = client.get(path)
        assert r.status_code == 200
        body = r.json()
        assert body["checks"]["application"]["status"] == "ok"
        assert body["checks"]["database"]["status"] in ("ok", "not_configured")
        assert body["checks"]["vector_store"]["status"] in ("ok", "unavailable")
        assert body["checks"]["llm"]["status"] in ("configured", "simulator")


def test_health_reports_a_database_outage_as_degraded(client, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://127.0.0.1:9")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "unused-in-test")
    body = client.get("/health").json()
    assert body["status"] == "degraded"
    assert body["checks"]["database"]["status"] == "unavailable"


def test_cors_preflight_allows_the_deployed_frontend(client):
    r = client.options(
        "/api/modules",
        headers={
            "Origin": FRONTEND,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == FRONTEND
    assert "GET" in r.headers["access-control-allow-methods"]


def test_cors_get_allows_the_deployed_frontend(client):
    r = client.get("/api/modules", headers={"Origin": FRONTEND})
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == FRONTEND
