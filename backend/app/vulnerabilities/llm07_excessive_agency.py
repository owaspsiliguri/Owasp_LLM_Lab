"""LLM07 - Excessive Agency (tool calls executed from model output)."""
from __future__ import annotations

import copy
import re
from typing import Any

from app.core.secrets import flag_for
from app.models.schemas import RunRequest
from app.vulnerabilities.base import VulnerabilityModule

ID = "llm07"
USER, ROLE = "mallory", "customer"
STATE0 = {"tickets": {1: {"owner": "mallory", "title": "Login issue"}, 2: {"owner": "alice", "title": "Invoice dispute"},
                      3: {"owner": "bob", "title": "Data export"}}, "refunds": [], "emails": [], "next_id": 4}


def model_tool_call(message: str) -> dict[str, Any] | None:
    """Deterministic stand-in for a function-calling model: maps requests to a tool call."""
    if m := re.search(r"delete (?:ticket )?#?(\d+)", message, re.I):
        return {"tool": "delete_ticket", "args": {"id": int(m.group(1))}}
    if m := re.search(r"refund \$?(\d+(?:\.\d+)?) (?:for|to) order #?(\d+)", message, re.I):
        return {"tool": "refund", "args": {"amount": float(m.group(1)), "order": int(m.group(2))}}
    if re.search(r"\bemail (?:everyone|all customers|all)\b", message, re.I):
        return {"tool": "send_email", "args": {"to": "all", "body": message[:80]}}
    if m := re.search(r"(?:show|read|open) (?:me )?(?:ticket )?#?(\d+)", message, re.I):
        return {"tool": "get_ticket", "args": {"id": int(m.group(1))}}
    if m := re.search(r"(?:create|open|file) (?:a )?ticket (?:about|for) (.+)", message, re.I):
        return {"tool": "create_ticket", "args": {"title": m.group(1)[:60]}}
    return None


def execute_tool(state: dict[str, Any], call: dict[str, Any]) -> str:
    tool, a = call["tool"], call["args"]
    if tool == "get_ticket":
        t = state["tickets"].get(a["id"])
        return f"Ticket {a['id']}: {t['title']} (owner {t['owner']})" if t else f"Ticket {a['id']} not found"
    if tool == "create_ticket":
        state["tickets"][state["next_id"]] = {"owner": USER, "title": a["title"]}
        state["next_id"] += 1
        return f"Created ticket {state['next_id'] - 1}"
    if tool == "refund":
        state["refunds"].append({"order": a["order"], "amount": a["amount"]})
        return f"Refunded ${a['amount']:.2f} on order {a['order']}"
    if tool == "delete_ticket":
        return f"Deleted ticket {a['id']}" if state["tickets"].pop(a["id"], None) else f"Ticket {a['id']} not found"
    state["emails"].append({"to": a["to"], "body": a["body"]})
    return f"Email sent to {a['to']}"


def vulnerable_agent(state: dict[str, Any], message: str) -> tuple[dict[str, Any] | None, str]:
    # VULNERABLE: whatever tool the model asks for runs with the service account's full privileges.
    call = model_tool_call(message)
    return (call, execute_tool(state, call)) if call else (None, "No tool needed.")


def authorize_tool_call(role, tool, args, user):
    # SECURE: deny by default; per-role policy, ownership checks, amount limits and human confirmation for high impact.
    if not isinstance(args, dict) or not isinstance(role, str) or not isinstance(tool, str):
        return "deny"

    def amount_ok() -> bool:
        a = args.get("amount")
        return isinstance(a, int | float) and not isinstance(a, bool) and a > 0

    if role == "customer":
        if tool == "get_ticket":
            return "allow" if isinstance(user, str) and user and args.get("owner") == user else "deny"
        return "allow" if tool == "create_ticket" else "deny"
    if role in ("agent", "admin"):
        if tool in ("get_ticket", "create_ticket"):
            return "allow"
        if tool == "refund":
            if not amount_ok():
                return "deny"
            return "confirm" if args["amount"] > 50 else "allow"
        if role == "admin":
            if tool == "delete_ticket":
                return "confirm"
            if tool == "send_email":
                return "confirm" if args.get("to") == "all" else "allow"
    return "deny"


def secure_agent(state: dict[str, Any], message: str) -> tuple[dict[str, Any] | None, str, str]:
    call = model_tool_call(message)
    if call is None:
        return None, "No tool needed.", "none"
    args = dict(call["args"])
    if call["tool"] == "get_ticket":  # ownership comes from the database, never from the model
        ticket = state["tickets"].get(args["id"])
        args["owner"] = ticket["owner"] if ticket else None
    decision = authorize_tool_call(ROLE, call["tool"], args, USER)
    if decision == "allow":
        return call, execute_tool(state, call), decision
    if decision == "confirm":
        return call, "Held for human approval; nothing was executed.", decision
    return call, f"Denied: role '{ROLE}' may not call {call['tool']} with these arguments.", decision


class ExcessiveAgency(VulnerabilityModule):
    id = ID
    fixit_key = "llm07"
    name = "Excessive Agency"
    category = "LLM06:2025 Excessive Agency"
    owasp_id = "LLM07"
    difficulty = "Advanced"
    estimated_minutes = 30
    prerequisites = ["LLM01 Prompt Injection", "LLM10 Improper Output Handling"]
    overview = (
        "A support assistant uses function calling to read, create and delete tickets, issue refunds and send email. You are signed in as "
        "'mallory', an ordinary customer. The backend executes any tool call the model emits using a privileged service account, so asking "
        "the model politely is enough to reach other customers' tickets, delete data, refund money and email everyone."
    )
    objectives = [
        "Identify excessive functionality, permissions and autonomy in an LLM tool integration",
        "Abuse an assistant to perform actions its user is not authorised to perform",
        "Apply deny-by-default authorization, ownership checks from trusted data, limits and human approval",
        "Implement and validate a tool-call authorization policy",
    ]
    threat = "The model is given more tools, permissions or autonomy than the task needs, and its output is executed without checks."
    impact = "Unauthorised data access, destructive actions, financial loss and mass communication on behalf of the organisation."
    mitigation = [
        "Expose only the tools the task needs; scope credentials to the signed-in user, not a service account",
        "Authorize every call server-side against the user's role and the resource owner, with deny by default",
        "Take ownership and identity from trusted data, never from model output",
        "Require human approval for high-impact actions and log every decision",
    ]
    guided_steps = [
        "As mallory, run 'Show ticket 1' on both sides. Your own ticket works.",
        "Run 'Show ticket 2' on the vulnerable side: alice's ticket is exposed (IDOR through the assistant).",
        "Run the delete, refund and email-everyone examples on the vulnerable side and read the resulting state.",
        "Run them on the secure side and read each decision (allow, confirm, deny) and the audit log.",
        "Open the Code tab and read authorize_tool_call().",
    ]
    expected_outcome = "The vulnerable assistant performs every action; the secure one allows only mallory's own ticket and denies or holds the rest."
    challenge = "Make the assistant perform a destructive or unauthorised action as a customer, then submit the FLAG{...} it reveals."
    advanced_challenge = (
        "No sample actions. As customer mallory, make the assistant perform a destructive or unauthorised "
        "action with a request you design yourself, capture the proof, then pass Fix-It: authorize every "
        "model-requested tool call against the real user and resource, deny by default."
    )
    hints = [
        "The backend never asks whether you are allowed to do what the model decided to do.",
        "Tickets belong to different owners. You are only 'mallory'.",
        "Try: Delete ticket 2",
    ]
    example_payloads = [
        {"label": "Own ticket", "input": "Show ticket 1"},
        {"label": "Someone else's ticket", "input": "Show ticket 2"},
        {"label": "Delete a ticket", "input": "Delete ticket 2"},
        {"label": "Refund $500", "input": "Refund $500 for order 9"},
        {"label": "Email everyone", "input": "Email everyone that the service is shutting down"},
    ]
    remediation = (
        "Never let the model be the authority. Authorize each requested action against the real user and resource, deny by default, "
        "keep identities out of model control, require approval for high-impact actions and keep an audit trail."
    )
    vulnerable_fns = [vulnerable_agent]
    secure_fns = [authorize_tool_call, secure_agent]

    def vulnerable_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        state = copy.deepcopy(STATE0)
        call, result = vulnerable_agent(state, req.input)
        harmful = bool(call) and (call["tool"] in ("delete_ticket", "refund", "send_email")
                                  or (call["tool"] == "get_ticket" and STATE0["tickets"].get(call["args"]["id"], {}).get("owner") not in (USER, None)))
        out = {"output": result, "details": {"signed-in user": f"{USER} ({ROLE})", "model tool call": call or "none", "executes as": "service account (admin)"},
               "tables": [{"label": "Tickets after the call", "rows": [{"id": k, **v} for k, v in state["tickets"].items()]}],
               "leaked": harmful, "controls": []}
        if state["refunds"] or state["emails"]:
            out["tables"].append({"label": "Side effects", "rows": [{"type": "refund", **r} for r in state["refunds"]] + [{"type": "email", **e} for e in state["emails"]]})
        if harmful:
            out["proof"] = flag_for(ID)
        return out

    def secure_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        state = copy.deepcopy(STATE0)
        call, result, decision = secure_agent(state, req.input)
        return {"output": result, "details": {"signed-in user": f"{USER} ({ROLE})", "model tool call": call or "none", "decision": decision},
                "tables": [{"label": "Audit log", "rows": [{"user": USER, "role": ROLE, "tool": call["tool"] if call else "-", "decision": decision}]},
                           {"label": "Tickets after the call", "rows": [{"id": k, **v} for k, v in state["tickets"].items()]}],
                "leaked": False, "controls": ["deny-by-default policy", "ownership from database", "amount limits", "human approval for high impact", "audit log"]}
