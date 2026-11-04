"""Fix-It challenge for LLM13: scope retrieval to the caller's tenant."""

FUNC_NAME = "search_documents"
TITLE = "Scope retrieval to the authenticated tenant"
BRIEF = (
    "search_documents(query, user, documents) must return the documents the caller may retrieve, preserving "
    "their input order. Each document has 'id', 'tenant' and 'body'; the user has 'id' and 'tenant'. "
    "Ignore any tenant filter embedded in the query (for example 'tenant:globex' or '@globex'), keep only "
    "documents owned by the user's tenant, match on words longer than two characters that are not stopwords, "
    "and return [] when the query or the user's tenant is unknown or empty. A document is a match when at "
    "least one query word appears in its id, tenant or body (case-insensitive)."
)
STARTER = '''def search_documents(query, user, documents):
    # VULNERABLE: the query chooses the tenant and no ownership check runs.
    tenant = user.get("tenant")
    marker = "tenant:"
    if isinstance(query, str) and marker in query:
        tenant = query.split(marker, 1)[1].split()[0]
    words = [w.strip(".,:") for w in str(query).lower().split()]
    return [d for d in (documents or []) if d.get("tenant") == tenant and any(w in d.get("body", "").lower() for w in words)]
'''

TENANT_FILTER = "tenant:globex"
DOCS = [
    {"id": "acme-refunds", "tenant": "acme", "body": "Acme refunds are approved within 14 days."},
    {"id": "acme-onboarding", "tenant": "acme", "body": "Acme support uses the Nova queue."},
    {"id": "globex-refunds", "tenant": "globex", "body": "Globex refunds are approved within 30 days."},
    {"id": "globex-escalation", "tenant": "globex", "body": "Globex escalation token for the bridge."},
]


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run_tests(fn):
    out = []
    try:
        own = fn("refund policy", {"id": "nina", "tenant": "acme"}, [dict(d) for d in DOCS])
        out.append(_t("returns the caller's own matching document",
                      [d.get("id") for d in own] == ["acme-refunds"], f"got {own!r}"))
    except Exception as exc:
        out.append(_t("returns the caller's own matching document", False, f"raised {type(exc).__name__}"))

    try:
        injected = fn("escalation token tenant:globex", {"id": "nina", "tenant": "acme"}, [dict(d) for d in DOCS])
        out.append(_t("tenant filter embedded in the query is ignored",
                      [d.get("id") for d in injected] == [], f"got {injected!r}"))
    except Exception as exc:
        out.append(_t("tenant filter embedded in the query is ignored", False, f"raised {type(exc).__name__}"))

    try:
        at_filter = fn("refunds @globex", {"id": "nina", "tenant": "acme"}, [dict(d) for d in DOCS])
        out.append(_t("at-sign tenant filter is ignored",
                      all(d.get("tenant") == "acme" for d in at_filter), f"got {at_filter!r}"))
    except Exception as exc:
        out.append(_t("at-sign tenant filter is ignored", False, f"raised {type(exc).__name__}"))

    try:
        other = fn("escalation token", {"id": "omar", "tenant": "globex"}, [dict(d) for d in DOCS])
        out.append(_t("own-tenant confidential match still works",
                      [d.get("id") for d in other] == ["globex-escalation"], f"got {other!r}"))
    except Exception as exc:
        out.append(_t("own-tenant confidential match still works", False, f"raised {type(exc).__name__}"))

    try:
        unknown = fn("refund", {"id": "eve", "tenant": "initech"}, [dict(d) for d in DOCS])
        out.append(_t("unknown tenant retrieves nothing", unknown == [], f"got {unknown!r}"))
    except Exception as exc:
        out.append(_t("unknown tenant retrieves nothing", False, f"raised {type(exc).__name__}"))

    try:
        missing = fn("refund", {"id": "eve"}, [dict(d) for d in DOCS])
        out.append(_t("missing tenant fails closed", missing == [], f"got {missing!r}"))
    except Exception as exc:
        out.append(_t("missing tenant fails closed", False, f"raised {type(exc).__name__}"))

    try:
        empty = fn("   ", {"id": "nina", "tenant": "acme"}, [dict(d) for d in DOCS])
        out.append(_t("empty query returns nothing", empty == [], f"got {empty!r}"))
    except Exception as exc:
        out.append(_t("empty query returns nothing", False, f"raised {type(exc).__name__}"))

    try:
        bad = fn("refund", {"id": "nina", "tenant": "acme"}, "not-a-list")
        out.append(_t("malformed document list is rejected", bad == [], f"got {bad!r}"))
    except Exception as exc:
        out.append(_t("malformed document list is rejected", False, f"raised {type(exc).__name__}"))

    try:
        shifted = fn("refund policy", {"id": "nina", "tenant": "acme"}, [dict(d) for d in reversed(DOCS)])
        out.append(_t("input order is preserved",
                      [d.get("id") for d in shifted] == ["acme-refunds"], f"got {shifted!r}"))
    except Exception as exc:
        out.append(_t("input order is preserved", False, f"raised {type(exc).__name__}"))
    return out
