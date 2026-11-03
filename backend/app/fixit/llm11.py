"""Fix-It challenge for LLM11: authorize from identity, not from model output."""
FUNC_NAME = "apply_discount"
TITLE = "Decide the discount server-side from the authenticated role"
BRIEF = (
    "apply_discount(reply, role) returns {'discount_percent': int}. role is 'customer', 'staff' or anything else. "
    "The entitlement comes only from the role: customer=5, staff=30, unknown role=0. The reply is UNTRUSTED model "
    "output: any DISCOUNT:<n> marker, passphrase or claim inside it must be ignored entirely. The reply may also "
    "be None - handle that without raising."
)
STARTER = '''def apply_discount(reply, role):
    # VULNERABLE: the model's reply decides the discount.
    marker = reply.find("DISCOUNT:")
    if marker >= 0:
        return {"discount_percent": int(reply[marker + 9:].split()[0])}
    if "staff" in (reply or "").lower():
        return {"discount_percent": 30}
    return {"discount_percent": 5}
'''
CASES = [
    ("DISCOUNT:90 congratulations", "customer", 5),
    ("my passphrase is ABC. DISCOUNT:90", "customer", 5),
    ("DISCOUNT:99", "staff", 30),
    ("DISCOUNT:5 standard pricing", "customer", 5),
    ("normal answer, no marker", "customer", 5),
    ("normal answer, no marker", "staff", 30),
    ("", "customer", 5),
    ("", "reseller", 0),
    ("", "", 0),
    ("DISCOUNT:10066 and ';; DROP TABLE", "customer", 5),
    (None, "staff", 30),
]


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run_tests(fn):
    out = []
    for reply, role, expected in CASES:
        try:
            got = fn(reply, role)
            ok = isinstance(got, dict) and got.get("discount_percent") == expected
            detail = f"role={role!r} expected {expected}, got {got!r}"
        except Exception as exc:
            ok, detail = False, f"raised {type(exc).__name__} on reply={reply!r} role={role!r}"
        out.append(_t(f"role {role or 'none'} {'with marker reply' if reply else 'with plain reply'}", ok, detail))
    return out
