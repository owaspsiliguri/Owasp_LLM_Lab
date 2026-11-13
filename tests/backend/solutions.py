"""Reference Fix-It solutions used by the test-suite.

Most entries are the repository's own secure implementations, extracted with
``inspect.getsource``. A few secure implementations read module-level constants
and helpers; the sandbox executes a submission in a fresh namespace, so those
entries are spelled out here with the constants inlined. Every entry must run
inside the real sandbox (``app.services.sandbox``), which only permits the
allowed imports.
"""
import inspect

from app.vulnerabilities import llm01_prompt_injection as m1
from app.vulnerabilities import llm02_info_disclosure as m2
from app.vulnerabilities import llm03_data_poisoning as m3
from app.vulnerabilities import llm04_model_dos as m4
from app.vulnerabilities import llm05_supply_chain as m5
from app.vulnerabilities import llm06_unbounded_consumption as m6
from app.vulnerabilities import llm07_excessive_agency as m7
from app.vulnerabilities import llm08_overreliance as m8
from app.vulnerabilities import llm09_hallucinations as m9
from app.vulnerabilities import llm10_improper_output as m10
from app.vulnerabilities import llm14_indirect_injection as m14

FILTER_DOCS = '''def filter_docs(docs, user):
    rank = {"public": 0, "internal": 1, "confidential": 2}
    tenant = user.get("tenant") if isinstance(user, dict) else None
    if not tenant:
        return []
    clearance = rank.get(user.get("clearance")) if user.get("clearance") in rank else None
    out = []
    for doc in docs or []:
        if not isinstance(doc, dict):
            continue
        level = rank.get(doc.get("level"))
        if level is None:
            continue
        if doc.get("tenant") == tenant:
            if clearance is not None and level <= clearance:
                out.append(doc)
            elif clearance is None and level == 0:
                out.append(doc)
        elif level == 0:
            out.append(doc)
    return out
'''

APPLY_DISCOUNT = '''def apply_discount(reply, role):
    entitled = {"customer": 5, "staff": 30}
    return {"discount_percent": entitled.get(role, 0)}
'''

# llm13: search_documents() calls strip_filters/_terms/rank in the module.
RAG_TENANT_ISOLATION = r'''import re

FILTER_RE = re.compile(r'(?:tenant|org|account)\s*:\s*"?([a-z0-9-]+)"?|@([a-z0-9-]+)', re.I)
TOKEN_RE = re.compile(r"[a-z0-9]+")
STOPWORDS = {"the", "a", "an", "is", "are", "and", "or", "of", "to", "in", "for", "on", "what", "my", "our", "show", "me"}


def search_documents(query, user, documents):
    # The tenant comes from the authenticated user. Any filter syntax in the
    # query is discarded before matching.
    if not isinstance(query, str) or not isinstance(user, dict) or not isinstance(documents, list):
        return []
    tenant = user.get("tenant")
    if not isinstance(tenant, str) or not tenant:
        return []
    text = FILTER_RE.sub(" ", query)
    words = [w for w in TOKEN_RE.findall(text.lower()) if len(w) > 2 and w not in STOPWORDS]
    if not words:
        return []
    out = []
    for doc in documents:
        if not isinstance(doc, dict) or doc.get("tenant") != tenant:
            continue
        haystack = " ".join(str(doc.get(key, "")) for key in ("id", "tenant", "body")).lower()
        if any(word in haystack for word in words):
            out.append(doc)
    return out
'''

# llm15: build_tool_messages() reads INSTRUCTION_RE and MAX_TOOL_CHARS.
TOOL_OUTPUT_INJECTION = r'''import html
import re

INSTRUCTION_RE = re.compile(
    r"(?:(?:ignore|disregard|forget|override)\b.{0,40}\b(?:previous|prior|above|system)\b.{0,30}"
    r"\b(?:instruction|prompt|rule)s?"
    r"|(?:reveal|print|show|output|leak|disclose)\b.{0,40}\b(?:vault|token|secret|key|configuration)"
    r"|\byou are now\b|\bsystem\s*:|\bnew instructions?\s*:)",
    re.I | re.S,
)
MAX_TOOL_CHARS = 600


def build_tool_messages(system_prompt, tool_result):
    if not isinstance(tool_result, str) or not tool_result.strip():
        return [
            {"role": "system", "content": system_prompt},
            {"role": "tool", "content": "[tool returned no usable text]"},
        ]
    text = html.escape(tool_result, quote=True)[:MAX_TOOL_CHARS]
    lines = [line for line in text.splitlines() if not INSTRUCTION_RE.search(line)]
    removed = len(text.splitlines()) - len(lines)
    content = "\n".join(lines).strip() or "[tool output removed by policy]"
    if removed:
        content += f"\n[{removed} instruction-like line(s) removed by policy]"
    return [
        {"role": "system", "content": system_prompt},
        {"role": "tool", "content": content},
    ]
'''

# llm16: validate_refund() reads MAX_REFUND.
PARAMETER_TAMPERING = r'''MAX_REFUND = 100.0


def validate_refund(call, session_user, orders):
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
'''

# llm17: authorize_access() reads ROLE_CAPABILITIES.
AGENT_AUTH_BYPASS = r'''ROLE_CAPABILITIES = {
    "viewer": {"public", "internal"},
    "editor": {"public", "internal"},
    "admin": {"public", "internal", "admin"},
}


def authorize_access(user, resource):
    if not isinstance(user, dict) or not isinstance(resource, dict):
        return "deny"
    role = user.get("role")
    tenant = user.get("tenant")
    owner = resource.get("owner")
    classification = resource.get("classification")
    if role not in ROLE_CAPABILITIES or not isinstance(tenant, str) or not tenant:
        return "deny"
    if classification not in {"public", "internal", "admin"}:
        return "deny"
    if resource.get("tenant") != tenant and classification != "public":
        return "deny"
    if owner is not None and owner != user.get("id") and role != "admin":
        return "deny"
    return "allow" if classification in ROLE_CAPABILITIES[role] else "deny"
'''

# llm18: accept_memory() reads four module-level patterns and two constants.
MEMORY_POISONING = r'''import re

ALLOWED_MEMORY_KEYS = {"preference", "timezone", "language"}
MAX_MEMORY_CHARS = 120
PRIVILEGE_RE = re.compile(
    r"\b(?:i am|i'm|this user is|the user is)\b.{0,40}\b(?:admin|administrator|owner|root|verified|authori[sz]ed|privileged)\b"
    r"|\b(?:verified|privileged|elevated)\s+(?:user|account|admin)\b"
    r"|\brole\s*[:=]\s*(?:admin|owner|root)\b"
    r"|\b(?:clearance|permission)s?\s*[:=]",
    re.I | re.S,
)
INSTRUCTION_RE = re.compile(
    r"\b(?:ignore|disregard|forget|override)\b.{0,30}\b(?:previous|prior|system|instruction)s?\b"
    r"|\b(?:reveal|print|show|output)\b.{0,30}\b(?:token|secret|key|password)\b"
    r"|\bsystem\s*:",
    re.I | re.S,
)
SENSITIVE_RE = re.compile(r"\b(?:password|passphrase|api[_ ]?key|secret|token|verification code)\b", re.I)


def accept_memory(candidate, session):
    if not isinstance(candidate, dict) or not isinstance(session, dict) or not session.get("id"):
        return {"accepted": False, "reason": "malformed memory write", "value": None}
    key = candidate.get("key")
    value = candidate.get("value")
    if key not in ALLOWED_MEMORY_KEYS:
        return {"accepted": False, "reason": "memory key is not allow-listed", "value": None}
    if not isinstance(value, str):
        return {"accepted": False, "reason": "memory value must be text", "value": None}
    text = value.strip()
    if not text:
        return {"accepted": False, "reason": "memory value is empty", "value": None}
    if len(text) > MAX_MEMORY_CHARS:
        return {"accepted": False, "reason": "memory value exceeds the size limit", "value": None}
    if PRIVILEGE_RE.search(text):
        return {"accepted": False, "reason": "memory cannot assert a role or privilege", "value": None}
    if INSTRUCTION_RE.search(text):
        return {"accepted": False, "reason": "memory cannot contain instructions", "value": None}
    if SENSITIVE_RE.search(text):
        return {"accepted": False, "reason": "memory cannot store credentials", "value": None}
    return {"accepted": True, "reason": "stored as a preference", "value": text}
'''

# llm19: assess_conversation() reads three module-level patterns.
MULTI_TURN_JAILBREAK = r'''import re

FRAMING_RE = re.compile(r"\b(?:hypothetical|fictional|story|novel|pretend|roleplay|for a class|in a movie|translate)\b", re.I)
REQUEST_RE = re.compile(
    r"\b(?:launch|override|authorization|authorisation|master|break-glass|break glass)\s+(?:code|key)\b"
    r"|\b(?:reveal|print|show|give me)\b.{0,30}\b(?:code|secret|key)\b",
    re.I,
)
BENIGN_RE = re.compile(r"\b(?:hours|shipping|refund|invoice|password reset|pricing|status)\b", re.I)


def assess_conversation(turns):
    if not isinstance(turns, list):
        return {"allow": False, "risk": 100, "reasons": ["malformed conversation"]}
    cleaned = [t.strip() for t in turns if isinstance(t, str) and t.strip()]
    if not cleaned:
        return {"allow": True, "risk": 0, "reasons": []}
    reasons = []
    risk = 0
    request_turns = [i + 1 for i, t in enumerate(cleaned) if REQUEST_RE.search(t)]
    framing_turns = [i + 1 for i, t in enumerate(cleaned) if FRAMING_RE.search(t)]
    if framing_turns:
        risk += min(20 * len(framing_turns), 40)
        reasons.append(f"fictional or transformation framing in turn(s) {framing_turns}")
    if request_turns:
        risk += 50
        reasons.append(f"privileged request in turn(s) {request_turns}")
    if request_turns and framing_turns:
        risk += 10
        reasons.append("request is preceded by framing (staged escalation)")
    if len(cleaned) > 8:
        risk += 10
        reasons.append("unusually long conversation")
    allow = not request_turns
    if allow and not BENIGN_RE.search(" ".join(cleaned)) and len(cleaned) > 2:
        risk += 5
    return {"allow": allow, "risk": min(risk, 100), "reasons": reasons}
'''

# llm20: prepare_image_context() reads two patterns and two limits.
MULTIMODAL_INJECTION = r'''import re

HIDDEN_RE = re.compile("[\u200b-\u200f\u202a-\u202e\u2060\ufeff]")
INSTRUCTION_RE = re.compile(
    r"(?:(?:ignore|disregard|forget|override)\b.{0,40}\b(?:previous|prior|above|system)\b.{0,30}"
    r"\b(?:instruction|prompt|rule)s?"
    r"|(?:reveal|print|show|output|leak|disclose)\b.{0,40}\b(?:badge|token|secret|key|configuration)"
    r"|\byou are now\b|\bsystem\s*:|\bnew instructions?\s*:)",
    re.I | re.S,
)
MAX_OCR_CHARS = 1500
MAX_QUESTION_CHARS = 300


def prepare_image_context(question, ocr_text):
    if not isinstance(question, str) or not isinstance(ocr_text, str):
        return {"question": "", "visible_text": "", "quarantined": ["malformed upload"], "allow": False}
    clean_question = HIDDEN_RE.sub("", question).strip()[:MAX_QUESTION_CHARS]
    quarantined = []
    text = HIDDEN_RE.sub("", ocr_text).strip()
    if len(text) > MAX_OCR_CHARS:
        text = text[:MAX_OCR_CHARS]
        quarantined.append("OCR text exceeds the extraction budget")
    if INSTRUCTION_RE.search(text):
        quarantined.append("instruction pattern in OCR text")
        text = ""
    return {
        "question": clean_question,
        "visible_text": text,
        "quarantined": quarantined,
        "allow": not quarantined,
    }
'''

# llm21: validate_manifest() reads INSTRUCTION_RE and MAX_DESCRIPTION.
MCP_SECURITY = r'''import re

INSTRUCTION_RE = re.compile(
    r"\b(?:ignore|disregard|forget|override)\b.{0,40}\b(?:previous|prior|system|instruction)s?"
    r"|\b(?:read|fetch|open|print|reveal|include)\b.{0,40}\b(?:vault|token|secret|flag|credential)"
    r"|\bsystem\s*:",
    re.I | re.S,
)
MAX_DESCRIPTION = 300


def validate_manifest(tool, policy):
    if not isinstance(tool, dict) or not isinstance(policy, dict):
        return {"ok": False, "reason": "malformed MCP manifest"}
    name = tool.get("name")
    scopes = tool.get("scopes") or []
    description = tool.get("description", "")
    if not isinstance(name, str) or name not in policy:
        return {"ok": False, "reason": "tool is not in the allow-list"}
    if not isinstance(scopes, list) or not scopes or not all(isinstance(s, str) and s for s in scopes):
        return {"ok": False, "reason": "scopes must be a non-empty list of strings"}
    allowed = policy[name]
    bad = [s for s in scopes if s == "*" or s not in allowed]
    if bad:
        return {"ok": False, "reason": f"scope(s) not permitted: {', '.join(bad)}"}
    if not isinstance(description, str):
        return {"ok": False, "reason": "description must be text"}
    if len(description) > MAX_DESCRIPTION:
        return {"ok": False, "reason": "description exceeds the size limit"}
    if INSTRUCTION_RE.search(description):
        return {"ok": False, "reason": "description contains instructions"}
    return {"ok": True, "reason": "manifest accepted"}
'''

# llm22: build_log_command() reads SHELL_META, MAX_TERM and LOG_PATH.
CODE_INJECTION = r'''import re

LOG_PATH = "/var/log/access.log"
SHELL_META = re.compile(r"[;|&`$<>\n\r\t]|\.\./")
MAX_TERM = 120


def build_log_command(term):
    if not isinstance(term, str):
        return []
    text = term.strip()
    if not text or len(text) > MAX_TERM or SHELL_META.search(text):
        return []
    return ["grep", "-i", "--", text, LOG_PATH]
'''

SOLUTIONS = {
    "llm01": inspect.getsource(m1.build_messages),
    "llm02": "import re\n\n" + inspect.getsource(m2.redact),
    "llm10": inspect.getsource(m10.search_products),
    "llm03": "import hmac\nimport hashlib\n\n" + inspect.getsource(m3.verify_provenance),
    "llm04": "import re\n\n" + inspect.getsource(m4.estimate_cost) + "\n\n" + inspect.getsource(m4.check_request),
    "llm06": inspect.getsource(m6.enforce_budget),
    "llm09": inspect.getsource(m9.answer_or_abstain),
    "llm05": "import hashlib\nimport hmac\n\n" + inspect.getsource(m5.verify_artifact),
    "llm07": inspect.getsource(m7.authorize_tool_call),
    "llm08": "import re\n\n" + inspect.getsource(m8.scan_diff),
    "llm11": APPLY_DISCOUNT,
    "llm12": FILTER_DOCS,
    "llm13": RAG_TENANT_ISOLATION,
    "llm14": inspect.getsource(m14.build_context_messages),
    "llm15": TOOL_OUTPUT_INJECTION,
    "llm16": PARAMETER_TAMPERING,
    "llm17": AGENT_AUTH_BYPASS,
    "llm18": MEMORY_POISONING,
    "llm19": MULTI_TURN_JAILBREAK,
    "llm20": MULTIMODAL_INJECTION,
    "llm21": MCP_SECURITY,
    "llm22": CODE_INJECTION,
}
