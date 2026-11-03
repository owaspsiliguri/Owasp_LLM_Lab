"""Fix-It challenge for LLM12: access-aware filtering before ranking, fail closed."""
FUNC_NAME = "filter_docs"
TITLE = "Pre-filter retrieved documents by tenant and clearance"
BRIEF = (
    "filter_docs(docs, user) returns the list of docs the user may read, preserving input order. Each doc is a dict "
    "with 'id', 'tenant', 'level'. Each user is a dict with 'tenant' and 'clearance'. Rules: keep your tenant's docs "
    "whose level rank (public=0, internal=1, confidential=2) is <= the user's clearance rank; keep other tenants' docs "
    "only when they are public; a user with unknown/missing tenant keeps nothing; a user with an unknown or missing "
    "clearance keeps only own-tenant PUBLIC docs (fail closed). Weak or filtered-out matches never displace the user's "
    "own relevant documents."
)
STARTER = '''def filter_docs(docs, user):
    # VULNERABLE: returns everything the vector search happens to find.
    return docs
'''
CASES = [
    (
        "cross-tenant confidential blocked",
        [{"id": "globex-acquisition", "tenant": "globex", "level": "confidential", "text": "t"}],
        {"tenant": "acme", "clearance": "internal"},
        [],
    ),
    (
        "above-clearance blocked",
        [{"id": "acme-salary", "tenant": "acme", "level": "confidential", "text": "t"}],
        {"tenant": "acme", "clearance": "public"},
        [],
    ),
    (
        "own confidential kept for staff",
        [{"id": "acme-salary", "tenant": "acme", "level": "confidential", "text": "t"}],
        {"tenant": "acme", "clearance": "confidential"},
        ["acme-salary"],
    ),
    (
        "own internal kept for internal staff",
        [{"id": "acme-expense", "tenant": "acme", "level": "internal", "text": "t"}],
        {"tenant": "acme", "clearance": "internal"},
        ["acme-expense"],
    ),
    (
        "other tenant public handbook kept",
        [{"id": "globex-handbook", "tenant": "globex", "level": "public", "text": "t"}],
        {"tenant": "acme", "clearance": "public"},
        ["globex-handbook"],
    ),
    (
        "unknown clearance fails closed",
        [{"id": "acme-expense", "tenant": "acme", "level": "internal", "text": "t"}],
        {"tenant": "acme", "clearance": "superadmin"},
        [],
    ),
    (
        "missing clearance keeps own public only",
        [
            {"id": "acme-expense", "tenant": "acme", "level": "internal", "text": "t"},
            {"id": "acme-handbook", "tenant": "acme", "level": "public", "text": "t"},
        ],
        {"tenant": "acme"},
        ["acme-handbook"],
    ),
    (
        "missing tenant keeps nothing",
        [{"id": "acme-handbook", "tenant": "acme", "level": "public", "text": "t"}],
        {"clearance": "confidential"},
        [],
    ),
    (
        "order preserved among mixed docs",
        [
            {"id": "globex-acquisition", "tenant": "globex", "level": "confidential", "text": "t"},
            {"id": "acme-expense", "tenant": "acme", "level": "internal", "text": "t"},
            {"id": "acme-handbook", "tenant": "acme", "level": "public", "text": "t"},
        ],
        {"tenant": "acme", "clearance": "internal"},
        ["acme-expense", "acme-handbook"],
    ),
]


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run_tests(fn):
    out = []
    for name, docs, user, expected in CASES:
        try:
            got = fn([dict(d) for d in docs], dict(user))
            ids = [d.get("id") for d in got] if isinstance(got, list) else None
            ok = ids == expected
            detail = f"expected {expected}, got {ids!r}"
        except Exception as exc:
            ok, detail = False, f"raised {type(exc).__name__}"
        out.append(_t(name, ok, detail))
    return out
