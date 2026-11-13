"""LLM16 - Function Call Parameter Tampering.

The refund assistant emits a tool call, but the browser posts the arguments
back and the backend executes whatever it receives. Nothing is recomputed from
trusted order data, so the caller decides who is refunded and how much.
"""
from __future__ import annotations

import re
from typing import Any

from app.core.secrets import flag_for
from app.models.schemas import RunRequest
from app.vulnerabilities.base import VulnerabilityModule

ID = "llm16"
SESSION = {"id": "dana", "role": "support"}
ORDERS = {
    7: {"owner": "dana", "total": 40.0, "status": "paid"},
    8: {"owner": "raj", "total": 120.0, "status": "paid"},
}
MAX_REFUND = 100.0


def model_refund_call(message: str) -> dict[str, Any] | None:
    order = re.search(r"order\s*#?\s*(\d+)", message, re.I)
    if not order:
        return None
    amount = re.search(r"(?:amount|refund(?:ing)?)\D{0,14}(\d+(?:\.\d+)?)", message, re.I)
    return {"user_id": SESSION["id"], "order_id": int(order.group(1)), "amount": float(amount.group(1)) if amount else 0.0}


def apply_client_overrides(call: dict[str, Any], message: str) -> dict[str, Any]:
    """VULNERABLE: the SPA may edit the tool arguments before execution."""
    tuned = dict(call)
    user = re.search(r"user(?:_?id)?\s*[=:]\s*([a-z0-9_-]+)", message, re.I)
    amount = re.search(r"amount\s*[=:]\s*(\d+(?:\.\d+)?)", message, re.I)
    if user:
        tuned["user_id"] = user.group(1)
    if amount:
        tuned["amount"] = float(amount.group(1))
    return tuned


def execute_refund_vulnerable(call: dict[str, Any], orders: dict[int, dict[str, Any]]) -> dict[str, Any]:
    # VULNERABLE: no ownership, identity or amount check anywhere.
    order_id = call.get("order_id")
    order = orders.get(order_id)
    if order is None:
        return {"ok": False, "output": f"Order {order_id} was not found.", "violations": []}
    amount = float(call.get("amount") or 0)
    actor = str(call.get("user_id") or "unknown")
    violations = []
    if order["owner"] != SESSION["id"]:
        violations.append("order belongs to another customer")
    if actor != SESSION["id"]:
        violations.append(f"executed as {actor}, not the signed-in user")
    if amount > order["total"]:
        violations.append("refund exceeds the order total")
    return {
        "ok": True,
        "output": f"Refund of ${amount:.2f} on order {order_id} executed for {actor}.",
        "violations": violations,
    }


def validate_refund(call, session_user, orders):
    # SECURE: identity comes from the session, the order is authoritative and
    # every argument is type-checked and bounded.
    if not isinstance(session_user, str) or not session_user:
        return {"ok": False, "reason": "no authenticated session", "amount": 0.0, "order_id": None, "user_id": None}
    if not isinstance(call, dict) or not isinstance(orders, dict):
        return {"ok": False, "reason": "malformed tool call", "amount": 0.0, "order_id": None, "user_id": session_user}
    order_id = call.get("order_id")
    amount = call.get("amount")
    claimed_user = call.get("user_id", session_user)
    if isinstance(order_id, bool) or not isinstance(order_id, int):
        return {"ok": False, "reason": "order id must be an integer", "amount": 0.0, "order_id": None, "user_id": session_user}
    if isinstance(amount, bool) or not isinstance(amount, int | float) or amount <= 0:
        return {"ok": False, "reason": "amount must be a positive number", "amount": 0.0, "order_id": order_id, "user_id": session_user}
    if claimed_user != session_user:
        return {"ok": False, "reason": "tool call user does not match the session", "amount": float(amount), "order_id": order_id, "user_id": session_user}
    order = orders.get(order_id)
    if not isinstance(order, dict):
        return {"ok": False, "reason": "unknown order", "amount": float(amount), "order_id": order_id, "user_id": session_user}
    if order.get("owner") != session_user:
        return {"ok": False, "reason": "order belongs to another customer", "amount": float(amount), "order_id": order_id, "user_id": session_user}
    if float(amount) > min(float(order.get("total", 0)), MAX_REFUND):
        return {"ok": False, "reason": "amount exceeds the refundable total", "amount": float(amount), "order_id": order_id, "user_id": session_user}
    return {"ok": True, "reason": "approved", "amount": float(amount), "order_id": order_id, "user_id": session_user}


def refund_secure(request_text: str) -> dict[str, Any]:
    call = model_refund_call(request_text)
    if call is None:
        return {"status": "no_call", "output": "The assistant could not identify an order in that request."}
    decision = validate_refund(call, SESSION["id"], ORDERS)
    if decision["ok"]:
        return {"status": "approved", "output": f"Refund of ${decision['amount']:.2f} on order {decision['order_id']} approved for {SESSION['id']}.", "decision": decision}
    return {"status": "denied", "output": f"Refund denied: {decision['reason']}.", "decision": decision}


class ParameterTampering(VulnerabilityModule):
    id = ID
    fixit_key = "llm16"
    name = "Function Call Parameter Tampering"
    category = "LLM06:2025 Excessive Agency (tool argument trust)"
    owasp_id = "LLM16"
    difficulty = "Advanced"
    estimated_minutes = 35
    prerequisites = ["LLM07 Excessive Agency", "Basic authorization concepts"]
    overview = (
        "The refund copilot turns a support message into a tool call, and the browser posts that call back to "
        "the refund service. The service trusts the arguments it receives: the signed-in agent is Dana, but the "
        "request can name a different user, a different order or a larger amount, and the refund is executed."
    )
    objectives = [
        "Explain why AI-generated function arguments are untrusted client input",
        "Tamper with a refund tool call to move money or act as another user",
        "Recompute identity and limits server-side from authoritative records",
        "Validate a refund-authorization function against tampered arguments",
    ]
    threat = "A client changes the parameters of an AI-generated tool call and the backend executes them without revalidation."
    impact = "Unauthorised refunds, acting as another employee, financial loss and corrupted audit records."
    mitigation = [
        "Treat the entire tool call as untrusted input, including its arguments",
        "Derive identity from the session and limits from authoritative order records",
        "Validate types, ranges and ownership before executing any tool",
        "Record the original model intent and the validated call for audit",
    ]
    guided_steps = [
        "Submit a normal refund request for order 7 and note that Dana owns it.",
        "Add a client override to the request, such as amount=5000 for the same order.",
        "Read the vulnerable receipt and the violations it reports.",
        "Try acting as another user with user_id=raj on order 8.",
        "Run the same requests on the secure side: the server reduces them to a validated call or denies them.",
        "Compare execute_refund_vulnerable() with validate_refund(), then pass Fix-It.",
    ]
    expected_outcome = "The vulnerable service executes tampered refunds; the secure service refuses anything that does not match the session and the order record."
    challenge = "Use a tampered tool call to refund more than the order total (or on behalf of another user) and submit the FLAG{...} from the audit record."
    advanced_challenge = (
        "No examples: tamper with the tool arguments yourself, recover the audit code, then pass Fix-It. "
        "validate_refund() must reject foreign orders, spoofed users, non-numeric amounts and anything above "
        "the authoritative total, while approving legitimate refunds."
    )
    hints = [
        "The model builds the call, but the browser sends it. Which arguments can you edit?",
        "Two overrides are accepted: user_id=... and amount=... .",
        "Try: Refund order 7 amount=5000",
    ]
    example_payloads = [
        {"label": "Legitimate refund", "input": "Refund order 7 amount 20"},
        {"label": "Inflated amount", "input": "Refund order 7 amount=5000"},
        {"label": "Act as another user", "input": "Refund order 8 amount=40 user_id=raj"},
    ]
    remediation = (
        "Recompute the tool call from trusted data: the session decides the actor, the order record decides the "
        "maximum, and every argument is validated before execution. Never execute a call just because a model emitted it."
    )
    vulnerable_fns = [model_refund_call, apply_client_overrides, execute_refund_vulnerable]
    secure_fns = [validate_refund, refund_secure]

    def vulnerable_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        call = model_refund_call(req.input)
        if call is None:
            return {"output": "The assistant could not identify an order in that request.", "leaked": False, "controls": [], "details": {"model tool call": "none"}}
        tuned = apply_client_overrides(call, req.input)
        result = execute_refund_vulnerable(tuned, ORDERS)
        # A $0 (or negative) foreign-order attempt is a rejected/meaningless
        # action, not a successful exploit: require money to actually move.
        executed_amount = float(tuned.get("amount") or 0)
        leaked = bool(result["violations"] and result["ok"] and executed_amount > 0)
        out: dict[str, Any] = {
            "output": result["output"],
            "details": {
                "signed-in user": SESSION["id"],
                "model proposed": call,
                "arguments executed": tuned,
                "orders": {f"#{k}": v for k, v in ORDERS.items()},
            },
            "leaked": leaked,
            "controls": [],
            "engine": req.engine,
        }
        if leaked:
            out["proof"] = flag_for(ID)
        return out

    def secure_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        result = refund_secure(req.input)
        decision = result.get("decision")
        return {
            "output": result["output"],
            "details": {"signed-in user": SESSION["id"], "decision": decision or "no call", "refund cap": MAX_REFUND},
            "leaked": False,
            "controls": ["session-derived identity", "authoritative order limits", "argument type validation", "audit trail"],
            "engine": req.engine,
        }
