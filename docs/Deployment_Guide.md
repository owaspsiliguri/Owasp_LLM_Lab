# Deployment Guide — launch the lab online

This guide assumes you have **never deployed anything before**. Follow the parts in order.
Everything uses a free tier; no credit card is required. Total time: about 45–60 minutes.

## What goes where

| Service | Its job | The URL you get |
|---|---|---|
| **Supabase** | Postgres storage, optional GoTrue password login | `https://YOUR-PROJECT.supabase.co` |
| **Render** | The lab API (FastAPI backend, flag/Fix-It validation, auth cookies) | `https://YOUR-SERVICE.onrender.com` |
| **Vercel** | The website itself (React frontend) | `https://YOUR-APP.vercel.app` |

```text
Student's browser ──▶ Vercel (website + /api rewrite)
        │                  │
        │                  ▼
        │               Render (lab engine, auth cookies, scoring, sandbox)
        │                  │  service-role key (server only)
        ▼                  ▼
        └──────▶ Supabase (GoTrue login + Postgres data)
```

**Order:** A (Supabase) → B (Render) → C (Vercel) → D (connect + seed) → E (verify).

> **Cookie rule:** the API sets HttpOnly `SameSite=Lax` cookies. The browser must see the
> API as **same-origin** (Vercel `/api` rewrite) or **same-site** (custom domains under one
> registrable domain). A Vercel page calling `https://...onrender.com/api` directly will
> not send the cookies, even with `credentials: 'include'`. Part C sets this up.

## Before you start

1. A GitHub account, and this repository pushed to
   `https://github.com/owaspsiliguri/Owasp_LLM_Lab` (Render and Vercel read the code from
   GitHub).
2. An email address you can access.
3. ~60 minutes. Keep this guide open in a second tab.

> All three services periodically change their free-tier limits and dashboard layout. If a
> button is not exactly where this guide says, search the dashboard for the same name.

---

## Part A — Supabase: database and login (10 min)

1. Go to **https://supabase.com/dashboard** and sign up (GitHub login is easiest).
2. If you see **"Your organizations"** with an empty box, click **New organization**:
   - **Name:** `owasp-siliguri`
   - **Type:** *Personal* (free)
   - **Plan:** *Free*
   - Click **Create organization**.
3. Now click **New project** (top of the dashboard):
   - **Name:** `owasp-llm-lab`
   - **Database password:** click "Generate a password", copy it somewhere safe. You do not
     need it for this guide, but never lose it.
   - **Region:** pick the region closest to your students.
   - Click **Create new project** and wait ~2 minutes.
4. **Create the tables.** In the left menu open **SQL Editor** → **New query**. Delete any
   sample text, paste the *entire* contents of [`supabase/schema.sql`](../supabase/schema.sql),
   then click **Run** (or Ctrl+Enter). You should see **"Success. No rows returned"**.
   This creates `profiles`, `progress`, `attempts`, the security rules, and promotes the
   administrator address currently hardcoded in the schema.
5. **Apply the platform upgrade.** Open another SQL Editor query and run the entire contents
   of [`supabase/migrations/20261111_platform_upgrade.sql`](../supabase/migrations/20261111_platform_upgrade.sql).
   It is additive and idempotent: existing profiles, progress, attempts, lab IDs and
   completions are untouched. It:
   - makes browser progress writes impossible (the API writes achievements with the
     service role only),
   - adds `courses`, `course_lessons` and `course_progress`,
   - adds backend refresh sessions and the auth audit log.

   > If your project already had `schema.sql` applied, run only this migration. If you are
   > creating a fresh project, run `schema.sql` first and then the migration.
6. **Let students sign up instantly.** Left menu → **Authentication** → **Sign In / Providers**
   (older dashboard: **Providers → Email**) → turn **Confirm email** OFF → **Save**.
   Keep it ON only if you want every student to click a confirmation link first.
7. **Copy your keys.** Left menu → **Project Settings** (gear icon) → **API Keys** (plus the
   **API** / **JWT** section for the secret). Keep this table — you need it in Part B:

   | Dashboard value | Where you paste it | Secrecy |
   |---|---|---|
   | **Project URL** (`https://xxx.supabase.co`) | Render `SUPABASE_URL` | public |
   | **Publishable key** (new projects) or **anon key** (older projects) — starts `sb_publishable_` or `eyJ…` | Render `SUPABASE_ANON_KEY` | public |
   | **Secret key** (new projects) or **service_role key** (older) — starts `sb_secret_` | Render `SUPABASE_SERVICE_ROLE_KEY` only | **SECRET — never put it in Vercel or the browser** |
   | **JWT Secret** (only if your project shows one) | Render `SUPABASE_JWT_SECRET` (optional) | **SECRET** |

   > The backend verifies passwords against Supabase GoTrue **server-side**, then issues its
   > own HttpOnly cookie session. The browser never receives a Supabase token and never talks
   > to Supabase directly. `SUPABASE_JWT_SECRET` is only needed if an older API client still
   > sends a Supabase bearer token; the web app never does.

8. **The admin account:** the schema promotes the address currently hardcoded in
   `supabase/schema.sql` (currently `owaspsiliguri@gmail.com`). Set Render's `ADMIN_EMAIL`
   to the same address so the backend mirrors that role. Every other account is a **student**.
   To promote someone else later, run this in the SQL Editor:

   ```sql
   update public.profiles set role = 'admin' where lower(email) = 'someone@example.com';
   ```

   `ADMIN_PASSWORD` is **not** used when Supabase is configured; it only bootstraps a local
   SQLite administrator. The Supabase account keeps its own password.

---

## Part B — Render: the lab API (10 min)

1. Go to **https://render.com** → sign up with GitHub.
2. Dashboard → **New → Web Service**.
3. Connect GitHub → authorize Render → select **Owasp_LLM_Lab** → **Connect**.
4. Fill the create form:

   | Field | Value |
   |---|---|
   | Name | `owasp-llm-lab-api` |
   | Region | closest to your students |
   | Branch | `main` |
   | Runtime | **Python** (the repo's `backend/Dockerfile` works too — pick *Docker* and clear the commands if you prefer) |
   | Root directory | `backend` (under *Advanced* / *Build & Deploy* if you do not see it) |
   | Build command | `pip install -r requirements.txt` |
   | Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
   | Instance type | **Free** |

   *(Shortcut: Render → **New → Blueprint** → pick this repo → Apply deploys the same
   settings from `render.yaml`; you still add the environment variables below.)*

5. Add these **Environment** variables (Environment → Add Environment Variable):

   | Key | Value |
   |---|---|
   | `PYTHON_VERSION` | `3.12.7` (ChromaDB has no wheels for 3.13+) |
   | `JWT_SECRET` | **Required.** A long random string. Render's "Generate value" is fine. Without it, login returns 500 because the backend cannot sign its own session cookie |
   | `COOKIE_SECURE` | `1` (HTTPS; browsers will not send `Secure` cookies over HTTP) |
   | `ADMIN_EMAIL` | the administrator address, e.g. `owaspsiliguri@gmail.com` |
   | `SUPABASE_URL` | your Project URL from Part A.7 |
   | `SUPABASE_ANON_KEY` | the publishable/anon key from Part A.7 |
   | `SUPABASE_SERVICE_ROLE_KEY` | the secret/service key from Part A.7 |
   | `SUPABASE_JWT_SECRET` | optional — only for legacy bearer-token API clients; otherwise omit |
   | `LAB_SECRET` | any long random text, e.g. `my-lab-flags-never-change-9f3c…` (keeps flags stable across redeploys) |
   | `CORS_ORIGINS` | your frontend origin, e.g. `https://YOUR-APP.vercel.app` — exact origin, no trailing slash. Add a custom domain too if you use one |
   | `RATE_LIMIT_PER_MINUTE` | `120` |
   | `GROQ_API_KEY` | *optional* — from https://console.groq.com/keys |
   | `GEMINI_API_KEY` | *optional* — from https://aistudio.google.com/apikey |

   The two model keys are optional but recommended: with a key the chat labs answer with a
   real model **and** an independent LLM judge grades each run. Without them the built-in
   simulator keeps every lab playable, so you can add the keys later without redeploying
   code (just save the variable and let Render restart).

   > **Do not skip `JWT_SECRET`.** `SUPABASE_URL` + a Supabase key make `auth_configured()`
   > true, so the API advertises sign-in; `JWT_SECRET` is what actually signs the session.
   > A deployment with Supabase but no `JWT_SECRET` looks healthy but cannot log anyone in.

6. Click **Create Web Service**. First build takes 5–10 minutes (ChromaDB is a large
   package). When it finishes, open:

   ```text
   https://YOUR-SERVICE.onrender.com/api/health
   ```

   You should see JSON with `"modules": 22`, `"checks.database": {"status": "ok",
   "configured": true}`, and an `engines` object. If the service is still starting, wait a
   minute and retry. `"status": "degraded"` means the process is alive but a dependency
   (database or vector store) is unavailable; the `checks` object names it.

   > Render free services **sleep** after ~15 minutes without traffic; the first request
   > after that takes ~50 seconds or more. This is normal. The frontend waits up to
   > 120 seconds for that first response and shows "Waking up the backend. This may take
   > up to a minute." while it waits.

---

## Part C — Vercel: the website (5 min)

1. Go to **https://vercel.com** → sign up with GitHub → **Add New… → Project**.
2. Import **Owasp_LLM_Lab** → **Import**. Do **not** click Deploy yet.
3. Set the **Root Directory** to `frontend`
   (Settings → General → Root Directory; Vite is auto-detected as the framework).
4. **Add the same-origin API rewrite.** This is what makes cookie authentication work.
   `frontend/vercel.json` already contains the rewrite for the blueprint's default Render
   hostname (`owasp-llm-lab-api.onrender.com`). If your Render service has a different
   name, change the destination before deploying. The committed rule is:

   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://owasp-llm-lab-api.onrender.com/api/:path*"
       },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

   You can edit that file, or use Vercel → **Settings → Rewrites** with source
   `/api/:path*` and your own Render destination. The API rewrite must come **before** the
   SPA fallback. The browser then calls `/api/...` on the Vercel origin, Vercel forwards it
   to Render, and the cookies are set for the Vercel origin.

   > **Do not set `VITE_API_BASE` in Vercel.** The default is `/api`. Pointing the build at
   > `https://YOUR-SERVICE.onrender.com/api` would bypass the rewrite and break login on
   > modern browsers (third-party cookie blocking / `SameSite=Lax`).
   >
   > **Alternative:** use same-site custom domains, e.g. `https://lab.example.com` for the
   > frontend and `https://api.lab.example.com` for the API, with `VITE_API_BASE=https://api.lab.example.com/api`
   > and the exact frontend origin in `CORS_ORIGINS`. Subdomains of one registrable domain
   > are same-site, but the proxy approach is simpler and is the recommended default.

5. Add **Environment Variables** only if you need them:
   - No Supabase variables. The browser never talks to Supabase.
   - `VITE_API_BASE` — leave unset; it defaults to `/api`.
   - `VITE_PROXY_TARGET` — development only, not used by a Vercel build.

6. Click **Deploy**. After ~1 minute you get `https://YOUR-APP.vercel.app`.
   You should see the lab's **Sign in** page. If the site loads but API calls fail, check
   the rewrite destination and Part D.

---

## Part D — Connect Render to Vercel and seed the courses (5 min)

### CORS / origin allow-list

The API rejects cross-origin writes unless the browser's `Origin` is allowed. With the
Vercel rewrite, the browser still sends the Vercel origin to Render, so add it explicitly.

1. Render → **owasp-llm-lab-api** → **Environment** → edit `CORS_ORIGINS` so it contains
   your frontend origin:
   - correct: `https://YOUR-APP.vercel.app`
   - also correct for multiple origins: `https://YOUR-APP.vercel.app,https://lab.example.com`
   - wrong: a trailing slash, a bare hostname (no scheme), or spaces around commas
2. **Save** — Render redeploys automatically.

### Seed the 22 companion courses

The labs link to `/courses/llm01-essentials` … `/courses/llm22-essentials`. Create them
once against the production database. The script is idempotent: existing slugs are skipped,
so rerunning it will not duplicate rows or overwrite administrator edits.

From the repository root, in a terminal where the **production** Supabase values are set:

```bash
# Linux / macOS
export SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="YOUR-SERVICE-ROLE-KEY"
python scripts/seed_courses.py --allow-remote --dry-run   # validate without writing
python scripts/seed_courses.py --allow-remote             # create missing courses
```

```powershell
# Windows PowerShell
$env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "YOUR-SERVICE-ROLE-KEY"
python scripts/seed_courses.py --allow-remote --dry-run
python scripts/seed_courses.py --allow-remote
```

- Newly seeded courses are **published**, with six lessons each and the same metadata as
  the lab.
- `--allow-remote` is required whenever Supabase is configured, so a routine local command
  cannot silently publish to production.
- Do **not** add `--update` on the first run. Later, `--update` refreshes generated course
  source and lessons while preserving each course's status, publication time and learner
  completions.
- If your local `.env` points at a different project, check the target before confirming.
  The script prints every created/updated/skipped slug.

After seeding, open `https://YOUR-APP.vercel.app/courses` — you should see at least 22
courses.

---

## Part E — Verify everything end-to-end (10 min)

Open your Vercel URL in a private/incognito window and walk this checklist:

| # | Action | Expected result |
|---|---|---|
| 1 | Visit `/api/health` on the Render hostname | `"modules": 22` and `checks.database.status = "ok"` |
| 2 | Visit the site | You are redirected to **Sign in** |
| 3 | Click **Create an account**, register a test student | You land on the Dashboard; header shows the email and a **STUDENT** badge and **Sign out** |
| 4 | Open DevTools → Application → Local Storage | No Supabase token or auth token is stored. The session lives in HttpOnly cookies (`llm_access`, `llm_refresh`); `llm_csrf` is readable but is not a credential |
| 5 | Open **Labs → Prompt Injection → Exploit**, type anything, **Run vulnerable** | The exploit runs (no 401). **Progress** shows the lab as explored, but the score stays **0** for exploring |
| 6 | On a **Beginner** lab submit a wrong flag, then the right one (the *Guide* tab walks you through it) | *Failed* then *passed* rows appear in the admin attempts feed; badge turns to **Flag captured**; score becomes **100** |
| 7 | Pass the **Fix-It** on any lab | Score becomes **250** for that lab; `fixit = true` is stored server-side; the admin console updates after **Refresh** |
| 8 | Try reloading and submitting the same flag again | The flag is idempotent: still 100 points, no duplicate award, `already_completed` response |
| 9 | Open **Leaderboard** in a second account | Both students appear, ranked by server-computed score (flag 100 · fix-it 150 · explore 0) |
| 10 | Sign in as the administrator (`ADMIN_EMAIL`) | Header shows an **ADMIN** badge and an **Admin** nav item |
| 11 | Open **Admin → Courses** | At least 22 seeded courses; the Edit button opens the Markdown source, saving it keeps the publication status and increments the version |
| 12 | Open a lab and a learning path | The lab header links to its companion course; the path links to the same course; the public catalogue lists it |
| 13 | Sign out, close the tab, sign back in as the student | All progress and scores are still there (they live in Postgres, not the browser) |
| 14 | Resize the app to 320, 375, 430, 768, 1024, 1280, 1440 and 1920 px, portrait and landscape | Navigation, lab chat, code blocks, tables and dialogs remain usable without horizontal page scrolling |

If any row fails, jump to [Troubleshooting](#troubleshooting).

---

## Part F — Day-to-day operations

**Update the app** (after changing code):

```bash
git add -A
git commit -m "Describe your change"
git push
```

Vercel and Render both redeploy automatically on push (Render: service → *Settings →
Build & Deploy → Auto-Deploy* should be on, which is the default).

**Refresh the 22 generated courses** after changing lab metadata:

```bash
python scripts/seed_courses.py --allow-remote --update
```

This preserves status, publication time and learner completions. It does overwrite the
generated lesson text, so do not use `--update` on a course an administrator has edited by
hand unless that is the intent.

**Author a course:** Admin → Courses → Upload Markdown, or Edit an existing course. The
Markdown must start with YAML frontmatter (`title`, `slug`, `description`, `category`,
`difficulty`, `estimated_minutes`) and contain at least one `##` lesson. Uploads are
validated server-side; drafts are invisible in the public catalogue until published. Delete
is a soft archive, so progress records remain.

**Backups:** Supabase → Project Settings → **Database → Backups** (free tier keeps daily
backups for a limited time; export regularly if the data matters). The local SQLite file is
`platform.db` under `LAB_DATA_DIR`.

**Costs:** Supabase, Render and Vercel all have free tiers that fit a class. Two cautions:
Render free services **sleep** when idle, and Supabase free projects can be **paused**
after long inactivity — open the dashboard or upgrade if that happens. Check each service's
current pricing page before a big course.

**Promote/demote admins:** see the SQL snippet in Part A.8.

**Rotate `JWT_SECRET`:** every user is signed out and must sign in again. Progress, scores,
courses and completions are preserved. Rotate only when you intend to invalidate sessions.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Browser console: *blocked by CORS policy* | `CORS_ORIGINS` mismatch | Part D — exact origin, no trailing slash, save (redeploys) |
| Login appears to succeed but the next request is 401 | Cookies are not being sent because the frontend calls Render cross-site | Use the Vercel `/api` rewrite (Part C) or same-site custom domains; do not set `VITE_API_BASE` to the Render hostname |
| Browser refuses the cookie / login loop on HTTPS | `COOKIE_SECURE=0` on an HTTPS deployment, or the reverse on local HTTP | Set `COOKIE_SECURE=1` on HTTPS; use `0` only for `http://localhost` |
| `500` on `/api/auth/login` and Render logs `JWT_SECRET is not configured` | Missing `JWT_SECRET` | Set it in Render, save, retry |
| `403 Missing or invalid CSRF token` | The browser has no `llm_csrf` cookie, the header was stripped by a proxy, or the page was loaded before cookies were set | Reload the page; confirm the API and frontend are same-origin; check that `X-CSRF-Token` reaches Render |
| `Cannot verify your session: the auth service is unreachable` (503) | Backend cannot reach Supabase GoTrue | Check `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and the Supabase status page |
| *Invalid login credentials* on a correct password | Account created before email confirmation was disabled, or the Supabase project was paused | Finish the confirmation email, or re-enable the account; check the Supabase dashboard |
| No **Admin** nav item when signed in as the administrator | `ADMIN_EMAIL` does not match the account, or `profiles.role` is not `admin` | Set `ADMIN_EMAIL` to the same lower-case address; run the Part A.8 SQL; sign out and back in |
| Admin console shows *Could not load admin data* | Missing/wrong `SUPABASE_SERVICE_ROLE_KEY`, or the migration was not applied | Re-run the migration; use the service-role key on Render only |
| `relation "public.courses" does not exist` / course pages 500 | The platform migration was never applied | Run `supabase/migrations/20261111_platform_upgrade.sql` |
| Course edit returns `409` | The edited frontmatter changes the slug to one another course already uses | Keep the original `slug` or choose a unique one |
| Lab companion links return 404 | Courses were not seeded in this database | Run the seed command in Part D with `--allow-remote` |
| Seeder says *Refusing to write to the remote database* | `--allow-remote` was not passed | Verify the target, then pass `--allow-remote` |
| Progress is not saved after a flag/fix | Not signed in, `JWT_SECRET` missing, or the Supabase service-role key is missing/wrong | Check `/api/auth/config`, the Render env, and the `attempts` table |
| Health says `degraded` | Chroma or the database check failed | Read `checks.database` / `checks.vector_store`; for Chroma set `CHROMA_URL` to an external server or upgrade the Render instance |
| Labs LLM03 / LLM09 return 503 or the service restarts | ChromaDB (RAG labs) is memory-hungry on the free instance | Set `CHROMA_URL` to an external Chroma server, or upgrade the Render instance |
| Labs return 503 mentioning Groq or Gemini | Key set on Render but wrong, revoked or rate-limited | Re-copy the key from console.groq.com/keys or aistudio.google.com/apikey, save (redeploys) |
| Labs answer instantly and never mention a judge | No model key configured | Expected: the built-in simulator runs without any key |
| Flags changed after a redeploy | `LAB_SECRET` was not set | Set it (Part B); already-captured flags stay valid per installation only |
| Vercel shows an old version | Cached build, or a stale `VITE_API_BASE` | Deployments → select latest → Redeploy; remove `VITE_API_BASE` and redeploy |
| Render free instance takes ~50 seconds to answer | It was asleep | Normal; the frontend shows the cold-start message and retries |
| `Waking up the backend` then a timeout error | Render instance is still starting, or the free service is suspended after exhausting its monthly hours | Wait and retry once; open the Render dashboard and check the service status |

---

## Running the same stack locally

**Without login (fastest):**

```bash
cp .env.example .env
docker compose up --build     # open http://localhost:8080
```

With no `JWT_SECRET`, the API runs open, single-user, with local SQLite. This mode is for
localhost only and must not be exposed to a network.

**With local backend-owned login:**

```bash
# .env
JWT_SECRET=<a long random value>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<a password you keep>
COOKIE_SECURE=0
```

```bash
docker compose up -d --build
```

The backend creates the administrator once in `platform.db`; it never resets an existing
password. Students can sign up from the UI. All progress and scores are server-side.

**Without Docker (development):**

```bash
# terminal 1, from backend/
uvicorn app.main:app --host 127.0.0.1 --port 8000

# terminal 2, from frontend/
npm ci
npm run dev -- --host 127.0.0.1       # open http://127.0.0.1:5173
```

Vite proxies `/api` to `http://127.0.0.1:8000` by default. Set `VITE_PROXY_TARGET` to use a
different backend. On Windows the proxy deliberately uses the IPv4 literal because
`localhost` can resolve to `::1`.

**Run the tests:**

```bash
# repository root, with the virtualenv active
pytest -q tests/backend
cd frontend && npm test -- --run && npm run lint && npm run build
```

The backend suite runs on Linux, macOS and Windows. The tests isolate themselves from a
developer `.env` (they pin open test mode), so they do not need a database or model key.

**Seed the local courses:**

```bash
python scripts/seed_courses.py            # SQLite platform.db, no remote writes
python scripts/seed_courses.py --dry-run  # validate only
```

**Do not point a local development process at production.** If `SUPABASE_URL` and a key are
present, the storage layer uses Supabase; `--allow-remote` is the explicit guard for the
seeder, not for the API. Use a separate Supabase project for testing.
