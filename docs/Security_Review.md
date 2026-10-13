# Security Review

Scope: the platform itself (not the intentional lab weaknesses). Performed on the source in this archive. Status of each item is stated honestly, including what was **not** done.

## Performed
| Activity | Tool / method | Result |
|---|---|---|
| Static analysis (Python) | `ruff` (E,F,I,B,UP,S), `bandit -ll` | Clean. Four bandit/ruff findings are intentional and annotated: lab SQL concatenation (2), sandbox `exec` of AST-checked code (1), dev default data dir (1). |
| Dependency scan (Python) | `pip-audit` on the full pinned set (`backend/constraints.txt`, 86 packages) | Starlette CVEs via the original FastAPI pin were **fixed** by pinning FastAPI 0.142.2 (starlette 1.7.0). Adding ChromaDB surfaced three advisories (PYSEC-2026-3813/3814/3815) in chromadb 0.5.23 with **no fixed release**: cross-tenant authorization, SimpleRBAC tenant checks, and `trust_remote_code` embedding models on the server. None applies to this lab (no tenants, no auth provider, local hash embeddings only) and the Chroma service is on an internal network with no published port. They are explicitly ignored in CI with this justification and must be revisited when a fix ships. |
| Dependency scan (JS) | `npm audit --omit=dev` | High-severity react-router/@remix-run findings **fixed** by pinning react-router-dom 6.30.6. Two moderate advisories remain in react-router 6.x (backslash open redirect in `<Link>`/`useNavigate`; SSR `deserializeErrors`). The app uses only static link targets and no SSR, so exposure is nil in this codebase; upgrading to v7 is a breaking change and is tracked as follow-up. CI fails on high severity. |
| Manual sandbox review | Adversarial probes of the Fix-It sandbox | **Two real bypass primitives found and fixed**: `string.Formatter.get_field` (arbitrary attribute traversal, reaching module globals) and `typing.get_type_hints` (string evaluation). Fix: allow-list reduced to `re, html, json, unicodedata, urllib.parse, sqlite3`; attributes `get_field, vformat, format_map, get_type_hints, load_extension, enable_load_extension` denied; string literals containing `__` denied. Regression tests added (`tests/backend/test_security.py`). |
| Authentication / authorization | Review | No authentication by design (single-user local lab, no real data). Mitigated by binding the only published port to 127.0.0.1. Documented in Security_Model.md. |
| Input validation | Review + tests | All bodies validated by pydantic with `extra=forbid` and length limits; unknown module and hint indexes return 404; variant/engine enumerations enforced; oversized code rejected. |
| Application security testing | Automated tests against the running ASGI app and a live uvicorn smoke test | Security headers present, CORS rejects unknown origins, rate limiter returns 429, flags absent from source and API payloads, secret file mode 0600. |
| Container configuration | Review of Dockerfiles and compose (automated by `tests/infra`) | Non-root users, read-only root filesystems, `cap_drop: ALL`, `no-new-privileges`, memory and PID limits, no published ports except frontend on loopback, no credentials in compose. |

| Vector store integration | Ran the full backend suite against a real Chroma HTTP server (client 0.5.23 to a server from an isolated environment mirroring the official image) as well as the embedded client | 100 backend tests pass in both modes. This also revealed that Chroma's in-memory SQLite is per-thread, so the embedded mode uses a file-backed client. |
| Simulation safety | Review | LLM04 and LLM06 compute virtual units only; burst size is validated to 1..100000, and the loop simulation has a hard iteration ceiling, so no request can consume real resources. |

| Tool-calling and supply-chain simulations | Review + tests | LLM05 never downloads or executes anything (hooks are reported strings); LLM07 mutates only a per-request in-memory copy of its state; LLM08 only inspects text. Inputs are length-limited and the LLM05 spec grammar is strictly validated. |

## Not performed (needs a Docker host / external tooling)
- Docker image builds, container health and the full stack were **not executed in the environment where this archive was produced** (no Docker daemon). Compose is validated structurally by tests only; CI builds and smoke-tests it.
- Container image scanning is wired into CI with Trivy (fail on fixable HIGH/CRITICAL) but could **not be run here**: its results on the final images are unknown until CI runs. `scripts/docker_smoke.sh` is likewise written but not executed here.
- No external penetration test. The manual testing above was limited to the sandbox and API.
- Behaviour against a real Ollama model was not exercised; the Ollama code path is covered by unit tests of failure handling only.

## Residual risks
Python-level sandboxing is defence in depth only; run the lab on localhost or an isolated VM. See Security_Model.md.
