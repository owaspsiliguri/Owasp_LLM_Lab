"""Fix-It sandbox: static checks + resource-limited subprocess execution of learner code."""
from __future__ import annotations

import ast
import json
import os
import resource
import subprocess
import sys
from pathlib import Path

from app.config import get_settings

ALLOWED_IMPORTS = {"re", "html", "json", "unicodedata", "urllib.parse", "sqlite3", "hmac", "hashlib", "math"}
# Callables that give attribute traversal, string evaluation or native-code loading.
DENIED_ATTRS = {"get_field", "vformat", "format_map", "get_type_hints", "load_extension", "enable_load_extension"}
BANNED_NAMES = {
    "eval", "exec", "compile", "open", "__import__", "input", "globals", "locals", "vars",
    "getattr", "setattr", "delattr", "breakpoint", "memoryview",
}
MAX_CODE_CHARS = 8000
HARNESS = Path(__file__).with_name("sandbox_harness.py")
BACKEND_DIR = Path(__file__).resolve().parents[2]


def static_check(code: str) -> str | None:
    """Return an error message if the code violates sandbox policy."""
    if len(code) > MAX_CODE_CHARS:
        return f"Code exceeds {MAX_CODE_CHARS} characters."
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return f"Syntax error on line {exc.lineno}: {exc.msg}"
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name not in ALLOWED_IMPORTS:
                    return f"Import of '{alias.name}' is not allowed in Fix-It challenges."
        elif isinstance(node, ast.ImportFrom):
            if (node.module or "") not in ALLOWED_IMPORTS or node.level:
                return f"Import from '{node.module}' is not allowed in Fix-It challenges."
        elif isinstance(node, ast.Name) and node.id in BANNED_NAMES:
            return f"Use of '{node.id}' is not allowed in Fix-It challenges."
        elif isinstance(node, ast.Attribute) and (node.attr.startswith("__") or node.attr in DENIED_ATTRS):
            return f"Attribute '{node.attr}' is not allowed in Fix-It challenges."
        elif isinstance(node, ast.Constant) and isinstance(node.value, str) and "__" in node.value:
            return "String literals containing '__' are not allowed in Fix-It challenges."
    return None


def _limits() -> None:
    resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))
    os.setsid()


def run(module_id: str, code: str) -> dict:
    err = static_check(code)
    if err:
        return {"passed": False, "error": err, "tests": []}
    env = {"PATH": "/usr/bin:/bin", "PYTHONDONTWRITEBYTECODE": "1"}
    try:
        proc = subprocess.run(  # noqa: S603 - fixed argv, no shell, static-checked stdin
            [sys.executable, "-E", "-s", str(HARNESS), module_id],
            input=code, capture_output=True, text=True, env=env, cwd=str(BACKEND_DIR),
            timeout=get_settings().fixit_timeout_seconds, preexec_fn=_limits,  # noqa: PLW1509
        )
    except subprocess.TimeoutExpired:
        return {"passed": False, "error": "Execution timed out. Check for infinite loops or catastrophic regular expressions.", "tests": []}
    if proc.returncode != 0 and not proc.stdout.strip():
        return {"passed": False, "error": "Your code crashed the runner: " + proc.stderr.strip()[-400:], "tests": []}
    try:
        result = json.loads(proc.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        return {"passed": False, "error": "Runner returned no result.", "tests": []}
    return result
