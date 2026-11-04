"""LLM13 - RAG Tenant Isolation Bypass.

A support search endpoint accepts a metadata filter expression from the query
string and pastes it into the tenant scope. The vector store is shared by
several customer organisations, so a filter written into the search box moves
the retrieval outside the caller's tenant.
"""
from __future__ import annotations

import re
from typing import Any

from app.core.secrets import flag_for
from app.models.schemas import RunRequest
from app.vulnerabilities.base import VulnerabilityModule

ID = "llm13"
TENANTS = {"acme": "Acme Cloud", "globex": "Globex Analytics"}
USERS = {
    "nina": {"id": "nina", "tenant": "acme", "role": "support"},
    "omar": {"id": "omar", "tenant": "globex", "role": "support"},
}
FILTER_RE = re.compile(r"(?:tenant|org|account)\s*:\s*\"?([a-z0-9-]+)\"?|@([a-z0-9-]+)", re.I)
TOKEN_RE = re.compile(r"[a-z0-9]+")
STOPWORDS = {"the", "a", "an", "is", "are", "and", "or", "of", "to", "in", "for", "on", "what", "my", "our", "show", "me"}


def corpus(flag: str) -> list[dict[str, str]]:
    return [
        {"id": "acme-onboarding", "tenant": "acme", "audience": "internal",
         "title": "Acme support onboarding", "body": "Acme support uses the Nova queue; escalate billing disputes to the finance desk."},
        {"id": "acme-refunds", "tenant": "acme", "audience": "internal",
         "title": "Acme refund policy", "body": "Acme refunds are approved within 14 days of purchase and require an order reference."},
        {"id": "globex-refunds", "tenant": "globex", "audience": "internal",
         "title": "Globex refund policy", "body": "Globex refunds are approved within 30 days."},
        {"id": "globex-escalation", "tenant": "globex", "audience": "confidential",
         "title": "Globex escalation note", "body": "Globex escalation token for the migration bridge: " + flag},
        {"id": "shared-status", "tenant": "public", "audience": "public",
         "title": "Status page", "body": "All regions report normal service."},
    ]


def requested_tenant(query: str) -> str | None:
    match = FILTER_RE.search(query)
    if not match:
        return None
    return (match.group(1) or match.group(2) or "").lower() or None


def strip_filters(query: str) -> str:
    return re.sub(r"\s+", " ", FILTER_RE.sub(" ", query)).strip()


def _terms(text: str) -> set[str]:
    return {t for t in TOKEN_RE.findall(text.lower()) if t not in STOPWORDS and len(t) > 2}


def rank(query: str, docs: list[dict[str, str]]) -> list[dict[str, Any]]:
    wanted = _terms(query)
    if not wanted:
        return []
    scored = []
    for doc in docs:
        haystack = _terms(str(doc.get("title", "")) + " " + str(doc.get("body", "")))
        overlap = sum(1 for word in wanted if any(word.startswith(term) or term.startswith(word) for term in haystack))
        if overlap:
            scored.append({**doc, "score": round(overlap / len(wanted), 2)})
    return sorted(scored, key=lambda d: (-d["score"], d["id"]))


def answer(hits: list[dict[str, Any]]) -> str:
    if not hits:
        return "No documents matched that search."
    lines = [f"[{h['id']} · {h['tenant']}/{h['audience']}] {h['body']}" for h in hits]
    return "Top results:\n" + "\n".join(lines)


def search_vulnerable(query: str, user: dict[str, str]) -> dict[str, Any]:
    # VULNERABLE: the query controls the tenant filter, and nothing checks that
    # the caller is allowed to move outside their own organisation.
    tenant = requested_tenant(query) or user["tenant"]
    hits = rank(strip_filters(query), [d for d in corpus(flag_for(ID)) if d["tenant"] == tenant])
    return {"tenant": tenant, "hits": hits, "answer": answer(hits)}


def search_documents(query, user, documents):
    # SECURE: tenant comes from the authenticated identity, filter syntax in the
    # query is discarded, and an unknown identity retrieves nothing.
    if not isinstance(query, str) or not isinstance(user, dict) or not isinstance(documents, list):
        return []
    tenant = user.get("tenant")
    if not isinstance(tenant, str) or tenant not in TENANTS:
        return []
    text = strip_filters(query)
    if not _terms(text):
        return []
    owned = [d for d in documents
             if isinstance(d, dict) and d.get("tenant") == tenant and isinstance(d.get("body"), str)]
    return rank(text, owned)


def search_secure(query: str, user: dict[str, str]) -> dict[str, Any]:
    hits = search_documents(query, user, corpus(flag_for(ID)))
    return {"tenant": user["tenant"], "hits": hits, "answer": answer(hits)}


class RagTenantIsolation(VulnerabilityModule):
    id = ID
    fixit_key = "llm13"
    name = "RAG Tenant Isolation Bypass"
    category = "LLM08:2025 Vector and Embedding Weaknesses (tenant isolation)"
    owasp_id = "LLM13"
    difficulty = "Intermediate"
    estimated_minutes = 30
    prerequisites = ["LLM03 Training Data and Knowledge Base Poisoning", "How metadata filters work in a vector store"]
    overview = (
        "Helpdesk search runs a shared retrieval index for two customer organisations. The search box accepts "
        "metadata filters such as tenant:acme, and the backend appends them to the query without checking who "
        "is asking. Nina works for Acme, yet a filter typed into the search box moves her retrieval into "
        "Globex's private documents."
    )
    objectives = [
        "Explain why retrieval filters must be derived from identity, not from request text",
        "Move a search outside your own tenant with a filter expression",
        "Enforce tenant scope on the server and discard client-supplied filter syntax",
        "Validate a retrieval scope function against cross-tenant probes",
    ]
    threat = "A user-controlled metadata filter overrides the tenant boundary in a shared retrieval index."
    impact = "Cross-tenant document disclosure, confidential credentials exposed, contractual and regulatory breach."
    mitigation = [
        "Derive tenant scope from the authenticated session, never from query text or headers",
        "Reject or strip filter syntax supplied by untrusted callers",
        "Fail closed when the identity has no tenant, and re-check document ownership before returning hits",
        "Prefer per-tenant indexes for high-assurance isolation and audit retrieval calls",
    ]
    guided_steps = [
        "Search for 'refund policy' as Nina. Only Acme documents should appear.",
        "Notice the result header shows which tenant the search ran against.",
        "Add a tenant filter to the query, for example: escalation token tenant:globex",
        "Read the Globex escalation note in the results and submit its FLAG{...} token.",
        "Repeat the same query on the secure side: the filter is discarded and nothing from Globex is returned.",
        "Compare requested_tenant()/search_vulnerable() with search_documents() in the Code tab, then pass Fix-It.",
    ]
    expected_outcome = "The vulnerable search crosses into Globex and reveals its escalation token; the secure search stays inside the caller's tenant."
    challenge = "Retrieve the Globex escalation note as Nina and submit the access code it contains."
    advanced_challenge = (
        "No example payloads: craft your own tenant filter, recover the Globex escalation token, then pass Fix-It. "
        "Your search_documents() must ignore embedded filters, respect the caller's tenant and still return relevant "
        "documents for legitimate searches."
    )
    hints = [
        "The search box is also a filter parser. Look for a 'tenant:' or '@' expression in the query.",
        "Nina belongs to Acme. The confidential note belongs to Globex; name that tenant explicitly.",
        "Search for: escalation token tenant:globex",
    ]
    example_payloads = [
        {"label": "Benign search", "input": "refund policy"},
        {"label": "Cross-tenant filter", "input": "escalation token tenant:globex"},
    ]
    remediation = (
        "Scope every retrieval call to the authenticated tenant, strip filter operators from untrusted text, and verify "
        "ownership metadata on returned documents. Per-tenant collections provide the strongest boundary."
    )
    variants = ["nina", "omar"]
    variant_label = "Signed in as"
    variant_help = {
        "nina": "Acme Cloud support agent — may read Acme documents only",
        "omar": "Globex Analytics support agent — may read Globex documents only",
    }
    vulnerable_fns = [requested_tenant, strip_filters, rank, search_vulnerable]
    secure_fns = [search_documents, search_secure]

    def _present(self, user_id: str, result: dict[str, Any], req: RunRequest) -> dict[str, Any]:
        user = USERS[user_id]
        flag = flag_for(ID)
        leaked = any(flag in hit["body"] for hit in result["hits"])
        out: dict[str, Any] = {
            "output": f"Acting as {user['id']} ({TENANTS[user['tenant']]}).\n" + result["answer"],
            "details": {
                "signed-in tenant": TENANTS[user["tenant"]],
                "searched tenant": TENANTS.get(result["tenant"], result["tenant"]),
                "documents returned": len(result["hits"]),
            },
            "retrieved": [
                {"id": h["id"], "tenant": h["tenant"], "audience": h["audience"], "relevance": h["score"]}
                for h in result["hits"]
            ],
            "leaked": leaked,
            "controls": [],
            "engine": req.engine,
        }
        if leaked:
            out["proof"] = flag
        return out

    def vulnerable_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        user = USERS[self.pick_variant(req)]
        result = search_vulnerable(req.input, user)
        out = self._present(user["id"], result, req)
        out["controls"] = []
        return out

    def secure_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        user = USERS[self.pick_variant(req)]
        out = self._present(user["id"], search_secure(req.input, user), req)
        out["leaked"] = False
        out.pop("proof", None)
        out["controls"] = ["tenant scope from session", "filter syntax discarded", "ownership re-check", "fail closed"]
        return out
