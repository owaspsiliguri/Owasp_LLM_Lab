# Deployment Guide — launch the lab online

This guide assumes you have **never deployed anything before**. Follow the parts in order.
Everything uses a free tier; no credit card is required. Total time: about 45–60 minutes.

## What goes where

| Service | Its job | The URL you get |
|---|---|---|
| **Supabase** | Database + login system (accounts, progress, admin console) | `https://YOUR-PROJECT.supabase.co` |
| **Render** | The lab API (FastAPI backend) | `https://YOUR-SERVICE.onrender.com` |
| **Vercel** | The website itself (React frontend) | `https://YOUR-APP.vercel.app` |

```
Student's browser ──▶ Vercel (website)
        │                  │  API calls (with login token)
        │                  ▼
        │               Render (lab engine, validates flags and fixes)
        │                  │  service-role key (server only)
        ▼                  ▼
        └──────▶ Supabase (accounts, progress, attempts)
```

**Order:** A (Supabase) → B (Render) → C (Vercel) → D (connect) → E (verify).

## Before you start

1. A GitHub account, and this repository pushed to
   `https://github.com/owaspsiliguri/Owasp_LLM_Lab` (if you have not pushed yet, do that
   first — Render and Vercel read the code from GitHub).
2. An email address you can access.
3. ~60 minutes. Keep this guide open in a second tab.

> All three services periodically change their free-tier limits and dashboard layout. If a
> button is not exactly where this guide says, search the dashboard for the same name.

---

## Part A — Supabase: database and login (10 min)

1. Go to **https://supabase.com/dashboard** and sign up (GitHub login is easiest).
2. Click **New project**:
   - **Name:** `owasp-llm-lab`
   - **Database password:** click “Generate a password”, copy it somewhere safe. You do not
     need it for this guide, but never lose it.
   - **Region:** pick the region closest to your students.
   - Click **Create new project** and wait ~2 minutes.
3. **Create the tables.** In the left menu open **SQL Editor** → **New query**. Delete any
   sample text, paste the *entire* contents of [`supabase/schema.sql`](../supabase/schema.sql),
   then click **Run** (or Ctrl+Enter). You should see **“Success. No rows returned”**.
   This creates `profiles`, `progress`, `attempts`, the security rules, and makes
   **owaspsiliguri@gmail.com** an administrator the moment that account signs up.
4. **Let students sign up instantly.** Left menu → **Authentication** → **Sign In / Providers**
   (older dashboard: **Providers → Email**) → turn **Confirm email** OFF → **Save**.
   Keep it ON only if you want every student to click a confirmation link first.
5. **Copy your keys.** Left menu → **Project Settings** (gear icon) → **API Keys** (plus the
   **API** / **JWT** section for the secret). Keep this table — you need it in Parts B and C:

   | Dashboard value | Where you paste it | Secrecy |
   |---|---|---|
   | **Project URL** (`https://xxx.supabase.co`) | Render `SUPABASE_URL` **and** Vercel `VITE_SUPABASE_URL` | public |
   | **Publishable key** (new projects) or **anon key** (older projects) — starts `sb_publishable_` or `eyJ…` | Vercel `VITE_SUPABASE_ANON_KEY` only | public |
   | **Secret key** (new projects) or **service_role key** (older) — starts `sb_secret_` | Render `SUPABASE_SERVICE_ROLE_KEY` only | **SECRET — never put it in Vercel or the browser** |
   | **JWT Secret** (only if your project shows one) | Render `SUPABASE_JWT_SECRET` (optional) | **SECRET** |

   > If your project has a **JWT Secret**, the backend verifies sessions with it locally.
   > If it does not (new projects use asymmetric *JWT signing keys*), leave
   > `SUPABASE_JWT_SECRET` empty — the backend automatically validates sessions against
   > your project URL instead. Either way works.

6. **The admin account:** you will sign up with `owaspsiliguri@gmail.com` in Part E. The
   schema automatically gives that address the **admin** role; every other account is a
   **student**. To promote someone else later, run this in the SQL Editor:

   ```sql
   update public.profiles set role = 'admin' where lower(email) = 'someone@example.com';
   ```

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
   | `SUPABASE_URL` | your Project URL from Part A.5 |
   | `SUPABASE_SERVICE_ROLE_KEY` | the secret/service key from Part A.5 |
   | `SUPABASE_JWT_SECRET` | only if your project showed one; otherwise omit |
   | `LAB_SECRET` | any long random text, e.g. `my-lab-flags-never-change-9f3c…` (keeps flags stable across redeploys) |
   | `CORS_ORIGINS` | `https://YOUR-APP.vercel.app` — a placeholder for now; fix it exactly in Part D |
   | `RATE_LIMIT_PER_MINUTE` | `120` |

   Leaving all `SUPABASE_*` values out is also valid: the API then runs in **local mode**
   (labs open to everyone, progress only in the browser). With them set, the API **requires
   login** and records achievements server-side.
6. Click **Create Web Service**. First build takes 5–10 minutes (ChromaDB is a large
   package). When it finishes, open:

   ```
   https://owasp-llm-lab-api.onrender.com/api/health
   ```

   You should see JSON like `{"status":"ok","modules":10,…}`. That means the API is live.

   > Render free services **sleep** after ~15 minutes without traffic; the first request
   > after that takes ~50 seconds. This is normal.

---

## Part C — Vercel: the website (5 min)

1. Go to **https://vercel.com** → sign up with GitHub → **Add New… → Project**.
2. Import **Owasp_LLM_Lab** → **Import**. Do **not** click Deploy yet.
3. Set the **Root Directory** to `frontend`
   (Settings → General → Root Directory; Vite is auto-detected as the framework).
4. Add **Environment Variables** (Settings → Environment Variables, or the section on the
   import screen):

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Project URL (same as Part A.5) |
   | `VITE_SUPABASE_ANON_KEY` | the **publishable/anon** key (browser-safe) |
   | `VITE_API_BASE` | `https://owasp-llm-lab-api.onrender.com/api` |
   | `VITE_GUIDE_BASE` | `https://github.com/owaspsiliguri/Owasp_LLM_Lab/blob/main` (optional — where lab guides live) |

5. Click **Deploy**. After ~1 minute you get `https://YOUR-APP.vercel.app`.
   You should now see the lab's **Sign in** page (the app only asks for login when
   `VITE_SUPABASE_*` is set — without them it runs in local mode).

---

## Part D — Connect Render back to Vercel (2 min)

CORS tells the API which website may talk to it.

1. Render → **owasp-llm-lab-api** → **Environment** → edit `CORS_ORIGINS` so it is
   **exactly** your Vercel URL: `https://YOUR-APP.vercel.app`
   - correct: `https://my-app.vercel.app`
   - wrong: `https://my-app.vercel.app/` (no trailing slash), `my-app.vercel.app` (no scheme),
     or a list with a space after the comma
2. **Save** — Render redeploys automatically.

---

## Part E — Verify everything end-to-end (10 min)

Open your Vercel URL in a private/incognito window and walk this checklist:

| # | Action | Expected result |
|---|---|---|
| 1 | Visit the site | You are redirected to **Sign in** |
| 2 | Click **Create an account**, register a test student | You land on the Dashboard; header shows the email and a **STUDENT** badge and **Sign out** |
| 3 | Supabase → **Table Editor → profiles** | Your new account has a row (`role = student`) |
| 4 | Open **Labs → Prompt Injection → Exploit**, type anything, **Run vulnerable** | The exploit runs (no 401); **Progress** page shows *Explored* |
| 5 | Supabase → **Table Editor → progress** | A row with `explored = true` for your user |
| 6 | Switch mode to **Intermediate**, submit a wrong flag, then the right one (hint: the *Learn* tab links the written guide) | *Failed* then *passed* row appears in **attempts** |
| 7 | Sign out → sign in as **owaspsiliguri@gmail.com** (create the account if it does not exist) | Header shows an **ADMIN** badge and an **Admin** nav item |
| 8 | Open **Admin** | Your test student is listed with progress; the stats cards are non-zero |
| 9 | Sign back in as the student, do a **Fix-It** in Advanced mode | `fixit = true` appears in `progress`, admin console updates after **Refresh** |
| 10 | Close the tab, come back, sign in again | All progress is still there (it lives in Supabase, not the browser) |

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

**Regenerate the written lab guides** after changing a module:

```bash
python scripts/gen_guides.py
git add labs/guided && git commit -m "Refresh guided labs" && git push
```

**Backups:** Supabase → Project Settings → **Database → Backups** (free tier keeps daily
backups for a limited time; export regularly if the data matters).

**Costs:** Supabase, Render and Vercel all have free tiers that fit a class. Two cautions:
Render free services **sleep** when idle, and Supabase free projects can be **paused**
after long inactivity — open the dashboard or upgrade if that happens. Check each
service's current pricing page before a big course.

**Promote/demote admins:** see the SQL snippet in Part A.6.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Browser console: *blocked by CORS policy* | `CORS_ORIGINS` mismatch | Part D — exact origin, no trailing slash, save (redeploys) |
| Error `Sign in to run labs on this deployment.` (401) | Frontend built **without** `VITE_SUPABASE_*`, or backend missing `SUPABASE_URL`/`SUPABASE_JWT_SECRET` | Set the matching variables on **both** Vercel and Render, then redeploy both |
| Error `Cannot verify your session: the auth service is unreachable` (503) | Backend cannot reach Supabase | Check `SUPABASE_URL` in Render; check Supabase status page |
| *Invalid login credentials* on correct password | Account created before you disabled email confirmation | Finish the confirmation email, or disable confirmation and retry |
| No **Admin** nav item when signed in as owaspsiliguri@gmail.com | Profile row missing or role not promoted | Run `supabase/schema.sql` again (it is safe to re-run), or run the Part A.6 SQL, then sign out and back in |
| `relation "public.profiles" does not exist` | Schema never ran | Part A.3 |
| Admin console shows *Could not load admin data* | Same as above, or the anon key lacks read rights | Re-run schema; confirm `VITE_SUPABASE_ANON_KEY` is the publishable/anon key |
| Progress missing for a student who never signed up | They are in local mode / browsing anonymously | They must create an account (share `/signup`) |
| Labs LLM03 / LLM09 return 503 or the service restarts | ChromaDB (RAG labs) is memory-hungry on the free instance | Set env `CHROMA_URL` to an external Chroma server, or upgrade the Render instance |
| Engine dropdown returns 503 for *Local model (Ollama)* | Ollama only exists in the local Docker stack | Use the **deterministic simulator** in the cloud (default) |
| Flags changed after a redeploy | `LAB_SECRET` was not set | Set it (Part B.5); already-captured flags stay valid per installation only |
| Vercel shows an old version | Cached build | Deployments → select latest → Redeploy; env-var changes always need a redeploy |

---

## Running the same stack locally

**Without login (fastest):**

```bash
docker compose up --build     # open http://localhost:8080
```

**With your Supabase login locally:**

```bash
# backend (terminal 1)
export SUPABASE_URL=https://YOUR-PROJECT.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-KEY
export SUPABASE_JWT_SECRET=YOUR-JWT-SECRET      # only if your project has one
export CORS_ORIGINS=http://localhost:5173
cd backend && uvicorn app.main:app --port 8000

# frontend (terminal 2)
cd frontend
echo "VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co" > .env.local
echo "VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-KEY" >> .env.local
echo "VITE_API_BASE=http://localhost:8000/api" >> .env.local
npm ci && npm run dev         # open http://localhost:5173
```

(`.env.local` is git-ignored — never commit those values.)
