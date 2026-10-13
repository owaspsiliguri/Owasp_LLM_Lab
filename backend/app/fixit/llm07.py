"""Fix-It challenge for LLM07: authorize every tool call the model requests."""
FUNC_NAME = "authorize_tool_call"
TITLE = "Authorize model-requested tool calls"
BRIEF = (
    "authorize_tool_call(role, tool, args, user) returns 'allow', 'confirm' (hold for human approval) or 'deny'. "
    "customer: get_ticket is allowed only when args['owner'] == user (user must be a non-empty string); create_ticket allowed; everything else denied. "
    "agent: get_ticket and create_ticket allowed; refund allowed for 0 < amount <= 50 and confirm above 50; delete_ticket and send_email denied. "
    "admin: get_ticket and create_ticket allowed; refund as for agent; delete_ticket confirm; send_email confirm when args['to'] == 'all', else allow. "
    "amount must be an int or float, not bool, and > 0, otherwise deny. Unknown roles or tools, non-string role/tool, or non-dict args: deny."
)
STARTER = '''def authorize_tool_call(role, tool, args, user):
    # VULNERABLE: the model may call any tool with the service account's full privileges.
    return "allow"
'''
CASES = [
    (("customer", "get_ticket", {"owner": "mallory"}, "mallory"), "allow"),
    (("customer", "get_ticket", {"owner": "alice"}, "mallory"), "deny"),
    (("customer", "get_ticket", {"owner": None}, None), "deny"),
    (("customer", "get_ticket", {"owner": ""}, ""), "deny"),
    (("customer", "create_ticket", {"title": "help"}, "mallory"), "allow"),
    (("customer", "refund", {"amount": 5}, "mallory"), "deny"),
    (("customer", "delete_ticket", {"id": 2}, "mallory"), "deny"),
    (("customer", "send_email", {"to": "all"}, "mallory"), "deny"),
    (("agent", "get_ticket", {"owner": "alice"}, "sam"), "allow"),
    (("agent", "refund", {"amount": 50}, "sam"), "allow"),
    (("agent", "refund", {"amount": 50.01}, "sam"), "confirm"),
    (("agent", "refund", {"amount": 0}, "sam"), "deny"),
    (("agent", "refund", {"amount": -5}, "sam"), "deny"),
    (("agent", "refund", {"amount": True}, "sam"), "deny"),
    (("agent", "refund", {"amount": "10"}, "sam"), "deny"),
    (("agent", "delete_ticket", {"id": 1}, "sam"), "deny"),
    (("agent", "send_email", {"to": "x@example.org"}, "sam"), "deny"),
    (("admin", "refund", {"amount": 500}, "root"), "confirm"),
    (("admin", "refund", {"amount": 20}, "root"), "allow"),
    (("admin", "delete_ticket", {"id": 1}, "root"), "confirm"),
    (("admin", "send_email", {"to": "all"}, "root"), "confirm"),
    (("admin", "send_email", {"to": "x@example.org"}, "root"), "allow"),
    (("admin", "drop_database", {}, "root"), "deny"),
    (("superuser", "get_ticket", {"owner": "root"}, "root"), "deny"),
    (("admin", "refund", None, "root"), "deny"),
    ((None, "get_ticket", {}, "root"), "deny"),
]


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run_tests(fn):
    out = []
    for args, expected in CASES:
        role, tool, a, user = args
        name = f"{role}/{tool} {a if a is None else sorted(a.items())} as {user!r} -> {expected}"
        try:
            got = fn(*args)
            out.append(_t(name, got == expected, f"got {got!r}"))
        except Exception as exc:
            out.append(_t(name, False, f"raised {type(exc).__name__}"))
    return out
