# Setup Guide

## Requirements
Docker Engine 24+ with Compose v2; about 1 GB free RAM. No GPU is needed. A Groq or Gemini API key is optional - without one the labs run on the built-in deterministic simulator.

## Start
```bash
cp .env.example .env
docker compose up --build
```
Open http://localhost:8080 (published on 127.0.0.1 only). Everything works immediately on the simulator.

With no `JWT_SECRET`, the API runs in open, single-user mode with local SQLite. This is for
localhost only. To turn on accounts and server-side progress, add the local auth values to
`.env` and restart:

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

The backend creates the administrator once in `platform.db` and never resets an existing
password. Students can sign up from the UI. Progress, scores and course completions are
server-side; the browser holds only HttpOnly session cookies and a readable CSRF cookie.

## Real-model engines (Groq / Gemini)
The server-side engine is Gemini or Groq; there is no picker in the UI. Add a key to `.env`
and restart:

```bash
cp .env.example .env
# edit .env: GROQ_API_KEY=gsk_...   and/or   GEMINI_API_KEY=AIza...
docker compose up -d backend
```

- Get a key: https://console.groq.com/keys or https://aistudio.google.com/apikey
- Both keys may be set; the server chooses the lab provider automatically.
- With a key, LLM01 and LLM02 (the chat labs) run on the real model, and the independent LLM
  judge grades exploit output and reviews failing Fix-It code.
- All other labs stay on the built-in simulator on purpose: they measure virtual resources,
  deterministic retrieval and sandboxed code, which a probabilistic model would make
  unreliable.
- The Dashboard shows which engines are active.

## Configuration
Copy `.env.example` to `.env`. Useful settings:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Enables backend-owned sign-in; required for any authenticated deployment |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap one local SQLite administrator; ignored for Supabase accounts except for the admin-email role signal |
| `COOKIE_SECURE` | `0` for local HTTP, `1` for HTTPS |
| `AUTH_REQUIRED` | Defaults to `1`; set `0` only for a deliberately open lab |
| `RATE_LIMIT_PER_MINUTE` | Global API limiter |
| `FLAG_RATE_LIMIT_PER_MINUTE` | Per-client flag-attempt limiter |
| `LAB_SECRET` | Stable HMAC flags across reinstalls |
| `LAB_DATA_DIR` | SQLite `platform.db` and embedded Chroma location (Docker uses `/data`) |
| `JUDGE_PROVIDER` | `auto`, `groq` or `gemini` |
| `SUPABASE_*` | Production Postgres + GoTrue federation; see [Deployment_Guide.md](Deployment_Guide.md) |

ChromaDB runs as part of the default stack and is used by LLM03 and LLM09.

## Companion courses
Seed one course per lab, locally:

```bash
python scripts/seed_courses.py
python scripts/seed_courses.py --dry-run   # validate only
```

The command is idempotent by slug (`llm01-essentials` … `llm22-essentials`). Existing
courses are skipped; `--update` refreshes generated source while preserving status and
completions. If Supabase is configured, the script refuses to write unless `--allow-remote`
is passed, so a local command cannot silently publish to production. Administrators can
also upload and edit Markdown courses in the Admin console.

## Without Docker (development)
```bash
python -m venv .venv
. .venv/bin/activate                 # Windows: .venv\Scripts\activate
pip install -r backend/requirements-dev.txt

# terminal 1, from backend/
uvicorn app.main:app --host 127.0.0.1 --port 8000

# terminal 2, from frontend/
npm ci
npm run dev -- --host 127.0.0.1       # open http://127.0.0.1:5173
```

Vite proxies `/api` to `http://127.0.0.1:8000` by default. Set `VITE_PROXY_TARGET` to use a
different backend. On Windows the proxy deliberately uses the IPv4 literal because
`localhost` can resolve to `::1`.

The backend test suite runs on Linux, macOS and Windows. It isolates itself from a developer
`.env` (pinning open test mode), so no database, Supabase project or model key is required:

```bash
pytest -q tests/backend
cd frontend && npm test -- --run && npm run lint && npm run build
```

Want login and cloud progress locally? See "Running the same stack locally" at the end of
[Deployment_Guide.md](Deployment_Guide.md#running-the-same-stack-locally).

## Troubleshooting
- Labs answer but a run returns 503 mentioning Groq or Gemini: the key is set but the API is unreachable or rate-limited; check the key and `docker compose logs backend`.
- RAG labs return 503: ChromaDB is not reachable; check `docker compose ps` and `docker compose logs chromadb`.
- Login returns 500 and the log says `JWT_SECRET is not configured`: set `JWT_SECRET` and restart the backend.
- Login succeeds but the next request is 401: the frontend and API are on different sites, or `COOKIE_SECURE` does not match the scheme. Use the same origin (Vite proxy or Vercel `/api` rewrite) and `COOKIE_SECURE=0` only for local HTTP.
- `403 Missing or invalid CSRF token`: reload the page so the `llm_csrf` cookie exists; make sure a proxy is not stripping `X-CSRF-Token`.
- Port 8080 busy: change the mapping in `docker-compose.yml`.
- Reset everything including flags: `docker compose down -v` (flags are regenerated).
- Set `LAB_SECRET` to make flags stable across reinstalls.
- Course links return 404: run `python scripts/seed_courses.py` (and reload the API).
