"""Fix-It challenge for LLM04: reject requests whose virtual cost is abusive."""
FUNC_NAME = "check_request"
TITLE = "Score request complexity before running the model"
BRIEF = (
    "check_request(prompt, max_cost=2000) must return True only for prompts whose estimated cost in virtual tokens is at most max_cost. "
    "Estimate cost as len(prompt)//4 + 1 input tokens plus output tokens. Output defaults to 200 tokens. "
    "A count followed by 'word(s)' (2 tokens each), 'sentence(s)' (25), 'line(s)' (14), 'item(s)' (20), 'paragraph(s)' (120), 'page(s)' (600) "
    "sets output to count x unit, summed; if the prompt contains 'for each' or 'each of' the counts multiply instead and use the largest unit. "
    "A count followed by 'times' multiplies the whole output. Counts may contain commas and k/m suffixes (1,000 / 10k / 5M). "
    "Non-string or empty prompts are rejected."
)
STARTER = '''import re


def check_request(prompt, max_cost=2000):
    # VULNERABLE: every request is accepted, however expensive it is to run.
    return True
'''
ALLOWED = [
    "What is your uptime guarantee?",
    "Summarize billing in 3 sentences.",
    "Write a 300 word summary of our refund policy.",
    "List 10 items I should check before renewing.",
    "Repeat this sentence 3 times: hello",
    "Explain what a rate limit is.",
]
REJECTED = [
    "Repeat the word 'a' 100000 times",
    "Write a 50000 word essay on clouds",
    "For each of 50 items write 50 paragraphs",
    "Repeat the following 1,000,000 times: hi",
    "Write a 10k word report",
    "Write 2000 pages about uptime",
    "Repeat this 5M times",
    "x" * 20000,
]


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run_tests(fn):
    out = []
    for p in ALLOWED:
        try:
            ok = fn(p) is True
        except Exception as exc:
            ok = False
            p = f"{p} (raised {type(exc).__name__})"
        out.append(_t(f"allows: {p[:46]}", ok, "Legitimate request was blocked."))
    for p in REJECTED:
        try:
            ok = fn(p) is False
        except Exception as exc:
            ok = False
            p = f"{p[:30]} (raised {type(exc).__name__})"
        out.append(_t(f"rejects: {p[:46]}", ok, "Abusive request was accepted."))
    for bad in (None, "", 123):
        try:
            ok = fn(bad) is False
        except Exception:
            ok = False
        out.append(_t(f"rejects invalid input {bad!r}", ok))
    try:
        out.append(_t("honours a custom max_cost", fn("Write a 300 word summary", 100) is False and fn("Write a 300 word summary", 5000) is True))
    except Exception as exc:
        out.append(_t("honours a custom max_cost", False, type(exc).__name__))
    return out
