"""Reference solutions are the repository's own secure implementations (single source of truth)."""
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
}
