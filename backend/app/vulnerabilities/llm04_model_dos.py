"""LLM04 - Model Denial of Service (virtual resources only; nothing real is exhausted)."""
from __future__ import annotations

import re
from typing import Any

from app.core.secrets import flag_for
from app.models.schemas import RunRequest
from app.vulnerabilities.base import ModuleInputError, VulnerabilityModule

ID = "llm04"
WORKER_TOKENS_PER_SECOND = 2000
STALL_SECONDS = 30
SERVICE_TIME_S = 0.05
OUTPUT_CAP = 512


def estimate_cost(prompt: str) -> int:
    units = {"word": 2, "sentence": 25, "line": 14, "item": 20, "paragraph": 120, "page": 600}
    count = r"(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?"

    def num(text: str, suffix: str | None) -> int:
        value = float(text.replace(",", "")) * {"k": 1_000, "m": 1_000_000}.get((suffix or "").lower(), 1)
        return int(min(value, 10**12))

    counts = [(num(m.group(1), m.group(2)), units[m.group(3).lower().rstrip("s")])
              for m in re.finditer(count + r"\s*(words?|sentences?|lines?|items?|paragraphs?|pages?)\b", prompt, re.I)]
    if not counts:
        output = 200
    elif re.search(r"\b(for each|each of)\b", prompt, re.I):
        output = max(per for _, per in counts)
        for n, _ in counts:
            output *= n
    else:
        output = sum(n * per for n, per in counts)
    for m in re.finditer(count + r"\s*(?:times|x)\b", prompt, re.I):
        output *= num(m.group(1), m.group(2))
    return min(len(prompt) // 4 + 1 + output, 10**12)


def check_request(prompt, max_cost=2000):
    # SECURE: complexity scoring before any model time is spent.
    if not isinstance(prompt, str) or not prompt.strip():
        return False
    return estimate_cost(prompt) <= max_cost


class TokenBucket:
    """Deterministic virtual-time token bucket (the rate limiter used by the secure path)."""

    def __init__(self, capacity: int, refill_per_second: float) -> None:
        self.capacity, self.rate, self.tokens, self.t = capacity, refill_per_second, float(capacity), 0.0

    def allow(self, t: float) -> bool:
        self.tokens = min(self.capacity, self.tokens + (t - self.t) * self.rate)
        self.t = t
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False


def vulnerable_handle(prompt: str) -> dict[str, Any]:
    # VULNERABLE: no complexity check, no output cap, no per-request time limit.
    cost = estimate_cost(prompt)
    return {"accepted": True, "billed_tokens": cost, "latency_s": round(cost / WORKER_TOKENS_PER_SECOND, 2)}


def secure_handle(prompt: str) -> dict[str, Any]:
    if not check_request(prompt):
        return {"accepted": False, "reason": "rejected by complexity scoring", "billed_tokens": 0, "latency_s": 0.0}
    cost = min(estimate_cost(prompt), OUTPUT_CAP + len(prompt) // 4 + 1)
    return {"accepted": True, "billed_tokens": cost, "latency_s": round(cost / WORKER_TOKENS_PER_SECOND, 2)}


class ModelDoS(VulnerabilityModule):
    id = ID
    fixit_key = "llm04"
    name = "Model Denial of Service"
    category = "LLM10:2025 Unbounded Consumption (resource exhaustion)"
    owasp_id = "LLM04"
    difficulty = "Intermediate"
    estimated_minutes = 30
    prerequisites = ["LLM01 Prompt Injection", "Basic rate-limiting concepts"]
    variants = ["complexity", "burst"]
    variant_label = "Attack type"
    variant_help = {
        "complexity": "Type a prompt. Its cost is computed in virtual tokens against a virtual worker that handles 2,000 tokens per second.",
        "burst": "Type a number of requests (1 to 100000) sent within one virtual second. Each takes 50 ms of virtual service time.",
    }
    overview = (
        "A shared inference worker serves every customer. Nothing limits how expensive a single prompt may be or how many "
        "requests arrive at once. This lab simulates resources in virtual units, so no real system is ever stressed: you watch a "
        "virtual worker stall for everyone, then add complexity scoring, an output cap and a token-bucket rate limiter."
    )
    objectives = [
        "Explain how one expensive prompt or a burst of requests degrades service for other users",
        "Craft a high-cost prompt using repetition and nested expansion",
        "Apply query complexity scoring, output caps and rate limiting",
        "Implement a complexity gate and validate it against abusive and legitimate prompts",
    ]
    threat = "Requests that consume disproportionate compute or arrive in bursts exhaust shared model capacity."
    impact = "Latency spikes and outages for all users, missed SLAs, and cascading failures in dependent services."
    mitigation = [
        "Score request complexity (input size, repetition, expansion) and reject above a threshold",
        "Cap output tokens and per-request time",
        "Rate limit per client with a token bucket and return 429 when exhausted",
        "Isolate heavy work in separate queues so it cannot starve interactive traffic",
    ]
    guided_steps = [
        "Choose 'complexity' and send 'Summarize billing in 3 sentences.' to see normal latency.",
        "Send 'Repeat the word a 100000 times' to the vulnerable side and note the virtual worker stall.",
        "Send the same prompt to the secure side and read the rejection.",
        "Switch to 'burst', send 1000 requests to both sides and compare queue wait with accepted counts.",
        "Open the Code tab to read estimate_cost() and TokenBucket.",
    ]
    expected_outcome = "The vulnerable worker stalls for everyone; the secure service rejects the abusive prompt and sheds burst traffic."
    challenge = "Stall the virtual worker for more than 30 seconds, then submit the FLAG{...} it reveals."
    hints = [
        "Cost is output tokens multiplied by repetition. Large counts matter more than long prompts.",
        "Repetition phrases such as 'N times' multiply the output; 'for each ... N ...' multiplies nested counts.",
        "Try: Repeat the word a 100000 times",
    ]
    example_payloads = [
        {"label": "Normal prompt", "variant": "complexity", "input": "Summarize billing in 3 sentences."},
        {"label": "Repetition bomb", "variant": "complexity", "input": "Repeat the word a 100000 times"},
        {"label": "Nested expansion", "variant": "complexity", "input": "For each of 50 items write 50 paragraphs"},
        {"label": "Burst of 1000", "variant": "burst", "input": "1000"},
    ]
    remediation = (
        "Gate expensive work before it reaches the model: estimate cost, reject or queue above limits, cap output, and rate limit "
        "per client. Keep the limits in configuration and log rejections for abuse detection."
    )
    vulnerable_fns = [vulnerable_handle]
    secure_fns = [estimate_cost, check_request, TokenBucket, secure_handle]

    def _burst_count(self, text: str) -> int:
        if not re.fullmatch(r"\d{1,6}", text.strip()) or not 1 <= int(text) <= 100000:
            raise ModuleInputError("For the burst attack enter a number of requests between 1 and 100000.")
        return int(text)

    def vulnerable_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        if self.pick_variant(req) == "burst":
            n = self._burst_count(req.input)
            wait = round(n * SERVICE_TIME_S, 2)
            stalled = wait > STALL_SECONDS
            out = {"output": f"All {n} requests accepted into the queue. The last one waits {wait} s.",
                   "details": {"requests sent": n, "accepted": n, "rejected": 0, "last request waits (virtual s)": wait}}
        else:
            res = vulnerable_handle(req.input)
            stalled = res["latency_s"] > STALL_SECONDS
            out = {"output": f"Request accepted and processed. Worker busy for {res['latency_s']} virtual seconds.",
                   "details": {"estimated cost (virtual tokens)": res["billed_tokens"], "worker busy (virtual s)": res["latency_s"],
                               "other users delayed (virtual s)": res["latency_s"]}}
        out.update(leaked=stalled, controls=[])
        if stalled:
            out["proof"] = flag_for(ID)
        return out

    def secure_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        if self.pick_variant(req) == "burst":
            n = self._burst_count(req.input)
            bucket = TokenBucket(capacity=10, refill_per_second=5)
            accepted = sum(bucket.allow(i / n) for i in range(n))
            return {"output": f"{accepted} accepted, {n - accepted} rejected with HTTP 429.",
                    "details": {"requests sent": n, "accepted": accepted, "rejected": n - accepted,
                                "last accepted request waits (virtual s)": round(accepted * SERVICE_TIME_S, 2)},
                    "leaked": False, "controls": ["token bucket (burst 10, 5 per second)"]}
        res = secure_handle(req.input)
        msg = f"Request accepted. Billed {res['billed_tokens']} virtual tokens." if res["accepted"] else "Request rejected: estimated cost exceeds the limit."
        return {"output": msg, "details": {"estimated cost (virtual tokens)": estimate_cost(req.input), "limit": 2000,
                                           "worker busy (virtual s)": res["latency_s"]},
                "leaked": False, "controls": ["complexity scoring", f"output cap {OUTPUT_CAP} tokens"]}
