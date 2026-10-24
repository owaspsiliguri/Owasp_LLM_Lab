# Security Model

## Trust boundaries
Learner browser → nginx → FastAPI. The deployment has two modes:

- **Local mode** (default; no Supabase configured): single-user, no authentication because it holds no real data. It must not be exposed beyond localhost (compose binds 127.0.0.1).
- **Deployed mode** (Supabase configured; see [Deployment_Guide.md](Deployment_Guide.md)): browser (Vercel) → API (Render) → Supabase. The API refuses lab actions (`vulnerable`, `secure`, `flag`, `fixit/validate`) without a valid Supabase session token; content endpoints (health, module metadata, hints) stay public so the site renders before sign-in. With Supabase unset the API stays in local mode, so a half-configured deployment fails visibly rather than silently.

### Authentication (deployed mode)
- Access tokens are verified two ways: locally (HS256, `SUPABASE_JWT_SECRET`, legacy projects) or against the project's own `/auth/v1/user` endpoint with a bounded in-memory cache (asymmetric JWT signing keys, current projects). Verification never fails open: missing/invalid token → 401, auth service unreachable → 503.
- Progress and the `attempts` audit trail are written with the **server-only** service role key *after the server re-validates the flag (HMAC) or the fix (sandbox run)*; the browser can never write `attempts`.
- Row Level Security on every table: students read and write only their own rows; `is_admin()` grants the admin console read access to all; a trigger makes `profiles.role` changeable by administrators only; profiles are created solely by an `auth.users` trigger. The admin address is fixed in `supabase/schema.sql` (`owaspsiliguri@gmail.com`).
- The browser only ever sees the publishable/anon key; the service role key exists solely in Render environment variables. `CORS_ORIGINS` restricts which UI may call the API.

## Controls
Strict pydantic validation (extra fields forbidden, length limits); security headers on API and nginx; per-IP rate limiting; CORS allow-list; non-root, read-only, capability-dropped containers with memory and PID limits; no host ports for backend or ChromaDB; pinned dependencies; HMAC-derived flags stored in a mode-0600 secret file or `LAB_SECRET`; no outbound requests except to the configured ChromaDB URL and, when a key is set, the Groq and Gemini APIs; ChromaDB telemetry disabled; every RAG request uses a throwaway collection.

## Fix-It sandbox
Learner code is (1) AST-checked: import allow-list (`re`, `html`, `json`, `unicodedata`, `urllib.parse`, `sqlite3`, `hmac`, `hashlib`, `math`), banned builtins (`eval`, `exec`, `open`, `getattr`, ...), no dunder or traversal attributes, no string literals containing `__`, 8000-character cap; (2) run in a separate Python process with `-E -s`, empty environment, `RLIMIT_CPU` 5 s, `RLIMIT_AS` 512 MB, `RLIMIT_FSIZE` 1 MB, new session, wall-clock timeout; (3) inside the read-only, non-root, capability-less backend container.

## ChromaDB
The Chroma service has no authentication and no published port; it is reachable only from the backend on the internal Compose network. Chroma's published advisories (cross-tenant authorization, RBAC, `trust_remote_code` embedding models) do not apply because the lab uses no tenants, no auth provider and no remote-code embedding models, but they have no fixed release yet, so do not expose the service.

## Known limitations
- Python-level sandboxing is defence in depth, not a proof of isolation. Treat the backend container as the boundary and do not run the lab on a shared or internet-facing host.
- The rate limiter is in-process and per replica.
- Per-process memory limits do not bound a regex denial of service beyond the CPU and wall-clock limits (which do terminate it).
- The simulator models model behaviour; real models are less predictable, and role separation alone does not make a real model immune to injection.
- In deployed mode, `progress` rows belong to the learner under RLS, so a determined student can edit their *own* progress without doing the lab. The `attempts` audit trail cannot be forged (backend-written only); judge completion from the admin console's attempts feed where it matters.
- On Render/Vercel the sandbox runs without the local compose hardening (read-only rootfs, dropped capabilities, memory/PID limits); the AST policy, rlimits and wall-clock timeout still apply.
