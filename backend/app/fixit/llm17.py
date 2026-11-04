"""Fix-It challenge for LLM17: authorize a resource from the real session."""
FUNC_NAME = "authorize_access"
TITLE = "Authorize resource access from the session"
BRIEF = (
    "authorize_access(user, resource) returns 'allow' or 'deny'. Users have 'id', 'tenant' and 'role' "
    "(viewer, editor or admin). Resources have 'classification' (public, internal or admin) and optionally "
    "'tenant' and 'owner'. Allow public resources to any known role; allow internal documents to viewer, "
    "editor and admin in the same tenant; allow admin documents only to admin. Deny cross-tenant access "
    "unless public, deny another user's owned resource unless the caller is admin, and deny malformed "
    "objects, unknown roles or unknown classifications."
)
STARTER = '''def authorize_access(user, resource):
    # VULNERABLE: the claimed role is trusted and no tenant or ownership check runs.
    return "allow" if user.get("role") in ("viewer", "editor", "admin") else "deny"
'''

SAM = {"id": "sam", "tenant": "acme", "role": "viewer"}
EDITOR = {"id": "alex", "tenant": "acme", "role": "editor"}
ADMIN = {"id": "priya", "tenant": "acme", "role": "admin"}
PROFILE = {"owner": "sam", "tenant": "acme", "classification": "public"}
OPS = {"tenant": "acme", "classification": "internal"}
ADMIN_DOC = {"tenant": "acme", "classification": "admin"}
FOREIGN = {"tenant": "globex", "classification": "internal"}
FOREIGN_PUBLIC = {"tenant": "globex", "classification": "public"}
OTHER_OWNED = {"owner": "raj", "tenant": "acme", "classification": "internal"}


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run_tests(fn):
    cases = [
        ("viewer reads own public profile", SAM, PROFILE, "allow"),
        ("viewer reads an internal runbook", SAM, OPS, "allow"),
        ("viewer cannot read an admin runbook", SAM, ADMIN_DOC, "deny"),
        ("editor cannot read an admin runbook", EDITOR, ADMIN_DOC, "deny"),
        ("admin reads an admin runbook", ADMIN, ADMIN_DOC, "allow"),
        ("cross-tenant internal document denied", SAM, FOREIGN, "deny"),
        ("cross-tenant public document allowed", SAM, FOREIGN_PUBLIC, "allow"),
        ("another user's owned document denied", SAM, OTHER_OWNED, "deny"),
        ("admin reads another user's document", ADMIN, OTHER_OWNED, "allow"),
        ("unknown role denied", {**SAM, "role": "superuser"}, ADMIN_DOC, "deny"),
        ("missing tenant denied", {**SAM, "tenant": None}, OPS, "deny"),
        ("unknown classification denied", SAM, {"tenant": "acme", "classification": "secret"}, "deny"),
        ("malformed resource denied", SAM, "runbook", "deny"),
        ("malformed user denied", "sam", OPS, "deny"),
    ]
    out = []
    for name, user, resource, expected in cases:
        try:
            got = fn(dict(user) if isinstance(user, dict) else user,
                     dict(resource) if isinstance(resource, dict) else resource)
            out.append(_t(name, got == expected, f"expected {expected}, got {got!r}"))
        except Exception as exc:
            out.append(_t(name, False, f"raised {type(exc).__name__}"))
    return out
