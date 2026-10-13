# Architecture

| Service | Role |
|---------|------|
| frontend | React 18 + Tailwind SPA served by unprivileged nginx; proxies `/api` to the backend (on Vercel it calls the Render URL directly via `VITE_API_BASE`) |
| backend | FastAPI; module registry, run endpoints, flag check, Fix-It sandbox, session verification, Supabase writes |
| ollama | Local model runtime; `ollama-init` pulls `OLLAMA_MODEL` |
| chromadb | Vector DB (server mode, internal network only) used by LLM03 and LLM09; the backend waits for its health check |
| supabase | Optional cloud backend (deployed mode): Supabase Auth for sign-up/sign-in, Postgres tables `profiles`, `progress`, `attempts` guarded by row level security. Not part of the local compose stack. See [Deployment_Guide.md](Deployment_Guide.md). |

## Module contract
`backend/app/vulnerabilities/base.py` defines `VulnerabilityModule`: metadata (id, name, category, difficulty, objectives, hints, guided steps, challenge), `vulnerable_demo()`, `secure_demo()`, `validate_flag()`, `validate_fix()`. Lists `vulnerable_fns` / `secure_fns` are rendered with `inspect.getsource`, so the code shown to learners is the code that executes. Modules register in `vulnerabilities/__init__.py`.

## Request flow
UI → `POST /api/modules/{id}/{vulnerable|secure}` → (deployed mode: session token verified in `app/core/auth.py`) → module → engine (`simllm` or Ollama) → response with output, leak indicator and controls → (deployed mode: progress upserted in Supabase with the service role key).

## Fix It
UI → `POST /api/modules/{id}/fixit/validate` → AST policy check → subprocess `sandbox_harness.py` (resource-limited, stdin code) → `app/fixit/<key>.py::run_tests` replays attacks → per-test results. Fix-It specs import only the standard library.

## Vector store
`app/services/vectorstore.py` talks to the Chroma server when `CHROMA_URL` is set (Docker default) and otherwise to an embedded file-backed client under `LAB_DATA_DIR`. Embeddings are a deterministic hashed bag-of-words function computed locally (no model download, reproducible rankings). Each request creates a uniquely named scratch collection and deletes it afterwards, so poisoning in one run never affects another.

## Engines
`simllm` is a deterministic model of instruction-following behaviour (obeys directives in flat prompts, honours roles, answers from context, echoes content). It makes exploits and validation reproducible. Ollama exercises a real model; results there are probabilistic. LLM03 to LLM10 (except where noted) use the simulator only; these modules measure virtual resources or deterministic retrieval, which a probabilistic model would make unreliable to validate.

## Progress and accounts
Local mode: progress lives in the browser (`localStorage`); the backend is stateless apart from the generated lab secret.
Deployed mode: the frontend signs students in with Supabase Auth (login/signup pages, admin console at `/admin`) and mirrors progress to the `progress` table under row level security; the backend records `progress` and the unforgeable `attempts` audit trail only after it has re-validated a flag or fix itself. Both copies merge with OR semantics on sign-in, so nothing is lost offline.
