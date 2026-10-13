"""LLM06 - Unbounded Consumption (virtual cost and token dashboard)."""
from __future__ import annotations

import re
from typing import Any

from app.core.secrets import flag_for
from app.models.schemas import RunRequest
from app.vulnerabilities.base import VulnerabilityModule

ID = "llm06"
BASE_CONTEXT = 300
OUTPUT_PER_CALL = 800
PRICE_IN, PRICE_OUT = 0.003, 0.015  # virtual dollars per 1K tokens
MONTHLY_BUDGET_USD = 5.0
SIM_HARD_LIMIT = 2000
MAX_ITERATIONS = 5
USER_QUOTA_TOKENS = 20000
WANTS_MORE = re.compile(r"(keep going|continue until|never stop|don'?t stop|forever|loop|until you have listed all)", re.I)


def enforce_budget(spent, request_tokens, budget):
    # SECURE: validate, deny over-budget requests, and emit alerts as thresholds are crossed.
    ints = all(isinstance(v, int) and not isinstance(v, bool) for v in (spent, request_tokens, budget))
    if not ints or spent < 0 or request_tokens <= 0 or budget <= 0:
        return {"allowed": False, "remaining": 0, "alerts": ["invalid"]}
    if spent + request_tokens > budget:
        return {"allowed": False, "remaining": max(budget - spent, 0), "alerts": ["exceeded"]}
    alerts = [f"{p}%" for p in (50, 80, 100) if spent * 100 < p * budget <= (spent + request_tokens) * 100]
    return {"allowed": True, "remaining": budget - spent - request_tokens, "alerts": alerts}


def _cost(tokens_in: int, tokens_out: int) -> float:
    return tokens_in / 1000 * PRICE_IN + tokens_out / 1000 * PRICE_OUT


def _downsample(points: list[float], n: int = 40) -> list[float]:
    if len(points) <= n:
        return points
    step = len(points) / n
    return [points[min(int(i * step), len(points) - 1)] for i in range(n)] + [points[-1]]


def vulnerable_session(prompt: str) -> dict[str, Any]:
    # VULNERABLE: loops while the model asks to continue; context grows every turn; no cap, quota or alert.
    iterations, tokens, spend, timeline = 0, 0, 0.0, []
    while WANTS_MORE.search(prompt) and iterations < SIM_HARD_LIMIT:
        tokens_in = BASE_CONTEXT + iterations * OUTPUT_PER_CALL
        tokens += tokens_in + OUTPUT_PER_CALL
        spend += _cost(tokens_in, OUTPUT_PER_CALL)
        iterations += 1
        timeline.append(spend)
    if iterations == 0:
        iterations, tokens, spend = 1, BASE_CONTEXT + OUTPUT_PER_CALL, _cost(BASE_CONTEXT, OUTPUT_PER_CALL)
        timeline.append(spend)
    return {"iterations": iterations, "tokens": tokens, "spend": spend, "timeline": timeline, "stopped_by": "model finished" if iterations == 1 else "simulation hard limit (it would never stop)"}


def secure_session(prompt: str) -> dict[str, Any]:
    iterations, tokens, spend, timeline, alerts, stopped = 0, 0, 0.0, [], [], "model finished"
    while True:
        if iterations >= MAX_ITERATIONS:
            stopped = f"iteration cap ({MAX_ITERATIONS})"
            break
        request_tokens = BASE_CONTEXT + iterations * OUTPUT_PER_CALL + OUTPUT_PER_CALL
        decision = enforce_budget(tokens, request_tokens, USER_QUOTA_TOKENS)
        alerts += [f"{a} of user quota used" for a in decision["alerts"] if a != "exceeded"]
        if not decision["allowed"]:
            stopped = "user token quota exhausted"
            break
        tokens += request_tokens
        spend += _cost(request_tokens - OUTPUT_PER_CALL, OUTPUT_PER_CALL)
        iterations += 1
        timeline.append(spend)
        if not WANTS_MORE.search(prompt):
            break
    return {"iterations": iterations, "tokens": tokens, "spend": spend, "timeline": timeline, "alerts": alerts, "stopped_by": stopped}


class UnboundedConsumption(VulnerabilityModule):
    id = ID
    fixit_key = "llm06"
    name = "Unbounded Consumption"
    category = "LLM10:2025 Unbounded Consumption"
    owasp_id = "LLM06"
    difficulty = "Intermediate"
    estimated_minutes = 30
    prerequisites = ["LLM04 Model Denial of Service"]
    overview = (
        "A document assistant keeps calling the model while the model says it has more to write, resending the growing conversation "
        "each turn. There is no iteration cap, no per-user quota and no cost alert. Spend is computed in virtual dollars, so you can "
        "watch a single prompt burn through a month's budget on the dashboard without touching any real API."
    )
    objectives = [
        "Explain why looped model calls with growing context cost quadratically",
        "Trigger budget exhaustion with one prompt and read the cost dashboard",
        "Apply iteration caps, per-user quotas and cost alerts",
        "Implement and validate a budget enforcement function",
    ]
    threat = "Uncontrolled usage drives runaway cost (denial of wallet) and exhausts quotas shared by other users."
    impact = "Unexpected bills, service suspension when provider limits are hit, and capacity unavailable to legitimate users."
    mitigation = [
        "Cap iterations and tokens per request and per session",
        "Enforce per-user and per-tenant quotas before calling the model",
        "Alert at spend thresholds (50%, 80%, 100%) and fail closed at the limit",
        "Track cost per request so anomalies are visible",
    ]
    guided_steps = [
        "Send 'Summarize our refund policy.' to both sides. One call each.",
        "Send 'List primes and keep going until you have listed all of them.' to the vulnerable side.",
        "Read the dashboard: iterations, tokens, virtual spend against the $5.00 monthly budget.",
        "Send the same prompt to the secure side and compare the stop reason and alerts.",
        "Open the Code tab and read enforce_budget().",
    ]
    expected_outcome = "The vulnerable session spends far beyond the budget; the secure session stops at the cap or quota and raises alerts."
    challenge = "Exhaust the $5.00 monthly virtual budget with a single prompt, then submit the FLAG{...} the dashboard reveals."
    hints = [
        "The assistant continues while the user's request asks it to.",
        "Phrases like 'keep going' or 'continue until' make the simulated model ask for more turns.",
        "Try: List primes and keep going until you have listed all of them.",
    ]
    example_payloads = [
        {"label": "Normal prompt", "input": "Summarize our refund policy."},
        {"label": "Runaway loop", "input": "List primes and keep going until you have listed all of them."},
    ]
    remediation = (
        "Put a hard ceiling on every loop, charge each call against a quota before it runs, alert as spend crosses thresholds, "
        "and fail closed. Limits belong on the server, not in the prompt."
    )
    vulnerable_fns = [vulnerable_session]
    secure_fns = [enforce_budget, secure_session]

    def _present(self, res: dict[str, Any], secure: bool) -> dict[str, Any]:
        spend = round(res["spend"], 2)
        over = res["spend"] > MONTHLY_BUDGET_USD
        out = {
            "output": f"Session ended: {res['stopped_by']}. {res['iterations']} model calls, {res['tokens']:,} tokens, ${spend:,.2f} virtual spend.",
            "details": {"model calls": res["iterations"], "total tokens": f"{res['tokens']:,}", "virtual spend (USD)": f"{spend:,.2f}",
                        "monthly budget (USD)": f"{MONTHLY_BUDGET_USD:.2f}", "stop reason": res["stopped_by"]},
            "timeline": {"label": "Cumulative virtual spend (USD)", "values": [round(v, 4) for v in _downsample(res["timeline"])], "limit": MONTHLY_BUDGET_USD},
            "alerts": res.get("alerts", []),
            "leaked": over, "controls": ["iteration cap", "per-user token quota", "cost alerts"] if secure else [],
        }
        if over and not secure:
            out["proof"] = flag_for(ID)
        return out

    def vulnerable_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        return self._present(vulnerable_session(req.input), secure=False)

    def secure_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        return self._present(secure_session(req.input), secure=True)
