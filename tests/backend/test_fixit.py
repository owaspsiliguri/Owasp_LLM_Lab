import pytest

from solutions import SOLUTIONS


def validate(client, mid, code):
    r = client.post(f"/api/modules/{mid}/fixit/validate", json={"code": code})
    assert r.status_code == 200
    return r.json()


@pytest.mark.parametrize("mid", ["llm01", "llm02", "llm10", "llm03", "llm04", "llm06", "llm09", "llm05", "llm07", "llm08"])
def test_starter_code_fails(client, mid):
    starter = client.get(f"/api/modules/{mid}").json()["fixit"]["starter_code"]
    res = validate(client, mid, starter)
    assert res["passed"] is False and any(not t["passed"] for t in res["tests"])


@pytest.mark.parametrize("mid", ["llm01", "llm02", "llm10", "llm03", "llm04", "llm06", "llm09", "llm05", "llm07", "llm08"])
def test_reference_solution_passes(client, mid):
    res = validate(client, mid, SOLUTIONS[mid])
    assert res["passed"] is True, res
    assert len(res["tests"]) >= 6


def test_blocklist_fix_does_not_pass_sql(client):
    weak = "def search_products(conn, category):\n    category = category.replace(\"'\", '')\n    return conn.execute(\"SELECT id, name, category, price FROM products WHERE category = '\" + category + \"'\").fetchall()\n"
    res = validate(client, "llm10", weak)
    assert res["passed"] is False  # breaks "Men's Gear" legitimate input / not a real fix


def test_partial_fix_reports_which_tests_fail(client):
    res = validate(client, "llm02", "import re\ndef redact(t):\n    return re.sub(r'\\d{3}-\\d{2}-\\d{4}', '[REDACTED]', t)\n")
    failed = [t["name"] for t in res["tests"] if not t["passed"]]
    assert res["passed"] is False and "redacts ssn" not in failed and "redacts key" in failed


WEAK = {
    "llm05": "def verify_artifact(name, version, source, content, lock):\n    return isinstance(lock, dict) and name in lock and source == 'registry.acme.test'\n",
    "llm07": "def authorize_tool_call(role, tool, args, user):\n    return 'deny' if tool in ('delete_ticket', 'send_email') else 'allow'\n",
    "llm08": "import re\ndef scan_diff(diff):\n    return ['eval-exec'] if isinstance(diff, str) and 'eval(' in diff else []\n",
    "llm03": "def verify_provenance(text, source, signature, key):\n    return isinstance(signature, str) and len(signature) == 64\n",
    "llm04": "def check_request(prompt, max_cost=2000):\n    return isinstance(prompt, str) and 0 < len(prompt) < 200\n",
    "llm06": "def enforce_budget(spent, request_tokens, budget):\n    ok = spent + request_tokens <= budget\n    return {'allowed': ok, 'remaining': max(budget - spent - request_tokens, 0), 'alerts': []}\n",
    "llm09": "def answer_or_abstain(candidates, threshold=0.6):\n    live = [c for c in candidates if not c['superseded']]\n    if not live:\n        return {'answer': None, 'confidence': 0.0, 'citations': [], 'abstained': True}\n    best = max(live, key=lambda c: c['authority'])\n    return {'answer': best['value'], 'confidence': 1.0, 'citations': [best['source']], 'abstained': False}\n",
}


@pytest.mark.parametrize("mid", sorted(WEAK))
def test_superficial_fixes_are_rejected(client, mid):
    res = validate(client, mid, WEAK[mid])
    assert res["passed"] is False and any(not t["passed"] for t in res["tests"])
