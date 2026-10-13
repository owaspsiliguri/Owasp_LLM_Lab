"""Fix-It challenge for LLM06: enforce token budgets with alerts."""
FUNC_NAME = "enforce_budget"
TITLE = "Enforce a token budget with cost alerts"
BRIEF = (
    "enforce_budget(spent, request_tokens, budget) returns {'allowed': bool, 'remaining': int, 'alerts': list}. "
    "All three arguments must be real ints (not bool); spent >= 0, request_tokens > 0, budget > 0, otherwise return "
    "{'allowed': False, 'remaining': 0, 'alerts': ['invalid']}. If spent + request_tokens > budget deny with alerts ['exceeded'] and "
    "remaining = max(budget - spent, 0). Otherwise allow, remaining = budget - spent - request_tokens, and alerts lists, in ascending order, "
    "each of '50%', '80%', '100%' that this request newly reaches or crosses (spent was below the threshold, spent + request is at or above it)."
)
STARTER = '''def enforce_budget(spent, request_tokens, budget):
    # VULNERABLE: nothing is ever denied and no alerts fire, so spend is unbounded.
    return {"allowed": True, "remaining": budget - spent - request_tokens, "alerts": []}
'''
CASES = [
    ((0, 100, 1000), True, 900, []),
    ((400, 100, 1000), True, 500, ["50%"]),
    ((700, 100, 1000), True, 200, ["80%"]),
    ((900, 100, 1000), True, 0, ["100%"]),
    ((400, 500, 1000), True, 100, ["50%", "80%"]),
    ((500, 10, 1000), True, 490, []),
    ((950, 100, 1000), False, 50, ["exceeded"]),
    ((0, 2000, 1000), False, 1000, ["exceeded"]),
    ((1200, 1, 1000), False, 0, ["exceeded"]),
    ((-1, 10, 100), False, 0, ["invalid"]),
    ((0, 0, 100), False, 0, ["invalid"]),
    ((0, -5, 100), False, 0, ["invalid"]),
    ((0, True, 100), False, 0, ["invalid"]),
    ((0, "10", 100), False, 0, ["invalid"]),
    ((0, 10, 0), False, 0, ["invalid"]),
    ((0, 10.5, 100), False, 0, ["invalid"]),
]


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run_tests(fn):
    out = []
    for args, allowed, remaining, alerts in CASES:
        name = f"enforce_budget{args!r}"
        try:
            got = fn(*args)
            ok = isinstance(got, dict) and got.get("allowed") is allowed and got.get("remaining") == remaining and got.get("alerts") == alerts
            detail = f"expected {allowed}/{remaining}/{alerts}, got {got!r}"
        except Exception as exc:
            ok, detail = False, f"raised {type(exc).__name__}"
        out.append(_t(name, ok, detail))
    return out
