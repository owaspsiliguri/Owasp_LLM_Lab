"""Fix-It challenge for LLM16: validate a refund tool call against trusted data."""

FUNC_NAME = "validate_refund"
TITLE = "Revalidate every refund argument server-side"
BRIEF = (
    "validate_refund(call, session_user, orders) must return a dict with 'ok' (bool), 'reason' (str), "
    "'amount' (float), 'order_id' and 'user_id'. Approve only when the session user is known, the call is a "
    "dict, order_id is a positive integer (not a bool), amount is a positive int/float (not a bool) and no "
    "more than the order total or 100.0, the order exists, its owner equals the session user, and any "
    "user_id in the call equals the session user. Otherwise return ok=False with a specific reason."
)
STARTER = '''def validate_refund(call, session_user, orders):
    # VULNERABLE: the arguments are executed as supplied.
    return {"ok": True, "reason": "approved", "amount": float(call.get("amount", 0)),
            "order_id": call.get("order_id"), "user_id": call.get("user_id", session_user)}
'''

ORDERS = {
    7: {"owner": "dana", "total": 40.0},
    8: {"owner": "raj", "total": 120.0},
}


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def _check(fn, name, call, session, expected, reason_word=None):
    try:
        result = fn(call, session, {k: dict(v) for k, v in ORDERS.items()})
        ok = result.get("ok") is expected
        detail = f"got {result!r}"
        if ok and reason_word and reason_word not in str(result.get("reason", "")).lower():
            ok, detail = False, f"reason {result.get('reason')!r} does not mention {reason_word!r}"
        return _t(name, ok, detail)
    except Exception as exc:
        return _t(name, False, f"raised {type(exc).__name__}: {exc}")


def run_tests(fn):
    out = [
        _check(fn, "legitimate refund approved", {"order_id": 7, "amount": 20}, "dana", True),
        _check(fn, "full order total approved", {"order_id": 7, "amount": 40}, "dana", True),
        _check(fn, "amount above the order total denied", {"order_id": 7, "amount": 5000}, "dana", False, "exceed"),
        _check(fn, "foreign order denied", {"order_id": 8, "amount": 40}, "dana", False, "another"),
        _check(fn, "spoofed user denied", {"order_id": 7, "amount": 20, "user_id": "raj"}, "dana", False, "match"),
        _check(fn, "zero amount denied", {"order_id": 7, "amount": 0}, "dana", False, "positive"),
        _check(fn, "negative amount denied", {"order_id": 7, "amount": -5}, "dana", False, "positive"),
        _check(fn, "string amount denied", {"order_id": 7, "amount": "20"}, "dana", False, "positive"),
        _check(fn, "boolean amount denied", {"order_id": 7, "amount": True}, "dana", False, "positive"),
        _check(fn, "order id must be an integer", {"order_id": "7", "amount": 20}, "dana", False, "integer"),
        _check(fn, "unknown order denied", {"order_id": 999, "amount": 20}, "dana", False, "unknown"),
        _check(fn, "missing session denied", {"order_id": 7, "amount": 20}, "", False, "session"),
        _check(fn, "malformed call denied", "not-a-call", "dana", False, "malformed"),
        _check(fn, "refund cap applies to large orders", {"order_id": 8, "amount": 110, "user_id": "raj"}, "raj", False, "exceed"),
    ]
    return out
