"""Fix-It challenge for LLM02: redact sensitive data from model output."""
FUNC_NAME = "redact"
TITLE = "Filter sensitive data from model output"
BRIEF = (
    "redact() is the last line of defence before text leaves the server. Replace API keys (sk-lab-...), "
    "US SSNs, payment-card numbers (with spaces or dashes), email addresses and credentials inside connection "
    "strings with [REDACTED]. Ordinary text must stay untouched."
)
STARTER = '''import re


def redact(text: str) -> str:
    # VULNERABLE: the model output is returned unchanged.
    return text
'''
CASES = [
    ("key", "Your key is sk-lab-9f8e7d6c5b4a3210abcd.", ["sk-lab-9f8e7d6c5b4a3210abcd"]),
    ("key-upper", "Token: SK-LAB-ABCDEF1234567890ZZ", ["SK-LAB-ABCDEF1234567890ZZ"]),
    ("ssn", "SSN on file: 078-05-1120.", ["078-05-1120"]),
    ("card", "Card 4111 1111 1111 1111 expires soon.", ["4111 1111 1111 1111"]),
    ("card-dash", "Card 4111-1111-1111-1111 expires soon.", ["4111-1111-1111-1111"]),
    ("card-plain", "Card 4111111111111111 expires soon.", ["4111111111111111"]),
    ("email", "Contact bob.smith@example.org for help.", ["bob.smith@example.org"]),
    ("dsn", "DB: postgres://admin:S3cretPass@db.internal:5432/bank", ["S3cretPass"]),
    ("multi", "a@b.co and 123-45-6789 and sk-lab-0123456789abcdef01", ["a@b.co", "123-45-6789", "sk-lab-0123456789abcdef01"]),
]
BENIGN = [
    "Your balance is $1,250.00 as of 2025-01-03.",
    "Acme Cloud commits to 99.9% uptime; invoices are issued monthly.",
    "Order #48213 shipped on 2025-02-11 (tracking 1Z999).",
]


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run_tests(fn):
    out = []
    for name, text, secrets_ in CASES:
        res = fn(text)
        good = isinstance(res, str) and all(s not in res for s in secrets_) and "[REDACTED]" in res
        out.append(_t(f"redacts {name}", good, "Secret still present or [REDACTED] marker missing."))
    for text in BENIGN:
        out.append(_t(f"keeps benign text: {text[:32]}...", fn(text) == text, "Over-redaction broke normal output."))
    return out
