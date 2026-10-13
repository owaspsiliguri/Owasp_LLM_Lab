"""Fix-It challenge for LLM09: answer only when grounded, otherwise abstain with confidence scoring."""
FUNC_NAME = "answer_or_abstain"
TITLE = "Ground the answer or abstain"
BRIEF = (
    "answer_or_abstain(candidates, threshold=0.6) receives dicts with value, source, authority (0..1), age_days and superseded. "
    "Ignore superseded candidates and any with weight 0. weight = authority * 0.5 ** (age_days / 730). Group candidates by value "
    "(case-insensitive, stripped); confidence = weight of the heaviest group / total weight, rounded to 3 decimals. "
    "Return {'answer': the value of the first candidate in the winning group, or None, 'confidence': float, "
    "'citations': [sources in the winning group, input order], 'abstained': bool}. "
    "Abstain (answer None, citations []) when nothing is eligible (confidence 0.0) or confidence < threshold."
)
STARTER = '''def answer_or_abstain(candidates, threshold=0.6):
    # VULNERABLE: returns the first candidate with full confidence, no citations, never abstains.
    if not candidates:
        return {"answer": "Unknown", "confidence": 1.0, "citations": [], "abstained": False}
    return {"answer": candidates[0]["value"], "confidence": 1.0, "citations": [], "abstained": False}
'''


def _c(value, source, authority=1.0, age=100, superseded=False):
    return {"value": value, "source": source, "authority": authority, "age_days": age, "superseded": superseded}


def _w(c):
    return c["authority"] * 0.5 ** (c["age_days"] / 730)


def _t(name, passed, detail=""):
    return {"name": name, "passed": bool(passed), "detail": detail}


def run_tests(fn):
    out = []

    def run(name, cands, expect_answer, expect_conf, expect_cites, threshold=None):
        try:
            got = fn(cands) if threshold is None else fn(cands, threshold)
            ok = (isinstance(got, dict) and got.get("answer") == expect_answer and abs(float(got.get("confidence", -1)) - expect_conf) <= 0.01
                  and got.get("citations") == expect_cites and got.get("abstained") is (expect_answer is None))
            detail = f"got {got!r}"
        except Exception as exc:
            ok, detail = False, f"raised {type(exc).__name__}"
        out.append(_t(name, ok, detail))

    run("single authoritative source is answered", [_c("10 Gbps", "ds-v3")], "10 Gbps", 1.0, ["ds-v3"])
    run("no candidates: abstain", [], None, 0.0, [])
    run("superseded documents are ignored", [_c("1 Gbps", "ds-v2", superseded=True), _c("10 Gbps", "ds-v3")], "10 Gbps", 1.0, ["ds-v3"])
    run("only superseded documents: abstain", [_c("1 Gbps", "ds-v2", superseded=True)], None, 0.0, [])
    a, b = _c("10 Gbps", "ds-v3", 1.0, 214), _c("2.5 Gbps", "forum", 0.3, 1096)
    run("authoritative source outweighs a weak dissent", [b, a], "10 Gbps", round(_w(a) / (_w(a) + _w(b)), 3), ["ds-v3"])
    run("strict threshold turns the same evidence into an abstention", [b, a], None, round(_w(a) / (_w(a) + _w(b)), 3), [], threshold=0.95)
    x, y = _c("4 Gbps", "ds", 0.9, 122), _c("2 Gbps", "partner", 0.9, 122)
    run("equal conflicting sources: abstain", [x, y], None, 0.5, [])
    run("agreeing sources are cited together and value case is ignored",
        [_c("10 Gbps", "a", 0.9, 100), _c("10 gbps ", "b", 0.8, 200), _c("1 Gbps", "c", 0.2, 900)], "10 Gbps",
        round((_w(_c("", "", 0.9, 100)) + _w(_c("", "", 0.8, 200))) / (_w(_c("", "", 0.9, 100)) + _w(_c("", "", 0.8, 200)) + _w(_c("", "", 0.2, 900))), 3),
        ["a", "b"])
    run("zero-authority candidates carry no weight", [_c("99 Gbps", "spam", 0.0, 10), _c("10 Gbps", "ds")], "10 Gbps", 1.0, ["ds"])
    return out
