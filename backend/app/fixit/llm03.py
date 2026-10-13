"""Fix-It challenge for LLM03: verify document provenance before it enters the knowledge base."""
import hashlib
import hmac

FUNC_NAME = "verify_provenance"
TITLE = "Verify document provenance"
BRIEF = (
    "The ingestion pipeline trusts the 'source' label a submitter claims. Implement verify_provenance(text, source, signature, key): "
    "return True only if signature is the lowercase hex HMAC-SHA256 of the string source + newline + text, computed with key. "
    "Use a constant-time comparison. Anything malformed (non-strings, empty signature) must return False."
)
STARTER = '''import hmac
import hashlib


def verify_provenance(text, source, signature, key):
    # VULNERABLE: trusts whatever source the submitter claims; no cryptographic proof.
    return source in ("handbook", "policy-portal")
'''
KEY = "unit-test-signing-key"


def _sign(source, text, key=KEY):
    return hmac.new(key.encode(), f"{source}\n{text}".encode(), hashlib.sha256).hexdigest()


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run_tests(fn):
    text = "Refund policy: customers may request a refund within 14 days of purchase."
    good = _sign("handbook", text)
    out = []

    def check(name, expected, *args):
        try:
            got = fn(*args)
        except Exception as exc:
            out.append(_t(name, False, f"raised {type(exc).__name__}"))
            return
        out.append(_t(name, got is expected, f"expected {expected}, got {got!r}"))

    check("accepts a correctly signed document", True, text, "handbook", good, KEY)
    check("rejects spoofed source with no signature", False, text, "handbook", "", KEY)
    check("rejects forged signature", False, text, "handbook", "0" * 64, KEY)
    check("rejects tampered text", False, text.replace("14", "90"), "handbook", good, KEY)
    check("rejects signature bound to a different source", False, text, "policy-portal", good, KEY)
    check("rejects signature made with another key", False, text, "handbook", _sign("handbook", text, "other"), KEY)
    check("rejects uppercase-hex variant", False, text, "handbook", good.upper(), KEY)
    check("rejects None signature", False, text, "handbook", None, KEY)
    check("rejects non-string text", False, None, "handbook", good, KEY)
    check("rejects non-ASCII garbage signature without crashing", False, text, "handbook", "é" * 64, KEY)
    check("accepts a different valid document", True, "Uptime 99.9%", "policy-portal", _sign("policy-portal", "Uptime 99.9%"), KEY)
    return out
