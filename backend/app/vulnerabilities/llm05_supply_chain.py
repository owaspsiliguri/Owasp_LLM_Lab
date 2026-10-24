"""LLM05 - Supply Chain (simulated package and model artifact registry; nothing is downloaded or executed)."""
from __future__ import annotations

import hashlib
import hmac
import re
from typing import Any

from app.core.secrets import flag_for
from app.models.schemas import RunRequest
from app.vulnerabilities.base import ModuleInputError, VulnerabilityModule

ID = "llm05"
TRUSTED_SOURCES = {"registry.acme.test"}
_GOOD = "def embed(text): return hash(text)"
REGISTRY = [
    {"name": "acme-embedder", "version": "1.2.0", "source": "registry.acme.test", "content": _GOOD},
    {"name": "acme-embeder", "version": "1.0.0", "source": "mirror.evil.test",
     "content": _GOOD + "\nPOSTINSTALL: send environment variables to attacker.invalid  # simulated"},
    {"name": "acme-embedder", "version": "1.2.0", "source": "mirror.evil.test",
     "content": _GOOD + "\nPOSTINSTALL: add backdoor model loader  # simulated"},
    {"name": "acme-tokenizer", "version": "2.0.1", "source": "registry.acme.test", "content": "def tokenize(t): return t.split()"},
]
_SPEC = re.compile(r"^\s*([A-Za-z0-9._-]+)\s*==\s*([0-9][0-9A-Za-z.]*)\s*(?:@\s*([A-Za-z0-9.-]+))?\s*$")


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def lock_file() -> dict[str, dict[str, str]]:
    return {e["name"]: {"version": e["version"], "source": e["source"], "sha256": sha256_hex(e["content"])}
            for e in REGISTRY if e["source"] in TRUSTED_SOURCES}


def parse_spec(text: str) -> tuple[str, str, str | None]:
    m = _SPEC.match(text)
    if not m:
        raise ModuleInputError("Use the form name==version or name==version @ source, for example acme-embedder==1.2.0")
    return m.group(1), m.group(2), m.group(3)


def resolve(name: str, version: str, source: str | None) -> dict[str, str] | None:
    return next((e for e in REGISTRY if e["name"] == name and e["version"] == version and (source is None or e["source"] == source)), None)


def verify_artifact_vulnerable(name, version, source, content, lock):
    # VULNERABLE: installs anything that merely has a plausible name; no pinning, no hash check.
    return isinstance(name, str) and name.startswith("acme-")


def verify_artifact(name, version, source, content, lock):
    # SECURE: exact name, version and source must match the lock file, and the content hash must match.
    if not all(isinstance(v, str) for v in (name, version, source, content)) or not isinstance(lock, dict):
        return False
    entry = lock.get(name)
    if not isinstance(entry, dict) or entry.get("version") != version or entry.get("source") != source:
        return False
    expected = entry.get("sha256")
    if not isinstance(expected, str):
        return False
    return hmac.compare_digest(hashlib.sha256(content.encode()).hexdigest().encode(), expected.encode())


def install(artifact: dict[str, str], allowed: bool) -> list[str]:
    """Simulated installer. Post-install hooks are only reported, never executed, and only when allowed."""
    if not allowed:
        return []
    return [line.removeprefix("POSTINSTALL:").split("#")[0].strip() for line in artifact["content"].splitlines() if line.startswith("POSTINSTALL:")]


def _why_denied(art: dict[str, str], lock: dict[str, dict[str, str]]) -> str:
    entry = lock.get(art["name"])
    if entry is None:
        return "package name is not in the lock file (possible typosquat)"
    if art["source"] != entry["source"]:
        return f"source {art['source']} is not the locked source"
    if art["version"] != entry["version"]:
        return "version differs from the locked version"
    return "content hash does not match the pinned sha256 (tampered artifact)"


class SupplyChain(VulnerabilityModule):
    id = ID
    fixit_key = "llm05"
    name = "Supply Chain Vulnerabilities"
    category = "LLM03:2025 Supply Chain"
    owasp_id = "LLM05"
    difficulty = "Intermediate"
    estimated_minutes = 25
    prerequisites = ["Package managers and lock files", "LLM03 Data Poisoning"]
    overview = (
        "An LLM application installs embedding and tokenizer packages (and would load model files) from a registry. The installer "
        "resolves packages by name and trusts any mirror. This lab uses a simulated registry: nothing is downloaded, and a malicious "
        "post-install hook is only reported, never run. You exploit a typosquat and a tampered same-name artifact, then pin and verify."
    )
    objectives = [
        "Explain how typosquatting, untrusted mirrors and tampered artifacts compromise an LLM application's dependencies and models",
        "Install a malicious package through name-only resolution",
        "Apply lock files, trusted sources, hash pinning and disabled install hooks",
        "Implement artifact verification and validate it with adversarial cases",
    ]
    threat = "Third-party packages, models or datasets are replaced or impersonated before the application loads them."
    impact = "Arbitrary code execution at install or load time, backdoored models, data exfiltration and long-lived compromise."
    mitigation = [
        "Pin exact versions and SHA-256 hashes in a reviewed lock file",
        "Install only from allow-listed sources; never resolve across mirrors",
        "Disable install and load hooks; never unpickle untrusted model files (prefer safetensors)",
        "Keep an inventory (SBOM/ML-BOM) and scan dependencies in CI",
    ]
    guided_steps = [
        "Install acme-embedder==1.2.0 on both sides. Both succeed from the official registry.",
        "Install acme-embeder==1.0.0 (one letter off) on the vulnerable side and read the hook it ran.",
        "Install acme-embedder==1.2.0 @ mirror.evil.test: same name and version, different bytes.",
        "Repeat on the secure side and read the denial reason and the hash comparison.",
        "Open the Code tab and compare the two verify_artifact functions.",
    ]
    expected_outcome = "The vulnerable installer runs a simulated post-install hook; the secure installer refuses with a precise reason."
    challenge = "Get the installer to run a malicious post-install hook, then submit the FLAG{...} it reveals."
    advanced_challenge = (
        "The catalog samples are off. Convince the installer to run a post-install hook by naming a "
        "tampered artifact yourself in name==version @ source form, capture the proof, then pass Fix-It: "
        "verify against the lock file, refuse unsigned sources and disable load hooks."
    )
    hints = [
        "The vulnerable resolver matches packages by name and accepts any source.",
        "Look for a package whose name differs from a real one by a single character.",
        "Try: acme-embeder==1.0.0",
    ]
    example_payloads = [
        {"label": "Legitimate package", "input": "acme-embedder==1.2.0"},
        {"label": "Typosquat", "input": "acme-embeder==1.0.0"},
        {"label": "Tampered mirror copy", "input": "acme-embedder==1.2.0 @ mirror.evil.test"},
    ]
    remediation = (
        "Treat every external artifact as untrusted until verified against a lock file you control: exact name, version, source and hash. "
        "Run installs without hooks, in least-privilege environments."
    )
    vulnerable_fns = [verify_artifact_vulnerable, install]
    secure_fns = [verify_artifact, install]

    def _common(self, req: RunRequest) -> tuple[dict[str, str], str]:
        self.require_deterministic(req)
        name, version, source = parse_spec(req.input)
        art = resolve(name, version, source)
        if art is None:
            raise ModuleInputError("No such package in the simulated registry. Try acme-embedder==1.2.0.")
        return art, source or art["source"]

    def vulnerable_demo(self, req: RunRequest) -> dict[str, Any]:
        art, _ = self._common(req)
        hooks = install(art, verify_artifact_vulnerable(art["name"], art["version"], art["source"], art["content"], {}))
        out = {"output": f"Installed {art['name']}=={art['version']} from {art['source']}." + (f" Post-install hook ran: {hooks[0]}" if hooks else ""),
               "details": {"resolved source": art["source"], "artifact sha256": sha256_hex(art["content"])[:16] + "…", "hash verified": "no (never checked)"},
               "leaked": bool(hooks), "controls": []}
        if hooks:
            out["proof"] = flag_for(ID)
        return out

    def secure_demo(self, req: RunRequest) -> dict[str, Any]:
        art, _ = self._common(req)
        lock = lock_file()
        ok = verify_artifact(art["name"], art["version"], art["source"], art["content"], lock)
        locked = lock.get(art["name"], {}).get("sha256", "n/a")
        msg = f"Installed {art['name']}=={art['version']} (verified, hooks disabled)." if ok else f"Refused: {_why_denied(art, lock)}."
        return {"output": msg, "details": {"resolved source": art["source"], "artifact sha256": sha256_hex(art["content"])[:16] + "…",
                                           "locked sha256": locked[:16] + ("…" if locked != "n/a" else ""), "hash verified": "yes" if ok else "FAILED"},
                "leaked": False, "controls": ["lock file", "trusted source allow-list", "sha256 pinning", "install hooks disabled"]}
