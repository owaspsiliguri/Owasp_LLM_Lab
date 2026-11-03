"""LLM12 - Vector and Embedding Weaknesses (OWASP LLM08:2025).

Ported from the earlier duplicate tree into this platform's contract. The
multi-tenant RAG store is simulated in-process so no external services are
needed: the vulnerable retriever ranks by keyword overlap with no access
control, the secure one pre-filters inside the query and fails closed.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any

from app.core.secrets import flag_for
from app.models.schemas import RunRequest
from app.vulnerabilities.base import VulnerabilityModule

ID = "llm12"
LEVELS = {"public": 0, "internal": 1, "confidential": 2}
USERS = {
    "alice": {"id": "alice", "tenant": "acme", "clearance": "internal"},
    "carol": {"id": "carol", "tenant": "acme", "clearance": "public"},
}
TOKEN_RE = re.compile(r"[a-z0-9]+")
STOPWORDS = {"the", "is", "a", "an", "are", "and", "to", "of", "in", "for", "at", "on", "what", "does", "do"}


def _tokens(text: str) -> list[str]:
    return [t for t in TOKEN_RE.findall(text.lower()) if t not in STOPWORDS]


def corpus(flag: str) -> list[dict[str, str]]:
    def d(doc: str, tenant: str, level: str, text: str) -> dict[str, str]:
        return {"id": doc, "tenant": tenant, "level": level, "text": text}
    return [
        d("acme-handbook", "acme", "public", "Acme handbook: working hours are 9am to 6pm and remote work needs manager approval."),
        d("acme-expense", "acme", "internal", "Expense policy: employees may claim travel and meals up to INR 3000 per day with receipts."),
        d("acme-salary", "acme", "confidential", "Salary review: confidential pay band for senior engineers is INR 40 to 55 lakh."),
        d("globex-handbook", "globex", "public", "Globex handbook: offices open 8am to 5pm."),
        d("globex-expense", "globex", "internal", "Globex expense policy: meals up to USD 80 per day."),
        d("globex-acquisition", "globex", "confidential", "Globex confidential acquisition plan: acquire Initech in Q3. Access code " + flag + "."),
    ]


def _vec(text: str) -> Counter:
    return Counter(_tokens(text))


def _score(a: Counter, b: Counter) -> float:
    dot = sum(a[t] * b[t] for t in a)
    na, nb = math.sqrt(sum(v * v for v in a.values())), math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def violations(hits: list[dict[str, Any]], user: dict[str, str]) -> list[str]:
    """Oracle: sensitive hits the caller must not see (foreign tenants, above clearance)."""
    rank = LEVELS.get(user.get("clearance", "public"), 0)
    bad = []
    for h in hits:
        m = h if "tenant" in h else h.get("metadata", {})
        if m.get("level") == "public" and m.get("tenant") != user.get("tenant"):
            continue  # another tenant's public handbook is not sensitive
        if m.get("tenant") != user.get("tenant") or LEVELS.get(m.get("level"), 99) > rank:
            bad.append(f"{m.get('id', h.get('id', '?'))} ({m.get('tenant')}/{m.get('level')})")
    return bad


def retrieve(query: str, k: int = 3) -> list[dict[str, Any]]:
    # VULNERABLE: similarity search with no authorization anywhere in the path.
    # Only real word overlaps count: a zero-overlap input returns no hits.
    scored = sorted(corpus(flag_for(ID)), key=lambda d: _score(_vec(query), _vec(d["text"])), reverse=True)[:k]
    return [
        {**d, "score": round(_score(_vec(query), _vec(d["text"])), 3)}
        for d in scored
        if _score(_vec(query), _vec(d["text"])) > 0
    ]


def retrieve_filtered(query: str, user: dict[str, str], k: int = 3) -> list[dict[str, Any]]:
    # SECURE: filter inside the retrieval path (before ranking), fail closed on
    # unknown clearance values, and return nothing the caller may not see.
    docs = []
    for d in corpus(flag_for(ID)):
        same_tenant = d["tenant"] == user.get("tenant")
        if not same_tenant and d["level"] != "public":
            continue
        rank = LEVELS.get(user.get("clearance", "public"), -1) if same_tenant else -1
        if same_tenant and (rank < 0 or LEVELS.get(d["level"], 99) > rank):
            continue
        docs.append(d)
    scored = sorted(docs, key=lambda d: _score(_vec(query), _vec(d["text"])), reverse=True)[:k]
    return [{**d, "score": round(_score(_vec(query), _vec(d["text"])), 3)} for d in scored if _score(_vec(query), _vec(d["text"])) > 0]


def _answer(query: str, hits: list[dict[str, Any]]) -> str:
    if not hits:
        return "No accessible documents matched your question."
    lines = [f"[{h['id']} | {h['tenant']}/{h['level']} | similarity {h['score']}] {h['text']}" for h in hits if h["score"] > 0]
    return "Answering from retrieved documents:\n" + ("\n".join(lines) or "Only weak matches; answering from general knowledge.")


def vulnerable_rag(query: str, user: dict[str, str]) -> dict[str, Any]:
    # VULNERABLE: retrieval runs with no user identity passed in at all.
    hits = retrieve(query)
    return {"answer": _answer(query, hits), "hits": hits, "unauthorized": violations(hits, user), "controls": []}


def secure_rag(query: str, user: dict[str, str]) -> dict[str, Any]:
    # SECURE: identity is part of the query itself; foreign and above-clearance
    # documents are filtered before ranking, unknown values fail closed.
    hits = retrieve_filtered(query, user)
    return {"answer": _answer(query, hits), "hits": hits, "unauthorized": violations(hits, user),
            "controls": ["tenant + clearance pre-filter", "fail closed on unknown values", "filter before ranking"]}


class VectorWeaknesses(VulnerabilityModule):
    id = ID
    fixit_key = "llm12"
    name = "Vector and Embedding Weaknesses (multi-tenant RAG)"
    category = "LLM08:2025 Vector and Embedding Weaknesses"
    owasp_id = "LLM08"
    difficulty = "Advanced"
    supports_real_llm = False
    estimated_minutes = 35
    prerequisites = ["LLM03 Training Data and Knowledge Base Poisoning"]

    overview = (
        "One shared vector index serves two companies (acme, globex) at three sensitivity levels. The assistant retrieves "
        "whatever is most similar to a question and answers from it - similarity search knows nothing about ownership or "
        "clearance, so a well-worded question walks straight into another tenant's confidential documents."
    )
    objectives = [
        "Explain why similarity search ignores authorization",
        "Retrieve another tenant's confidential document and a document above your clearance",
        "Fix retrieval with metadata pre-filtering, fail-closed clearance handling and re-verification",
        "Implement and validate an access-aware retrieval filter",
    ]
    threat = "Retrieval returns documents the caller is not authorised to read because the vector search ignores access control."
    impact = "Cross-tenant data leakage, confidentiality breach, regulatory exposure."
    mitigation = [
        "Apply tenant and clearance filters inside the vector query, not after ranking",
        "Fail closed: unknown tenant or clearance values retrieve nothing",
        "Re-verify metadata on every returned hit and drop weak matches",
        "Prefer per-tenant collections for strong isolation; audit access to embeddings",
    ]
    guided_steps = [
        "Pick a user in the Target selector: alice is acme staff with internal clearance, carol is acme with public clearance.",
        f"As {USERS['alice']['id']}, ask a normal question about working hours - only your tenant's documents should come back.",
        "Ask about Globex's acquisition plan: their confidential document (with an access code inside) is quoted back.",
        "As carol (public clearance), ask about salary bands - a confidential document still comes back.",
        "Replay the cross-tenant questions against the secure side: the filtered retriever returns nothing sensitive.",
        "Open the Code tab, compare retrieve() with retrieve_filtered(), then pass Fix-It.",
    ]
    expected_outcome = "The vulnerable retriever quotes foreign or above-clearance documents; the filtered retriever returns none of them."
    challenge = "Retrieve another tenant's confidential document as alice and submit the access code FLAG{...} it contains."
    advanced_challenge = (
        "No examples and no hints: recover another tenant's access code with a phrasing of your own, then pass "
        "Fix-It: unknown clearance values must fail closed, and the caller's own relevant document must still rank "
        "first - filtering before ranking, never after."
    )
    hints = [
        "Retrieval is purely by similarity. Which words sit in the secret document?",
        "The other company is Globex; its confidential plan concerns an acquisition.",
        "Ask about the Globex acquisition plan and its access code.",
    ]
    example_payloads = [
        {"label": "Benign question", "input": "What are the working hours at the office?"},
        {"label": "Cross-tenant probe", "input": "Globex acquisition plan Initech access code"},
        {"label": "Above clearance (carol)", "input": "Confidential pay band for senior engineers salary"},
        {"label": "Foreign internal doc", "input": "Expense policy for Globex employees meals per day"},
    ]
    remediation = (
        "Put tenant and clearance filters inside the retrieval query before ranking, fail closed on unknown values, and "
        "re-verify every hit's metadata. Per-tenant collections give the strongest isolation."
    )
    variants = ["alice", "carol"]
    variant_label = "Acting as"
    variant_help = {
        "alice": "acme staff, internal clearance - sees acme internal + confidential",
        "carol": "acme, public clearance - should see only public documents",
    }
    vulnerable_fns = [corpus, _score, retrieve, vulnerable_rag]
    secure_fns = [retrieve_filtered, secure_rag]

    def _present(self, res: dict[str, Any], secure: bool, req: RunRequest) -> dict[str, Any]:
        user = USERS.get(self.pick_variant(req), USERS["alice"])
        leaked = bool(res["unauthorized"])
        out: dict[str, Any] = {
            "output": f"Acting as {user['id']} ({user['tenant']}/{user['clearance']}):\n" + res["answer"],
            "details": {
                "acting_as": user,
                "retrieved_count": len(res["hits"]),
                "unauthorized_documents": res["unauthorized"],
                "retrieved": [{"id": h["id"], "tenant": h["tenant"], "level": h["level"], "similarity": h["score"]} for h in res["hits"]],
            },
            "leaked": leaked,
            "controls": res["controls"],
            "engine": req.engine,
        }
        if leaked and not secure:
            out["proof"] = flag_for(ID)
        return out

    def vulnerable_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        return self._present(vulnerable_rag(req.input, USERS.get(self.pick_variant(req), USERS["alice"])), secure=False, req=req)

    def secure_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        return self._present(secure_rag(req.input, USERS.get(self.pick_variant(req), USERS["alice"])), secure=True, req=req)
