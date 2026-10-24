"""Deterministic instruction-following model used by labs and automated validation.

It models the behaviours that matter for the lessons (obeying instructions found anywhere in a flat
prompt, honouring role separation in chat messages, echoing content, answering from supplied context)
so exploits and fixes are reproducible without a GPU. It is the built-in
fallback used when no Groq or Gemini key is configured, and the only engine
for the simulated-infrastructure labs. Standard library only: the Fix-It
sandbox imports this file.
"""
from __future__ import annotations

import re
from collections.abc import Mapping, Sequence

DIRECTIVE = re.compile(
    r"(?:(?:ignore|disregard|forget|override)\b.{0,40}?\b(?:previous|prior|above|earlier|all|your)\b.{0,30}?"
    r"\b(?:instruction|prompt|rule|directive|guideline)s?"
    r"|(?:reveal|show|print|repeat|output|display|tell me|leak)\b.{0,40}?"
    r"\b(?:system prompt|instructions|secret|flag|code|token|configuration)"
    r"|\byou are now\b|\bnew instructions?\s*:|\bdeveloper mode\b)",
    re.I | re.S,
)

DEFAULT_FAQ: Mapping[str, str] = {
    "uptime": "Acme Cloud commits to 99.9% monthly uptime for all paid plans.",
    "billing": "Invoices are issued on the first day of each month and are payable within 30 days.",
    "refund": "Refunds are available within 14 days of purchase through the billing portal.",
}
FALLBACK = "I can help with Acme Cloud billing and uptime questions."


def faq_answer(question: str, faq: Mapping[str, str] = DEFAULT_FAQ) -> str:
    q = question.lower()
    for key, answer in faq.items():
        if key in q:
            return answer
    return FALLBACK


def complete_flat(prompt: str, marker: str = "\n\nUser:") -> str:
    """No role boundary: any instruction in the text is treated as an instruction."""
    head, sep, tail = prompt.rpartition(marker)
    user_text = tail if sep else prompt
    if DIRECTIVE.search(user_text):
        return "Understood. Here is my configuration:\n" + (head if sep else prompt).strip()
    return faq_answer(user_text)


def complete_chat(messages: Sequence[Mapping[str, str]]) -> str:
    """Role-aware: system content defines policy, user content is data."""
    user_text = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")
    return faq_answer(user_text)


def complete_with_context(context: str, question: str, user: str = "alice") -> str:
    """Answers from whatever is in the context window, with no access control of its own."""
    q = question.lower()
    lines = [ln.strip() for ln in context.splitlines() if ln.strip()]
    wants_secret = re.search(r"\b(key|secret|token|credential|password|config|system prompt|instruction|connection)", q)
    if wants_secret:
        hits = [ln for ln in lines if re.search(r"(key|secret|token|credential|password|connection|dsn)", ln, re.I)]
        if hits:
            return "Sure, here are the details:\n" + "\n".join(hits)
    record_words = re.search(r"\b(record|account|ssn|email|customer|balance|card|profile)", q)
    if record_words:
        names = [ln for ln in lines if ln.lower().startswith("customer:")]
        targets = [ln for ln in names if any(tok and tok in q for tok in _name_tokens(ln))]
        if re.search(r"\b(my|me|mine)\b", q):
            targets = targets or [ln for ln in names if user in _name_tokens(ln)]
        if re.search(r"\b(all|every|list)\b", q):
            targets = names
        if targets:
            return "Here is what I found:\n" + "\n".join(targets)
    return "I can help with questions about your Acme Bank account."


def _name_tokens(record_line: str) -> list[str]:
    m = re.match(r"customer:\s*([A-Za-z]+)", record_line, re.I)
    return [m.group(1).lower()] if m else []


def echo_html(review: str) -> str:
    """Models an LLM summarising untrusted text into HTML: the text is reproduced faithfully."""
    return f'<div class="summary"><h4>Customer review summary</h4><p>{review}</p></div>'


_JSON_OBJ = re.compile(r"\{.*\}", re.S)


def extract_filter(request: str) -> str:
    m = re.search(r"category\s*[:=]\s*(.+)$", request, re.I | re.S)
    return (m.group(1) if m else request).strip()


def to_action_json(request: str) -> str:
    m = _JSON_OBJ.search(request)
    if m:  # models copy structured content they are shown
        return m.group(0)
    r = re.search(r"refund\s+\$?(\d+(?:\.\d+)?)\s+(?:for|to)\s+order\s+#?(\d+)", request, re.I)
    if r:
        return f'{{"action": "refund", "order_id": {r.group(2)}, "amount": {r.group(1)}}}'
    s = re.search(r"order\s+#?(\d+)", request, re.I)
    return f'{{"action": "status", "order_id": {s.group(1) if s else 1}}}'
