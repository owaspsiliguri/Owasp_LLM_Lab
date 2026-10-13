"""Fix-It challenge for LLM05: verify a package or model artifact against a lock file before use."""
import hashlib

FUNC_NAME = "verify_artifact"
TITLE = "Verify artifacts against a pinned lock file"
BRIEF = (
    "verify_artifact(name, version, source, content, lock) decides whether an artifact may be installed. lock maps an exact package name to "
    "{'version', 'source', 'sha256'}. Return True only if the name is in the lock (exact, case-sensitive), version and source equal the locked "
    "values, and the lowercase hex SHA-256 of content.encode() equals the locked sha256 (use a constant-time comparison). "
    "Anything malformed (non-strings, lock not a dict, entry not a dict, missing sha256) returns False."
)
STARTER = '''import hashlib
import hmac


def verify_artifact(name, version, source, content, lock):
    # VULNERABLE: installs anything that merely has a plausible name; no pinning, no hash check.
    return isinstance(name, str) and name.startswith("acme-")
'''


def _sha(text):
    return hashlib.sha256(text.encode()).hexdigest()


GOOD = "def embed(t): return hash(t)"
LOCK = {"acme-embedder": {"version": "1.2.0", "source": "registry.acme.test", "sha256": _sha(GOOD)},
        "acme-broken": {"version": "1.0.0", "source": "registry.acme.test"}}


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run_tests(fn):
    out = []

    def check(name, expected, *args):
        try:
            got = fn(*args)
        except Exception as exc:
            out.append(_t(name, False, f"raised {type(exc).__name__}"))
            return
        out.append(_t(name, got is expected, f"expected {expected}, got {got!r}"))

    ok = ("acme-embedder", "1.2.0", "registry.acme.test", GOOD, LOCK)
    check("accepts the exact locked artifact", True, *ok)
    check("rejects a typosquatted name", False, "acme-embeder", "1.2.0", "registry.acme.test", GOOD, LOCK)
    check("rejects a name differing only by case", False, "Acme-Embedder", "1.2.0", "registry.acme.test", GOOD, LOCK)
    check("rejects tampered content with the right name", False, "acme-embedder", "1.2.0", "registry.acme.test", GOOD + "\nPOSTINSTALL: x", LOCK)
    check("rejects an untrusted source", False, "acme-embedder", "1.2.0", "mirror.evil.test", GOOD, LOCK)
    check("rejects a different version", False, "acme-embedder", "1.3.0", "registry.acme.test", GOOD, LOCK)
    check("rejects a package that is not in the lock", False, "left-pad", "1.0.0", "registry.acme.test", GOOD, LOCK)
    check("rejects a lock entry without a hash", False, "acme-broken", "1.0.0", "registry.acme.test", GOOD, LOCK)
    check("rejects a non-dict lock", False, "acme-embedder", "1.2.0", "registry.acme.test", GOOD, None)
    check("rejects non-string content", False, "acme-embedder", "1.2.0", "registry.acme.test", None, LOCK)
    check("rejects non-ASCII content mismatch without crashing", False, "acme-embedder", "1.2.0", "registry.acme.test", "é" * 40, LOCK)
    other = {"acme-embedder": {**LOCK["acme-embedder"], "sha256": _sha("other")}}
    check("rejects when the locked hash is for different content", False, "acme-embedder", "1.2.0", "registry.acme.test", GOOD, other)
    return out
