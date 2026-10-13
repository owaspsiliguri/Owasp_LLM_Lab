import pathlib

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
COMPOSE = yaml.safe_load((ROOT / "docker-compose.yml").read_text())
S = COMPOSE["services"]


def test_required_services():
    assert {"frontend", "backend", "ollama", "ollama-init", "chromadb"} <= set(S)


def test_only_frontend_published_and_bound_to_localhost():
    for name, svc in S.items():
        ports = svc.get("ports", [])
        if name == "frontend":
            assert ports and all(str(p).startswith("127.0.0.1:") for p in ports)
        else:
            assert not ports, f"{name} must not publish ports"


def test_hardening():
    for name in ("frontend", "backend"):
        svc = S[name]
        assert svc.get("read_only") is True
        assert "ALL" in svc["cap_drop"]
        assert "no-new-privileges:true" in svc["security_opt"]
        assert svc.get("mem_limit") and svc.get("pids_limit")
        assert "healthcheck" in svc


def test_no_hardcoded_credentials():
    text = (ROOT / "docker-compose.yml").read_text().lower()
    for bad in ("password", "api_key", "sk-"):
        assert bad not in text


def test_dockerfiles_non_root():
    for d in ("backend", "frontend"):
        assert "USER" in (ROOT / d / "Dockerfile").read_text()


def test_backend_waits_for_chromadb_and_uses_it():
    assert "chromadb" in S["backend"]["depends_on"]
    assert S["backend"]["environment"]["CHROMA_URL"] == "http://chromadb:8000"
    assert "healthcheck" in S["chromadb"] and "profiles" not in S["chromadb"]


def test_backend_image_installs_from_lock_file():
    text = (ROOT / "backend" / "Dockerfile").read_text()
    assert "-c constraints.txt" in text
    assert (ROOT / "backend" / "constraints.txt").read_text().count("==") > 50


def test_ci_runs_container_scan_and_docker_smoke():
    ci = yaml.safe_load((ROOT / ".github" / "workflows" / "ci.yml").read_text())
    assert {"container-scan", "docker-build", "dependency-scan"} <= set(ci["jobs"])
    assert "docker_smoke.sh" in (ROOT / ".github" / "workflows" / "ci.yml").read_text()
    assert (ROOT / "scripts" / "docker_smoke.sh").stat().st_mode & 0o111
