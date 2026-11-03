#!/usr/bin/env python3
"""Play all labs like a student, end to end.

For every module and every example payload (which carries its own variant):
- run the payload on the vulnerable side, capture FLAG{...} anywhere in the
  student-visible response (output, proof, details - the route already scrubs
  what is not meant to be seen),
- submit the flag and expect "correct",
- replay the attack on the secure side and expect NO flag anywhere.

Paces itself under the backend rate limiter (120 req/min).
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080/api").rstrip("/")
FLAG = re.compile(r"FLAG\{[^}]*\}")
BENIGN_LABELS = ("benign", "normal", "legitimate", "own", "harmless", "polite", "friendly")
MIN_SLEEP = 0.6  # stay under the 120 req/min limiter


def post(path: str, payload: dict, timeout: int = 90) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                time.sleep(MIN_SLEEP)
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 2:
                time.sleep(15)
                continue
            return {"__err__": e.code, "detail": e.read().decode()[:300]}
    return {"__err__": 429, "detail": "still rate limited"}


def flags_in(obj) -> list[str]:
    out: list[str] = []
    if isinstance(obj, dict):
        for v in obj.values():
            out += flags_in(v)
    elif isinstance(obj, list):
        for v in obj:
            out += flags_in(v)
    elif isinstance(obj, str):
        out += FLAG.findall(obj)
    return out


def run_side(mid: str, p: dict, side: str) -> dict:
    body = {"input": p["input"], "mode": "beginner", "engine": "auto"}
    if p.get("variant"):
        body["variant"] = p["variant"]
    return post(f"/modules/{mid}/{side}", body)


def play_payload(mid: str, p: dict, benign: bool) -> tuple:
    tag = f"variant={p.get('variant') or '-'}"
    if benign:
        res = run_side(mid, p, "vulnerable")
        if "__err__" in res:
            return ("ERROR", f"{tag} benign run failed: {res}")
        hits = flags_in(res)
        if hits:
            return ("FREE FLAG on benign!", f"{tag} input={p['input'][:50]!r} flags={hits}")
        return ("PASS", f"{tag} benign clean: {res.get('output', '')[:60]!r}")
    # attack: retry until the flag shows up (real models are probabilistic)
    res, got = {}, None
    for attempt in range(5):
        res = run_side(mid, p, "vulnerable")
        if "__err__" in res:
            return ("ERROR", f"{tag} run failed: {res} input={p['input'][:50]!r}")
        hits = flags_in(res)
        if hits:
            got = (hits[0], attempt + 1, (res.get("judge") or {}).get("verdict"))
            break
    if got is None:
        return ("ATTACK FAILED (5 tries)", f"{tag} input={p['input'][:50]!r} out={res.get('output', '')[:80]!r}")
    flag, n, judge = got
    sub = post(f"/modules/{mid}/flag", {"flag": flag})
    ok = sub.get("correct") if "__err__" not in sub else sub["__err__"]
    if ok is not True:
        return ("FLAG REJECTED", f"{tag} submit={sub}")
    sec = run_side(mid, p, "secure")
    sec_flags = flags_in(sec) if "__err__" not in sec else ["__err__"]
    if sec_flags:
        return ("SECURE SIDE LEAKED", f"{tag} secure_flags={sec_flags[:1]} detail={sec.get('detail', '')[:120]}")
    return ("PASS", f"{tag} attempts={n} judge={judge} secure={sec.get('output', '')[:60]!r}")


def run_play() -> int:
    modules = json.loads(urllib.request.urlopen(f"{BASE}/modules", timeout=30).read())
    print(f"{'lab':6} {'tier':12} {'variants':9} result")
    print("-" * 90)
    failures = 0
    for m in modules:
        mid, tier = m["id"], m["difficulty"]
        variants = m.get("variants")
        payloads = [dict(p) for p in list(m.get("example_payloads", [])) if p.get("input")]
        rows = []
        for p in payloads:
            benign = any(w in p.get("label", "").lower() for w in BENIGN_LABELS)
            status, detail = play_payload(mid, p, benign)
            rows.append((status, detail))
        failed = any(s != "PASS" for s, _ in rows)
        failures += 1 if failed else 0
        print(f"{mid:6} {tier:12} {(str(variants or ['-'])[:9]):9} {'FAIL' if failed else 'OK'}")
        for s, d in rows:
            print(("    " if s == "PASS" else " ⚠  ") + f"{s}: {d}")
    print("-" * 90)
    print(f"labs with failures: {failures}/{len(modules)}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(run_play())
