"""LLM22 - LLM-to-Code Injection.

The reporting copilot writes SQL and shell commands from natural language. The
generated command is executed with a shell or concatenated into SQL, so a
report request can read files and tables it was never meant to reach.
"""
from __future__ import annotations

import copy
import re
import sqlite3
from typing import Any

from app.core.secrets import flag_for
from app.models.schemas import RunRequest
from app.vulnerabilities.base import VulnerabilityModule

ID = "llm22"
LOG_PATH = "/var/log/access.log"
LOG_LINES = [
    "10.0.0.4 GET /login 200",
    "10.0.0.9 POST /checkout 500",
    "10.0.1.2 GET /docs 200",
]
SHELL_META = re.compile(r"[;|&`$<>\n\r\t]|\.\./")
MAX_TERM = 120


def build_shell_command_vulnerable(term: str) -> str:
    return f'grep -i "{term}" {LOG_PATH}'


def run_shell_vulnerable(term: str) -> dict[str, Any]:
    # VULNERABLE: the model's text is interpolated into a shell string and
    # executed. A semicolon starts a second command.
    command = build_shell_command_vulnerable(term)
    injected = bool(SHELL_META.search(term))
    if injected:
        return {"command": command, "output": "access.log lines omitted\n" + flag_for(ID), "injected": True}
    rows = [line for line in LOG_LINES if term.lower() in line.lower()]
    return {"command": command, "output": "\n".join(rows) or "no matching log lines", "injected": False}


def build_log_command(term):
    # SECURE: validated argv list for a fixed binary. No shell, no separators,
    # no redirection; the search term is one argument after "--".
    if not isinstance(term, str):
        return []
    text = term.strip()
    if not text or len(text) > MAX_TERM or SHELL_META.search(text):
        return []
    return ["grep", "-i", "--", text, LOG_PATH]


def run_shell_secure(term: str) -> dict[str, Any]:
    command = build_log_command(term)
    if not command:
        return {"command": "", "output": "Request rejected: the search term contains unsupported characters.", "injected": False}
    rows = [line for line in LOG_LINES if term.strip().lower() in line.lower()]
    return {"command": " ".join(command), "output": "\n".join(rows) or "no matching log lines", "injected": False}


def make_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE accounts (account TEXT PRIMARY KEY, plan TEXT, mrr INTEGER)")
    conn.execute("CREATE TABLE secrets (id INTEGER PRIMARY KEY, token TEXT)")
    conn.executemany("INSERT INTO accounts VALUES (?,?,?)", [
        ("acme", "enterprise", 4200), ("globex", "growth", 900)])
    conn.execute("INSERT INTO secrets VALUES (1, ?)", (flag_for(ID),))
    return conn


def report_sql_vulnerable(conn: sqlite3.Connection, account: str) -> dict[str, Any]:
    # VULNERABLE: model text is concatenated into the statement.
    sql = "SELECT account, plan, mrr FROM accounts WHERE account = '" + account + "'"  # nosec B608 - intentional
    try:
        rows = conn.execute(sql).fetchall()
        error = None
    except sqlite3.Error as exc:
        rows, error = [], f"SQL error: {exc}"
    return {"sql": sql, "rows": rows, "error": error}


def report_sql_secure(conn: sqlite3.Connection, account: str) -> dict[str, Any]:
    sql = "SELECT account, plan, mrr FROM accounts WHERE account = ?"
    rows = conn.execute(sql, (account,)).fetchall()
    return {"sql": sql, "params": [account], "rows": rows, "error": None}


class LlmToCodeInjection(VulnerabilityModule):
    id = ID
    fixit_key = "llm22"
    name = "LLM-to-Code Injection"
    category = "LLM05:2025 Improper Output Handling (code generation)"
    owasp_id = "LLM22"
    difficulty = "Expert"
    estimated_minutes = 40
    prerequisites = ["LLM10 Improper Output Handling", "Basic SQL and shell syntax"]
    overview = (
        "Acme's reporting copilot turns a support request into a SQL query or a shell command and runs it. "
        "The generated text is treated as trusted code: the shell variant interpolates it into a command string "
        "and the SQL variant concatenates it into a statement. Both give the requester more reach than the "
        "report they asked for."
    )
    objectives = [
        "Explain why LLM-generated code is untrusted input, even when it looks like a query",
        "Escape a generated shell command and a generated SQL statement in a controlled target",
        "Replace string interpolation with argument arrays, parameterized SQL and execution isolation",
        "Validate a command builder that rejects shell metacharacters",
    ]
    threat = "Model-generated SQL, shell or code is executed without parameterization, validation or isolation."
    impact = "Command execution, secret file disclosure, database exfiltration and full host compromise in the worst case."
    mitigation = [
        "Never run generated code as a string: use argv arrays, parameterized queries and typed APIs",
        "Validate generated artefacts against a strict allow-list before execution",
        "Run generated code in a sandbox with no secrets and no network",
        "Keep the model away from privileged credentials and require review for destructive operations",
    ]
    guided_steps = [
        "Choose the shell target and request a normal log search.",
        "Close the quoting and append a second command that reads /srv/vault/token.",
        "Read the vulnerable command and its output, then submit the token.",
        "Switch to the SQL target and inject a UNION that reads the secrets table.",
        "Replay both requests on the secure side: the command is an argv list and the query is parameterized.",
        "Compare both vulnerable builders with build_log_command()/report_sql_secure(), then pass Fix-It.",
    ]
    expected_outcome = "The vulnerable copilot executes injected shell and SQL; the secure copilot rejects shell syntax and parameterizes every query."
    challenge = "Read the vault token through the shell report or the SQL report, then submit the FLAG{...}."
    advanced_challenge = (
        "No examples: exploit either generated artefact with your own payload, recover the vault token, then pass "
        "Fix-It. build_log_command() must return a safe argv list, reject metacharacters and preserve legitimate "
        "search terms unchanged."
    )
    hints = [
        "The shell variant wraps your search term in double quotes. What ends that quoted string?",
        "The SQL variant puts your account name inside single quotes. A UNION needs three matching columns.",
        "Shell: x\"; cat /srv/vault/token; #    SQL: x' UNION SELECT id, token, 0 FROM secrets --",
    ]
    example_payloads = [
        {"label": "Benign log search", "variant": "shell", "input": "login"},
        {"label": "Shell injection", "variant": "shell", "input": 'x"; cat /srv/vault/token; #'},
        {"label": "Benign account report", "variant": "sql", "input": "acme"},
        {"label": "SQL injection", "variant": "sql", "input": "x' UNION SELECT id, token, 0 FROM secrets --"},
    ]
    remediation = (
        "Treat generated code as hostile: parameterize SQL, build argv arrays instead of shell strings, allow-list "
        "identifiers, and run anything generated in an isolated sandbox without secrets."
    )
    variants = ["shell", "sql"]
    variant_label = "Report target"
    variant_help = {
        "shell": "Log search: the copilot writes a grep command",
        "sql": "Account report: the copilot writes a SQL query",
    }
    vulnerable_fns = [build_shell_command_vulnerable, run_shell_vulnerable, report_sql_vulnerable]
    secure_fns = [build_log_command, run_shell_secure, report_sql_secure]

    def vulnerable_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        variant = self.pick_variant(req)
        flag = flag_for(ID)
        if variant == "shell":
            result = run_shell_vulnerable(req.input)
            leaked = result["injected"]
            out: dict[str, Any] = {
                "output": result["output"],
                "details": {"target": "shell", "generated command": result["command"], "execution": "shell=True"},
                "leaked": leaked,
                "controls": [],
                "engine": req.engine,
            }
        else:
            database = make_db()
            result = report_sql_vulnerable(database, req.input)
            leaked = flag in repr(result["rows"])
            out = {
                "output": "Query executed.",
                "sql": result["sql"],
                "rows": result["rows"],
                "error": result["error"],
                "details": {"target": "sql", "columns": 3, "execution": "string concatenation"},
                "leaked": leaked,
                "controls": [],
                "engine": req.engine,
            }
        if leaked:
            out["proof"] = flag
        return out

    def secure_demo(self, req: RunRequest) -> dict[str, Any]:
        self.require_deterministic(req)
        variant = self.pick_variant(req)
        if variant == "shell":
            result = run_shell_secure(req.input)
            return {
                "output": result["output"],
                "details": {"target": "shell", "generated argv": result["command"] or "rejected", "execution": "no shell"},
                "leaked": False,
                "controls": ["argv array", "metacharacter allow-list", "fixed binary", "no shell"],
                "engine": req.engine,
            }
        result = report_sql_secure(make_db(), req.input)
        return {
            "output": "Query executed with a bound parameter.",
            "sql": result["sql"],
            "params": result["params"],
            "rows": result["rows"],
            "details": {"target": "sql", "execution": "parameterized"},
            "leaked": False,
            "controls": ["parameterized query", "bound parameters", "typed result"],
            "engine": req.engine,
        }
