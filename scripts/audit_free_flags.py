#!/usr/bin/env python3
"""No-free-flags audit: a benign message must never reveal a flag.

Runs every module's vulnerable AND secure implementation with harmless
inputs and fails if any client-visible response field contains FLAG{...}.

Usage: python scripts/audit_free_flags.py [base_url]
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001/api").rstrip("/")
FLAG = re.compile(r"FLAG\{[^}]*\}")
BENIGN = ["Hello", "hi", "What is the weather today?"]

# Labs that parse structured input reject a plain "Hello" with a 400 before any
# model runs, so those variants would never actually be exercised. These
# inputs are *well-formed but benign*: they satisfy the parser yet contain no
# attack, so a flag in the response would still be a free flag. They are used
# in addition to (not instead of) the generic BENIGN list.
BENIGN_BY_LAB = {
    "llm04": ["10", "500"],        # burst / long-prompt request counts
    "llm05": ["acme-embedder==1.2.0"],  # well-formed, trusted-source install
}

# Each variant also gets one lab-appropriate benign input, so every variant is
# played even when its parser is stricter than a chat message.
BENIGN_BY_VARIANT = {
    ("llm04", "burst"): "20",        # well-formed burst of 20 requests
    ("llm04", "complexity"): "Summarize billing in 3 sentences.",
}


def post(path: str, payload: dict) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        return {"__http_error__": exc.code, "detail": exc.read().decode()[:200]}


def scan(obj, where=""):
    hits = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            hits += scan(v, f"{where}.{k}" if where else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            hits += scan(v, f"{where}[{i}]")
    elif isinstance(obj, str):
        for m in FLAG.findall(obj):
            hits.append((where, m))
    return hits


def main() -> int:
    modules = json.loads(urllib.request.urlopen(f"{BASE}/modules", timeout=30).read())
    failures = 0
    for m in modules:
        mid = m["id"]
        detail = json.loads(urllib.request.urlopen(f"{BASE}/modules/{mid}", timeout=30).read())
        variants = detail.get("variants") or [None]
        for variant in variants:
            texts = list(BENIGN)
            texts += BENIGN_BY_LAB.get(mid, [])
            v_text = BENIGN_BY_VARIANT.get((mid, variant)) if variant else None
            if v_text:
                texts.append(v_text)
            for text in texts:
                for side in ("vulnerable", "secure"):
                    payload = {"input": text}  # the UI never sends an engine
                    if variant:
                        payload["variant"] = variant
                    res = post(f"/modules/{mid}/{side}", payload)
                    hits = scan(res)
                    if hits:
                        failures += 1
                        print(f"FREE FLAG  {mid}/{side} variant={variant} input={text!r}")
                        for where, flag in hits[:4]:
                            print(f"    {where}: {flag}")
                    if "__http_error__" in res:
                        print(f"HTTP {res['__http_error__']} {mid}/{side} variant={variant}: {res.get('detail')}")
    print(f"\n{'FAIL' if failures else 'PASS'}: {failures} free-flag leaks found across benign runs")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
