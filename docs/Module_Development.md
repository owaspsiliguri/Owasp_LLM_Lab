# Module Development

1. Create `backend/app/vulnerabilities/llmNN_name.py` with module-level vulnerable and secure functions and a class extending `VulnerabilityModule` (fill every metadata field).
2. Derive flags only with `flag_for(ID)`; never hardcode them. Use `derive()` for other per-install secrets.
3. Create `backend/app/fixit/<key>.py` with `FUNC_NAME`, `TITLE`, `BRIEF`, `STARTER` (vulnerable) and `run_tests(fn)` returning `{name, passed, detail}` dicts. Standard library only. Include benign-behaviour tests so over-blocking fails, and tests that reject superficial fixes (blocklists).
4. Register the instance in `vulnerabilities/__init__.py`.
5. Add the reference solution to `tests/backend/solutions.py` (reuse `inspect.getsource` of your secure function).
6. Tests: exploit works on vulnerable, fails on secure, starter fails Fix It, solution passes, weak fix fails, plus a case in `test_secure_paths_regression_matrix`.
7. Update `docs/LLM_Top_10_Mapping.md`, add a write-up in `docs/Vulnerability_Writeups/`, and the learning path in `frontend/src/pages/Paths.jsx`.
RAG modules use `vectorstore.scratch_collection()` and `vectorstore.query()`; keep rankings deterministic and assert them in tests. Simulated-resource modules must never consume real resources.
Responses may include `details` (key/value), `tables` ([{label, rows}]), `retrieved`, `quarantined`, `timeline`, `alerts` and `proof` (the flag shown on a successful exploit); the UI renders all of them generically.
Constraints: deterministic, local only, no real-world targets.
