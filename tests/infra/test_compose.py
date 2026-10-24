import pathlib
import re

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
COMPOSE = yaml.safe_load((ROOT / "docker-compose.yml").read_text())
S = COMPOSE["services"]


def test_required_services():
    assert {"frontend", "backend", "chromadb"} <= set(S)
    # Real LLMs are reached through server-side API keys, never a local model service.
    assert not any("ollama" in name for name in S)


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
    """Credential-shaped values must come from the environment, never the file.

    Key *names* (GROQ_API_KEY) are fine and expected; a literal secret *value*
    next to a credential-like key is not, and neither are raw key prefixes.
    """
    text = (ROOT / "docker-compose.yml").read_text().lower()
    for line in text.splitlines():
        if ":" not in line or "${" in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if re.search(r"(password|secret|_key$|api_key|token)", key) and key not in ("healthcheck",):
            assert not value, f"hardcoded credential for {key!r} in docker-compose.yml"
    for prefix in ("sk-", "gsk_", "aiza"):
        assert prefix not in text


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
