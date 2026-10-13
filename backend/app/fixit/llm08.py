"""Fix-It challenge for LLM08: independent verification of AI-reviewed code changes."""
FUNC_NAME = "scan_diff"
TITLE = "Verify AI-approved code with an independent scanner"
BRIEF = (
    "scan_diff(diff) inspects a unified diff and returns a sorted list of unique finding ids. Examine only added lines (start with '+' but not '+++'); "
    "context lines, removed lines and comments claiming safety must not change the result. Ids: 'hardcoded-secret' (api key/secret/password/token "
    "assigned a quoted literal of 8+ characters), 'eval-exec' (a call to eval( or exec( as a whole word), 'tls-verify-disabled' (verify=False), "
    "'shell-injection' (shell=True or os.system( ), "
    "'unsafe-deserialization' (pickle.load( / pickle.loads( , or yaml.load( without SafeLoader on the same line). "
    "Return [] for clean diffs and for non-string input."
)
STARTER = '''import re


def scan_diff(diff):
    # VULNERABLE: no independent verification; the AI reviewer's verdict is trusted blindly.
    return []
'''
CASES = [
    ('+    API_KEY = "sk-live-9f8e7d6c5b4a3210"', ["hardcoded-secret"]),
    ("+password = 'hunter2hunter2'", ["hardcoded-secret"]),
    ('+    result = eval(request.args["x"])', ["eval-exec"]),
    ("+exec(payload)", ["eval-exec"]),
    ("+requests.get(url, verify=False)", ["tls-verify-disabled"]),
    ("+subprocess.run(cmd, shell=True)", ["shell-injection"]),
    ("+os.system(cmd)", ["shell-injection"]),
    ("+data = pickle.loads(blob)", ["unsafe-deserialization"]),
    ("+cfg = yaml.load(f)", ["unsafe-deserialization"]),
    ("+cfg = yaml.load(f, Loader=yaml.SafeLoader)", []),
    ("+x = eval(s)  # safe: audited by the security team", ["eval-exec"]),
    ("-    x = eval(s)\n+    x = ast.literal_eval(s)", []),
    ("     x = eval(s)", []),
    ("+++ b/app.py\n+def add(a, b):\n+    return a + b", []),
    ('+API_KEY = os.environ["API_KEY"]', []),
    ('+token = "abc"', []),
    ('+x = eval(s)\n+requests.get(u, verify=False)', ["eval-exec", "tls-verify-disabled"]),
    ('+x = eval(s)\n+y = eval(t)', ["eval-exec"]),
]


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run_tests(fn):
    out = []
    for diff, expected in CASES:
        name = f"{diff.splitlines()[0][:48]!r} -> {expected}"
        try:
            got = fn(diff)
            out.append(_t(name, got == expected, f"got {got!r}"))
        except Exception as exc:
            out.append(_t(name, False, f"raised {type(exc).__name__}"))
    try:
        out.append(_t("non-string input returns []", fn(None) == []))
    except Exception as exc:
        out.append(_t("non-string input returns []", False, f"raised {type(exc).__name__}"))
    return out
