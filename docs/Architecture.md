# Architecture

| Service | Role |
|---------|------|
| frontend | React 18 + Tailwind SPA served by unprivileged nginx. Nginx proxies `/api` to the backend; on Vercel an `/api/:path*` rewrite provides the same same-origin behaviour. The browser never holds an access token or Supabase key. |
| backend | FastAPI; module registry, run endpoints, flag check, Fix-It sandbox, backend-owned cookie authentication, scoring, course API and admin API. |
| chromadb | Vector DB (server mode, internal network only) used by LLM03 and LLM09; the backend waits for its health check. |
| sqlite | Local/offline platform store (`platform.db`): users, refresh sessions, progress, attempts, courses and course completions. |
| supabase | Optional production store and identity provider: GoTrue password login, Postgres tables `profiles`, `progress`, `attempts`, `courses`, `course_lessons`, `course_progress`, `auth_sessions`, `auth_events`. Not part of the local compose stack. See [Deployment_Guide.md](Deployment_Guide.md). |

## Module contract
`backend/app/vulnerabilities/base.py` defines `VulnerabilityModule`: metadata (id, name, category, difficulty, objectives, hints, guided steps, challenge), `vulnerable_demo()`, `secure_demo()`, `validate_flag()`, `validate_fix()`. Lists `vulnerable_fns` / `secure_fns` are rendered with `inspect.getsource`, so the code shown to learners is the code that executes. Modules register in `vulnerabilities/__init__.py`; there are 22.

## Request flow
Authenticated browser → `POST /api/modules/{id}/{vulnerable|secure}` → cookie session resolved in `app/core/auth.py` (database-backed role/session checks) → module → engine (Gemini or Groq when a key is set, else `simllm`) → response with output, leak indicator and controls. A vulnerable run marks `explored` for the signed-in user but awards **0 points**. Flag and Fix-It routes validate server-side, then write progress/attempts through `platform_store`; the browser cannot submit a score.

Public content endpoints (`/api/health`, `/api/modules`, module detail, hints, published courses) stay readable before sign-in so the catalogue renders. Lab actions, progress, course completion and admin routes require a cookie session whenever an identity provider is configured.

## Authentication and scoring
The backend owns authentication. It issues a short-lived HS256 access JWT in an HttpOnly `llm_access` cookie and a rotating opaque refresh token in the HttpOnly `llm_refresh` cookie. A readable `llm_csrf` cookie is mirrored in `X-CSRF-Token` for state-changing requests. Refresh-token reuse, logout and password changes revoke the account's sessions. The historical Supabase bearer path remains only for API compatibility; the browser never uses it.

Flag = 100 points once, Fix-It = 150 points once, maximum 250 per lab. Explore/read/hint/nav/chat/ordinary payload = 0. The score is computed from server-side progress rows, not from a client value.

## Courses
Administrators upload or edit Markdown with YAML frontmatter in the Admin console. `course_service.py` validates the document, parses lessons and records a checksum; `platform_store` writes to SQLite locally or Supabase in production. Published courses and lessons are publicly readable; drafts and archived courses are admin-only. Deletion is a soft archive. The public `/api/courses` catalogue and `/api/courses/{slug}` detail are unauthenticated. `scripts/seed_courses.py` generates one deterministic companion course per lab (`llmXX-essentials`), idempotently and with an explicit `--allow-remote` guard.

## Fix It
UI → `POST /api/modules/{id}/fixit/validate` → AST policy check → subprocess `sandbox_harness.py` (resource-limited, stdin code) → `app/fixit/<key>.py::run_tests` replays attacks → per-test results. The deterministic tests decide pass/fail; the optional LLM judge only explains a failure. Fix-It specs import only the standard library.

## Vector store
`app/services/vectorstore.py` talks to the Chroma server when `CHROMA_URL` is set (Docker default) and otherwise to an embedded file-backed client under `LAB_DATA_DIR`. Embeddings are a deterministic hashed bag-of-words function computed locally (no model download, reproducible rankings). Each request creates a uniquely named scratch collection and deletes it afterwards, so poisoning in one run never affects another.

## Engines
Gemini and Groq are the only real engines and are chosen **server-side only** — the browser never sends an engine and there is no picker in the UI. LLM01 and LLM02 support real models; when a key is configured, those labs use it and an independent **judge** call (Groq preferred, else Gemini) assesses whether the output really leaked the secret. All other labs use `simllm`, a deterministic model of instruction-following behaviour (obeys directives in flat prompts, honours roles, answers from context, echoes content) that makes exploits and validation reproducible with no key at all. Asking for a real engine on a simulator-only lab returns 400. Sandbox tests stay authoritative for Fix-It.

## Progress and accounts
Local open mode: no accounts; progress is not persisted as a reward and the API holds no learner rows. Local authenticated mode: users, sessions, progress and attempts live in SQLite `platform.db`. Deployed mode: Supabase GoTrue authenticates the password, the backend mirrors the same UUID into its user table, and Postgres stores progress, attempts, sessions and courses. The browser reads progress from `/api/progress` and never writes it directly; RLS leaves progress SELECT-only for browser roles. Achievements are written only after a verified flag or Fix-It run. Course completion is a separate learner marker and carries no points.
