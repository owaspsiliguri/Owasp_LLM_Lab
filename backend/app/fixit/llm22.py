"""Fix-It challenge for LLM22: build a shell-free log command."""

FUNC_NAME = "build_log_command"
TITLE = "Build an argv command instead of a shell string"
BRIEF = (
    "build_log_command(term) returns an argv list for scanning /var/log/access.log with grep, or [] when the "
    "request is unsafe. Accept a string of 1-120 characters after trimming, preserve it as a single argument, "
    "and return ['grep', '-i', '--', term, '/var/log/access.log']. Reject non-strings, empty terms, over-long "
    "terms, and any term containing shell metacharacters: ; | & $ ` < > newline carriage return tab or ../. "
    "Never return a string, and never interpolate the term into a command line."
)
STARTER = '''def build_log_command(term):
    # VULNERABLE: one string, later executed by a shell.
    return 'grep -i "' + str(term) + '" /var/log/access.log'
'''

ATTACKS = [
    'x"; cat /srv/vault/token; #',
    "login | tee /tmp/out",
    "$(cat /srv/vault/token)",
    "`id`",
    "logs && rm -rf /",
    "line\ncat /etc/passwd",
    "../../etc/passwd",
]


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def _is_argv(value):
    return isinstance(value, list) and all(isinstance(part, str) for part in value)


def run_tests(fn):
    out = []
    try:
        benign = fn("login failure")
        ok = _is_argv(benign) and benign[:3] == ["grep", "-i", "--"] and benign[-1] == "/var/log/access.log"
        out.append(_t("returns a grep argv list", ok, f"got {benign!r}"))
        out.append(_t("search term stays one argument", isinstance(benign, list) and "login failure" in benign))
        out.append(_t("binary and log path are fixed",
                      isinstance(benign, list) and benign[0] == "grep" and benign[-1] == "/var/log/access.log"))
    except Exception as exc:
        out.append(_t("returns a grep argv list", False, f"raised {type(exc).__name__}"))
        return out

    trimmed = fn("  login  ")
    out.append(_t("term is trimmed", isinstance(trimmed, list) and "login" in trimmed))
    quoted = fn("status='500'")
    out.append(_t("quotes and dashes remain literal inside one argument",
                  isinstance(quoted, list) and "status='500'" in quoted))

    for attack in ATTACKS:
        try:
            result = fn(attack)
            out.append(_t(f"metacharacter rejected: {attack[:26]}", result == [], f"got {result!r}"))
        except Exception as exc:
            out.append(_t(f"metacharacter rejected: {attack[:26]}", False, f"raised {type(exc).__name__}"))

    out.append(_t("empty term rejected", fn("   ") == []))
    out.append(_t("non-string rejected", fn(None) == []))
    out.append(_t("over-long term rejected", fn("a" * 200) == []))
    return out
