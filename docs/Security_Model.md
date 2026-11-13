# Security Model

## Trust boundaries
Learner browser → frontend → FastAPI → local SQLite or Supabase/ChromaDB. There are three
deployment shapes:

- **Open local mode** (default when no identity provider is configured): single-user, no
  authentication because it holds no real data. It must not be exposed beyond localhost
  (compose binds 127.0.0.1).
- **Local authenticated mode** (`JWT_SECRET` set, no Supabase): accounts and progress live in
  the backend's SQLite `platform.db`. The API requires a backend-issued cookie session for
  lab actions, progress, course completion and admin routes. Content endpoints (health,
  module metadata, hints) stay public so the catalogue renders before sign-in.
- **Deployed mode** (Supabase configured; see [Deployment_Guide.md](Deployment_Guide.md)):
  browser (Vercel) → same-origin `/api` rewrite → API (Render) → Supabase Postgres/GoTrue
  and the model providers. The browser never talks to Supabase directly and never holds a
  Supabase key or token.

A deployment that sets `AUTH_REQUIRED=0` explicitly can still run open even when an identity
provider is configured. That is a deliberate operator override, not a fallback: the default
is required authentication whenever an identity provider exists.

## Authentication (authenticated and deployed modes)
- The API issues its own **HS256 access JWT** (15 minutes by default) in the HttpOnly
  `llm_access` cookie. Claims include `sub`, `email`, `role`, `name`, `sid`, `jti`, `iat`,
  `exp`, `iss` and `aud`; issuer and audience are validated strictly.
- A second **opaque refresh token** (30 days by default) travels in the HttpOnly
  `llm_refresh` cookie scoped to `/api/auth`. Only its SHA-256 hash is stored. Each refresh
  rotates the token and marks the old session row replaced.
- Presenting a rotated, revoked or logged-out refresh token is treated as **reuse**: every
  active session for that account is revoked and an `auth_events` record is written.
  Logout and password changes also revoke all sessions. Access tokens carry the session id,
  so a revoked session stops working immediately rather than waiting for JWT expiry.
- **CSRF:** a readable `llm_csrf` cookie is mirrored in the `X-CSRF-Token` header on
  state-changing requests (double submit). The middleware also rejects a browser `Origin`
  that is not in the CORS allow-list. Login, registration, refresh and password-reset are
  origin-checked but exempt from the pre-existing CSRF pair because no session exists yet.
- Cookies are `SameSite=Lax`; `Secure` is controlled by `COOKIE_SECURE` and must be enabled
  on HTTPS. Cookie authentication therefore requires a **same-origin** frontend/API pair
  (Vercel `/api` rewrite) or **same-site** custom domains. A cross-site browser fetch will
  not send the cookies.
- Login and registration are rate-limited per client IP. Login failures use one generic
  message so the API does not disclose whether an address exists.

### Supabase federation (deployed mode)
- When Supabase is configured, `/api/auth/login` and `/api/auth/register` call GoTrue
  **server-side**. The backend mirrors the Supabase user with the **same UUID** (`sub`) so
  existing `progress` and `attempts` joins survive. It reads the canonical role from
  `profiles`, applies `ADMIN_EMAIL` as a second admin signal, then issues its own cookies and
  discards the Supabase tokens.
- Existing Supabase passwords and accounts are unchanged. `SUPABASE_JWT_SECRET` and the
  legacy bearer-token verification path exist only for older API clients; the web app never
  sends a bearer token and never stores one in `localStorage`.
- `SUPABASE_SERVICE_ROLE_KEY` exists only in the backend environment. The browser never sees
  it.

## Authorisation and data
- `AdminUser` re-checks the role in the database on every admin request; a role downgrade is
  effective immediately. Hiding a frontend button is never the control. The admin API covers
  the roster/audit overview and Markdown course authoring.
- Progress, attempts and scoring are **server-authoritative**. The API writes an achievement
  only after it validates the flag (HMAC, constant-time comparison) or the Fix-It submission
  (sandbox replay). The browser cannot POST a score, a boolean or an arbitrary progress row.
- In Supabase, the platform migration revokes browser INSERT/UPDATE/DELETE on `progress`,
  keeps SELECT for the learner/admin, and gives write access only to the service role.
  `courses`, `course_lessons` and `course_progress` are read-only to browser roles; writes go
  through the admin or completion API. `auth_sessions` and `auth_events` have no browser
  grants or policies at all.
- Local SQLite contains the same logical records (`users`, `sessions`, `progress`, `attempts`,
  `courses`, `course_lessons`, `course_progress`, `auth_events`). It is a single-instance
  local store, not a horizontally scalable production database.
- Course completion is a learner-owned marker, not a scored achievement; a signed-in learner
  can mark their own course complete. Lab scores still require server-verified flag/Fix-It
  evidence.

## Scoring
- Flag capture: **100 points**, once per lab.
- Fix-It validation: **150 points**, once per lab.
- Maximum: **250 points per lab**, 5,500 across the 22 labs.
- Explore, reading, hints, navigation, chat turns and ordinary payload attempts award **0**.
- Duplicate submissions are idempotent: a second correct flag or passing Fix-It does not
  increase the score or create a second award.

## Course authoring
- Administrators upload Markdown files with YAML frontmatter or edit the source in the admin
  console. The server validates size (512 KiB default), UTF-8, frontmatter fields, slug
  uniqueness, difficulty, duration and at least one lesson; it never executes course content.
- Courses are drafts until explicitly published. Delete is a soft archive (`deleted_at`), so
  existing course progress and audit history are preserved. Replacing or editing source
  preserves status and publication time unless the status is changed explicitly.
- The frontend renders Markdown as React elements, never raw HTML. Link schemes are validated
  on the client and server. This keeps administrator-authored content from becoming an XSS
  vector.

## Controls
Strict pydantic validation (extra fields forbidden, length limits); security headers on API
and nginx; per-IP rate limiting; CORS allow-list plus CSRF origin check; non-root, read-only,
capability-dropped containers with memory and PID limits; no host ports for backend or
ChromaDB; pinned dependencies; HMAC-derived flags stored in a mode-0600 secret file or
`LAB_SECRET`; no outbound requests except to the configured ChromaDB URL, Supabase, and the
Groq/Gemini APIs when a key is set; ChromaDB telemetry disabled; every RAG request uses a
throwaway collection.

## Fix-It sandbox
Learner code is (1) AST-checked: import allow-list (`re`, `html`, `json`, `unicodedata`,
`urllib.parse`, `sqlite3`, `hmac`, `hashlib`, `math`), banned builtins (`eval`, `exec`,
`open`, `getattr`, ...), no dunder or traversal attributes, no string literals containing
`__`, 8000-character cap; (2) run in a separate Python process with `-E -s`, empty
environment, `RLIMIT_CPU` 5 s, `RLIMIT_AS` 512 MB, `RLIMIT_FSIZE` 1 MB, new session,
wall-clock timeout; (3) inside the read-only, non-root, capability-less backend container.

## ChromaDB
The Chroma service has no authentication and no published port; it is reachable only from the
backend on the internal Compose network. Chroma's published advisories (cross-tenant
authorization, RBAC, `trust_remote_code` embedding models) do not apply because the lab uses
no tenants, no auth provider and no remote-code embedding models, but they have no fixed
release yet, so do not expose the service.

## Known limitations
- Python-level sandboxing is defence in depth, not a proof of isolation. Treat the backend
  container as the boundary and do not run the lab on a shared or internet-facing host.
- The rate limiter is in-process and per replica. A multi-instance deployment needs a shared
  limiter (for example Redis) for a global limit.
- Per-process memory limits do not bound a regex denial of service beyond the CPU and
  wall-clock limits (which do terminate it).
- The simulator models model behaviour; real models are less predictable, and role
  separation alone does not make a real model immune to injection. The judge is advisory for
  real-model leakage and Fix-It feedback; deterministic sandbox tests remain authoritative
  for Fix-It.
- Supabase login depends on GoTrue being reachable; the API returns 503 rather than failing
  open. Local SQLite mode has no email delivery, so password reset is a no-op message.
- The production Supabase migration is additive and idempotent but must be applied by the
  operator. This repository cannot apply it without production credentials.
- Cookies require the same-origin/same-site deployment described above. A split-site
  frontend/API deployment without a proxy will fail authentication even if CORS is correct.
- `LAB_SECRET` must be stable across redeploys or flags change. Existing award rows remain,
  but a previously captured flag string may no longer validate in a new installation.
- On Render/Vercel the sandbox runs without the local compose hardening (read-only rootfs,
  dropped capabilities, memory/PID limits); the AST policy, rlimits and wall-clock timeout
  still apply.
