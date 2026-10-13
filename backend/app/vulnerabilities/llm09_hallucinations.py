"""LLM09 - Hallucination and misinformation through conflicting RAG sources (ChromaDB)."""
from __future__ import annotations

import re
from typing import Any

from app.core.secrets import flag_for
from app.models.schemas import RunRequest
from app.services import vectorstore as vs
from app.vulnerabilities.base import VulnerabilityModule

ID = "llm09"
GROUND_TRUTH = {"X200": "10 Gbps", "X100": "1 Gbps"}
THRESHOLD = 0.6
_PRODUCT = re.compile(r"\bX\d{3}\b", re.I)
_VALUE = re.compile(r"(\d+(?:\.\d+)?)\s*Gbps", re.I)

# id, text, authority, age_days (relative to the lab's fixed reference date), superseded
CORPUS = [
    ("datasheet-x200-v3", "Acme X200 datasheet v3 (2025-06): the maximum throughput of the Acme X200 is 10 Gbps.", 1.0, 214, False),
    ("datasheet-x200-v2", "Acme X200 datasheet v2 (2022-03): the maximum throughput of the Acme X200 is 1 Gbps.", 1.0, 1402, True),
    ("forum-x200", "Forum post: what is the maximum throughput of the Acme X200? The maximum throughput of the Acme X200 is 2.5 Gbps, measured in my lab.", 0.3, 1096, False),
    ("datasheet-x100-v3", "Acme X100 datasheet v3 (2025-06): the maximum throughput of the Acme X100 is 1 Gbps.", 1.0, 214, False),
    ("datasheet-x300", "Acme X300 datasheet (2025-09): the maximum throughput of the Acme X300 is 4 Gbps.", 0.9, 122, False),
    ("partner-x300", "Partner spec sheet (2025-09): the maximum throughput of the Acme X300 is 2 Gbps.", 0.9, 122, False),
    ("warranty-x200", "The Acme X200 warranty covers hardware faults for 3 years from purchase.", 1.0, 300, False),
]


def answer_or_abstain(candidates, threshold=0.6):
    # SECURE: weigh evidence by authority and recency, ignore superseded sources, cite, and abstain when unsure.
    groups: dict[str, dict[str, Any]] = {}
    total = 0.0
    for c in candidates:
        w = c["authority"] * 0.5 ** (c["age_days"] / 730)
        if c["superseded"] or w <= 0:
            continue
        key = c["value"].strip().lower()
        g = groups.setdefault(key, {"value": c["value"], "weight": 0.0, "sources": []})
        g["weight"] += w
        g["sources"].append(c["source"])
        total += w
    if not groups:
        return {"answer": None, "confidence": 0.0, "citations": [], "abstained": True}
    best = max(groups.values(), key=lambda g: g["weight"])
    confidence = round(best["weight"] / total, 3)
    if confidence < threshold:
        return {"answer": None, "confidence": confidence, "citations": [], "abstained": True}
    return {"answer": best["value"], "confidence": confidence, "citations": best["sources"], "abstained": False}


def _retrieve(question: str, n: int) -> list[dict[str, Any]]:
    with vs.scratch_collection("llm09") as col:
        col.add(ids=[c[0] for c in CORPUS], documents=[c[1] for c in CORPUS],
                metadatas=[{"authority": c[2], "age_days": c[3], "superseded": c[4]} for c in CORPUS])
        return vs.query(col, question, n)


def vulnerable_answer(question: str) -> dict[str, Any]:
    # VULNERABLE: answers from the single most similar chunk; no entity check, no citation, no confidence, never abstains.
    top = _retrieve(question, 1)[0]
    m = _VALUE.search(top["text"])
    value = f"{m.group(1)} Gbps" if m else "10 Gbps"
    product = (_PRODUCT.search(question) or _PRODUCT.search(top["text"]))
    name = product.group(0).upper() if product else "the product"
    return {"answer": f"The Acme {name} supports {value}.", "value": value, "product": name, "source": top["id"],
            "grounded": bool(product and product.group(0).lower() in top["text"].lower())}


def secure_answer(question: str) -> dict[str, Any]:
    product = _PRODUCT.search(question)
    if not product:
        return {"answer": "Please name the product model (for example X200) so I can look it up.", "value": None, "abstained": True,
                "confidence": 0.0, "citations": [], "retrieved": []}
    name = product.group(0).upper()
    hits = [h for h in _retrieve(question, 6) if name.lower() in h["text"].lower() and _VALUE.search(h["text"])]
    candidates = [{"value": f"{_VALUE.search(h['text']).group(1)} Gbps", "source": h["id"], "authority": h["meta"]["authority"],
                   "age_days": h["meta"]["age_days"], "superseded": bool(h["meta"]["superseded"])} for h in hits]
    result = answer_or_abstain(candidates, THRESHOLD)
    rows = [{"id": h["id"], "similarity": h["similarity"], "authority": h["meta"]["authority"], "superseded": bool(h["meta"]["superseded"])} for h in hits]
    if result["abstained"]:
        why = "sources conflict" if result["confidence"] > 0 else "no grounded source found"
        answer = f"I can't answer reliably: {why} (confidence {result['confidence']:.2f}). Please check the official datasheet."
    else:
        answer = f"The Acme {name} supports {result['answer']}. Sources: {', '.join(result['citations'])} (confidence {result['confidence']:.2f})."
    return {**result, "answer": answer, "value": result["answer"], "retrieved": rows, "product": name}


class Hallucinations(VulnerabilityModule):
    id = ID
    fixit_key = "llm09"
    name = "Hallucinations and Misinformation"
    category = "LLM09:2025 Misinformation"
    owasp_id = "LLM09"
    difficulty = "Advanced"
    estimated_minutes = 35
    prerequisites = ["LLM03 Data Poisoning", "What retrieval-augmented generation (RAG) is"]
    variant_help = {}
    overview = (
        "A product assistant answers hardware questions from a ChromaDB corpus that contains an old datasheet, a current datasheet, an "
        "enthusiast forum post, a product with two equally authoritative but conflicting sources, and a missing product. The vulnerable "
        "assistant answers from the single most similar chunk with total confidence. It states wrong facts, borrows answers from the wrong product and never says 'I don't know'."
    )
    objectives = [
        "Recognise grounding failures: stale, low-authority and wrong-entity sources",
        "Elicit confident wrong answers from a RAG assistant",
        "Apply citation requirements, authority and recency weighting, confidence scoring and abstention",
        "Implement a grounded answer-or-abstain function and validate it",
    ]
    threat = "The model presents unsupported or wrong information as fact, and users rely on it."
    impact = "Bad operational decisions, reputational and legal exposure, and eroded trust in genuine answers."
    mitigation = [
        "Require every answer to cite the sources it is grounded in",
        "Prefer authoritative, current, non-superseded sources; check the answer is about the asked entity",
        "Compute confidence from agreement among weighted sources",
        "Abstain and explain conflicts instead of guessing",
    ]
    guided_steps = [
        "Ask 'What is the maximum throughput of the Acme X200?' on the vulnerable side. The forum post wins.",
        "Ask about the X100, X300 and X900 and note wrong-entity and fabricated answers.",
        "Ask the same questions on the secure side and read citations, confidence and abstentions.",
        "Open the Code tab and read answer_or_abstain().",
    ]
    expected_outcome = "The vulnerable assistant asserts wrong or ungrounded facts; the secure one cites a current authoritative source or abstains."
    challenge = "Make the assistant confidently state a wrong or ungrounded throughput, then submit the FLAG{...} it reveals."
    hints = [
        "Retrieval picks the most similar text, not the most trustworthy.",
        "Ask about the X200 exactly as phrased in the forum post.",
        "Try: What is the maximum throughput of the Acme X200?",
    ]
    example_payloads = [
        {"label": "X200 (stale and weak sources)", "input": "What is the maximum throughput of the Acme X200?"},
        {"label": "X300 (conflicting sources)", "input": "What is the maximum throughput of the Acme X300?"},
        {"label": "X900 (does not exist)", "input": "What is the maximum throughput of the Acme X900?"},
        {"label": "X100 (borrowed answer)", "input": "What is the maximum throughput of the Acme X100?"},
    ]
    remediation = (
        "Treat retrieval as evidence, not truth. Weigh sources, check the entity, cite, compute confidence and abstain below a threshold. "
        "Display citations so users can verify."
    )
    vulnerable_fns = [vulnerable_answer]
    secure_fns = [answer_or_abstain, secure_answer]

    def vulnerable_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        r = vulnerable_answer(req.input)
        wrong = not r["grounded"] or r["value"] != GROUND_TRUTH.get(r["product"])
        out = {"output": r["answer"], "details": {"answered from": r["source"], "grounded in the asked product": r["grounded"],
                                                  "confidence shown": "100% (none computed)", "citations": "none"},
               "leaked": wrong, "controls": []}
        if wrong:
            out["proof"] = flag_for(ID)
        return out

    def secure_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        r = secure_answer(req.input)
        return {"output": r["answer"], "retrieved": r["retrieved"],
                "details": {"confidence": r["confidence"], "abstained": r["abstained"], "citations": ", ".join(r["citations"]) or "none"},
                "leaked": (not r["abstained"]) and r["value"] != GROUND_TRUTH.get(r["product"]),
                "controls": ["source weighting", "entity grounding", "citations", "confidence threshold", "abstention"]}
