"""Strip secrets from diagnostic fields before a run result leaves the server.

The lab must never hand out a flag for free: a student who types "hi" should
see the FAQ answer, not the escalation code sitting in the echoed prompt.

Two rules, applied recursively to every run result:

1. ``FLAG{...}`` is redacted from every field **except** the designated exploit
   channels (``output``, ``model_output``, ``rows``, ``proof``) - those only
   contain the flag when the exploit actually succeeded.
2. Credential-shaped values (``sk-lab-...`` tokens, DSN passwords) are redacted
   from the echoed ``prompt_sent`` / ``context_sent`` panels, so the panels
   teach *what the model saw* without handing over the answer.
"""
from __future__ import annotations

import re
from typing import Any

# Channels where a successful exploit legitimately reveals the flag.
EXPLOIT_CHANNELS = frozenset({"output", "model_output", "rows", "proof"})
# Echo panels: show shape, never the secret value.
ECHO_FIELDS = frozenset({"prompt_sent", "context_sent"})

FLAG_RE = re.compile(r"FLAG\{[^}]*\}")
TOKEN_RE = re.compile(r"sk-lab-[A-Za-z0-9]+")
DSN_PASSWORD_RE = re.compile(r"(?i)(\b\w+://[^:/\s]+:)[^@\s]+(@)")


def _clean(text: str, *, deep: bool) -> str:
    if not deep:
        return FLAG_RE.sub("[REDACTED]", text)
    text = FLAG_RE.sub("[REDACTED]", text)
    text = TOKEN_RE.sub("[REDACTED]", text)
    return DSN_PASSWORD_RE.sub(r"\1[REDACTED]\2", text)


def scrub(obj: Any, key: str | None = None) -> Any:
    """Recursively redact secrets from a run result (see module docstring)."""
    if isinstance(obj, dict):
        return {k: scrub(v, k) for k, v in obj.items()}
    if isinstance(obj, list):
        return [scrub(v, key) for v in obj]
    if isinstance(obj, str):
        if key in EXPLOIT_CHANNELS:
            return obj
        return _clean(obj, deep=key in ECHO_FIELDS)
    return obj
