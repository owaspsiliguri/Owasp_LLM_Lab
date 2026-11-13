# Platform Upgrade Plan — Authentication, Courses, Scoring and UX

Status: **local implementation in progress**. Nothing in this plan has been deployed, committed or run against the production database.

## 1. Existing architecture (reviewed)

| Layer | Current implementation |
|---|---|
| Frontend | React 18 + Vite + Tailwind. React Router 6. Supabase JS is used **directly from the browser** for sign-in, profile reads and progress writes. |
| Backend | FastAPI, Pydantic, PyJWT, httpx, ChromaDB. Lab modules under `backend/app/vulnerabilities`; Fix-It sandbox under `backend/app/services`. |
| Auth | Supabase Auth (GoTrue). The browser stores the Supabase access/refresh token in `localStorage` through `@supabase/supabase-js`; the API accepts a Supabase bearer token and verifies it with the legacy JWT secret or the GoTrue `/auth/v1/user` endpoint. |
| Data | Supabase Postgres: `profiles`, `progress`, `attempts`, all protected by RLS. Progress writes come from the browser **as well as** the backend. |
| Courses | No course entity. Teaching content is code metadata plus compiled `labs/guided/*.md` rendered by a small in-house Markdown renderer. |
| Admin | A frontend route that reads Supabase directly. RLS is the only server-side control; there are no admin API routes. |
| Scoring | Client and server both compute `flag 100 + fix-it 150 + explored 10`. `explored` is awarded when the vulnerable lab is run. |
| Deployment | Docker Compose locally; Render (backend + static frontend) with Supabase in production. |

### Database objects reviewed

`public.profiles` (1:1 with `auth.users`), `public.progress` (PK `user_id, module_id`; booleans `explored`, `flag`, `fixit`), `public.attempts` (append-only audit), the `is_admin()` helper, profile-creation and role-protection triggers, and all RLS policies/grants in `supabase/schema.sql`.

**Production data was not read, copied or modified. No production credentials were available and none were invented.**

## 2. Security weaknesses found

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | Critical | Any signed-in user can write `progress.flag = true` and `progress.fixit = true` directly through PostgREST because the RLS policy `update progress` allows updating their own row. That is client-side score manipulation and flag farming. | Move all achievement writes behind the backend. Ship an additive SQL migration that revokes browser write grants and drops the browser write policies, leaving `select` for own rows and `service_role` for writes. Frontend no longer writes progress. |
| 2 | High | Supabase tokens are persisted in `localStorage`, readable by any XSS. | Replace browser Supabase auth with backend-mediated auth: short-lived JWT access token + rotating opaque refresh token in HttpOnly/Secure/SameSite cookies. No credentials in `localStorage`. |
| 3 | High | The Markdown renderer allows arbitrary link schemes, so a future untrusted document could inject `javascript:` links. | URL allow-list (`http`, `https`, `mailto`, relative), `rel="noopener noreferrer"` on external links, and server-side rejection/sanitisation of dangerous raw HTML and links. |
| 4 | High | No backend admin API; admin authorization exists only in the React route + Supabase RLS. Course management would be frontend-only. | New admin endpoints enforce `role == 'admin'` server-side on every request. Frontend hiding is only cosmetic. |
| 5 | Medium | JWT validation does not check issuer/audience for legacy HS256 tokens. | New tokens are signed HS256 with `iss`/`aud`/`exp`/`iat`/`jti`/`sid`, validated strictly. Legacy Supabase verification retained only as a compatibility path. |
| 6 | Medium | No refresh-token rotation, reuse detection or server-side session revocation. | Opaque refresh tokens stored as SHA-256 hashes, single-use rotation, reuse revokes the session family, logout revokes the session. |
| 7 | Medium | No CSRF protection (bearer-only today, but cookies need it). | Double-submit CSRF token, `SameSite=Lax`, Origin allow-list, custom header required on unsafe methods. |
| 8 | Medium | Rate limiting is global per IP only; login/flag endpoints need identity-aware limits. | Login/register/password-reset per IP+email limits; flag limit already per user. Bounded in-memory windows with documented multi-instance limitation. |
| 9 | Medium | Uploaded Markdown does not exist yet; naive implementation would permit path traversal, XSS, oversized files, YAML bombs. | Extension/MIME/size checks, strict UTF-8, strict YAML frontmatter schema, UUID storage keys, no filename use on disk, dangerous HTML/link rejection, no raw HTML rendering, 512 KiB limit. |
| 10 | Low | Backend CORS does not allow credentials, which the new cookie flow needs. | Explicit credentials-enabled CORS for the existing allowed origins only. |
| 11 | Low | Frontend HTML has no CSP of its own in dev; nginx has one in Docker. | Add a production-safe CSP/meta strategy and keep nginx headers; document Vercel header requirement. |

The intentionally vulnerable lab implementations under `backend/app/vulnerabilities/**` are **not** hardened; their vulnerabilities are the teaching material. Only the platform around them is changed.

## 3. Proposed implementation

### 3.1 Authentication (backend-owned)

New tables in the platform database (SQLite locally; additive migration for Supabase in production):

- `users` — `id`, `email` (unique, lower-case), `password_hash` (nullable for Supabase-provisioned accounts), `full_name`, `role`, `created_at`, `last_login_at`, `password_changed_at`.
- `sessions` — `id` (session/family), `user_id`, `refresh_hash` (unique), `created_at`, `expires_at`, `last_used_at`, `revoked_at`, `replaced_by`, `user_agent`, `ip_hash`.
- `auth_events` — audit of sign-in, sign-out, refresh reuse and admin actions (no passwords/tokens).

Token lifecycle:

- Access JWT: HS256, 15 minutes, `iss=owasp-llm-lab`, `aud=llm-lab-web`, `sub`, `role`, `sid`, `jti`; HttpOnly, Secure (configurable for local HTTP), SameSite=Lax cookie.
- Refresh token: 256-bit random opaque value, 30 days, stored only as SHA-256 hash, HttpOnly cookie scoped to `/api/auth`; rotated on every refresh. Reuse revokes the whole session family.
- CSRF: random token in a readable `llm_csrf` cookie, mirrored in `X-CSRF-Token` for every unsafe request.
- Logout revokes the session server-side and clears both cookies.

Provider bridge (preserves existing accounts):

- When Supabase is configured, `/api/auth/login` authenticates the same email/password against Supabase GoTrue server-side, provisions a local user with the **same UUID** (`sub`) so progress joins remain valid, mirrors the role from `profiles`, then issues our cookies and discards the Supabase tokens. Existing users keep their password and their account.
- `/api/auth/register` uses GoTrue signup when configured; otherwise it creates a local account with scrypt-hashed password.
- Password reset is proxied to Supabase when configured; local installs can change a password while signed in. No fake email delivery.
- Local development bootstraps an administrator from `ADMIN_EMAIL` + `ADMIN_PASSWORD` only on first startup; this is documented as a local/dev credential and is not a production account.

### 3.2 Progress and scoring

- New `GET /api/progress` (authenticated) returns the server's canonical progress plus server-computed score.
- Lab run/flag/fix-it continues to write progress server-side. Duplicate flag submissions are idempotent; points are derived from booleans, never from a client-supplied number.
- **Scoring changes**: `explored = 0`, `flag = 100`, `fixit = 150`; lab maximum becomes 250. `explored` remains as a historical/status bit, not a reward.
- Existing completion and score-bearing records are preserved. There is no score column to rewrite; leaderboard scores are computed. Historical exploration points therefore disappear from the displayed total (an expected consequence of the new rule), while completions stay intact. A `legacy_explored` count is exposed for transparency. Any optional freezing of old exploration points would be an explicit, separate migration.
- The production Supabase migration makes browser writes impossible, so client-side score manipulation is removed rather than merely hidden.

### 3.3 Courses

- `courses`: stable UUID `id`, unique `slug`, metadata, `status` (`draft`/`published`/`archived`), `source_markdown`, `checksum`, timestamps, `created_by`, `version`.
- `course_lessons`: derived from the document's `##` headings, ordered, stable UUIDs.
- `course_progress`: per-user completion of a course; never deleted when the course is edited. Deleting a course is a soft archive by default.
- Admin routes: list, upload/preview, edit metadata/content, publish/unpublish, archive. Public routes: published list/detail. All validation and parsing server-side.
- Storage: document text is stored in the database under a UUID key; the original client filename is never used as a path. This removes path traversal by construction. A 512 KiB limit applies.
- Frontend: `/courses` explorer and `/courses/:slug` reader; admin "Courses" tab with drag-and-drop upload, metadata form, preview, draft/publish controls, edit/replace, archive with confirmation.

### 3.4 Lab UX

- Challenge tab restructured into collapsible Scenario, Objective, Instructions, Target, Flag submission, Explanation and Remediation sections.
- Progressive hints remain server-validated and offer no points.
- Previous/next navigation uses the actual filtered sequence and shows position/completion.
- Replace the split result panels with a conventional in-page chat: chronological bubbles, timestamps, loading indicator, Enter to send, Shift+Enter newline, auto-scroll, duplicate-send guard, error bubbles, and optional "compare secure build" for the same payload. No fake assistant: every response comes from the existing `/modules/{id}/vulnerable` or `/secure` API and the real LLM/simulator backend.

### 3.5 Design and responsive work

- Re-token the palette to deep navy + restrained blue on soft neutral surfaces; keep the `>_` identity and dark theme support.
- Check 320/375/430/768/1024/1280/1440/1920 px in portrait and landscape; fix overflow, chat height, admin tables and the mobile nav.
- Keep the existing component system rather than replacing the app with a template.

## 4. Database changes and compatibility

All new tables are additive. No table is dropped, no user row is rewritten. The Supabase migration:

1. creates `courses`, `course_lessons`, `course_progress`, `platform_users` (mirror only if the deployment switches identity), `sessions`, `auth_events` only if those tables are not already present;
2. revokes `insert`, `update`, `delete` on `progress` from `authenticated` and drops the corresponding policies;
3. leaves all existing `profiles`, `progress` and `attempts` rows untouched;
4. is wrapped in a transaction where Supabase SQL Editor supports it.

A separate `scripts/backup_supabase.sh` documents `pg_dump` (schema + data) and a verification query; it is not executed automatically and never points at a production URL unless the operator supplies one.

Rollback: drop only the newly added tables/policies, restore the previous progress grants. Existing data is unaffected. The migration file documents the exact rollback.

## 5. Risks and compatibility notes

- Local installs now have real accounts; `AUTH_ALLOW_ANONYMOUS=1` preserves the old "open lab" behaviour for workshops.
- Supabase-provisioned users keep the same UUID, so `progress` and `attempts` joins survive. A user who has never signed in through the new backend is created on first login.
- Render's free filesystem is ephemeral: production auth sessions/courses must live in Supabase. The code prefers Supabase when configured and SQLite only for local/offline use.
- The score maximum changes from 260 to 250 per lab; dashboard and tests are updated. Historical `explored` bits are retained.
- The old frontend test suite mocks Supabase; it is being replaced with tests for the backend cookie/JWT flow and API mocks.
- ChromaDB and the real LLM providers remain optional. No provider key is fabricated; the simulator remains the fallback.

## 6. Verification checklist

- Auth: register, login, refresh rotation, reuse detection, logout revocation, expired/malformed JWT, CSRF rejection, protected route, admin role, session restoration.
- Courses: valid upload, invalid extension/MIME/UTF-8/size/frontmatter, XSS payload, `javascript:` link, preview, draft, publish, public visibility, edit, unpublish, archive, progress retained.
- Scoring: run = 0, hint = 0, wrong flag = 0, correct flag = +100 once, repeat = no extra, fix = +150 once; direct progress writes rejected in the production schema.
- Data: existing user IDs/completions unchanged; no duplicate completion rows; migration tested on a copy.
- Frontend: build, tests, lint, responsive spot checks, keyboard chat behaviour, navigation.

## 7. Local preview

Documented after implementation: backend `uvicorn` on `:8000`, Vite on `:5173`, local SQLite under `LAB_DATA_DIR`, `.env.local` with a generated dev `JWT_SECRET`, and an admin account created only in the local database.
