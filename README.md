<div align="center">

# 🧠 OWASP LLM Learning Lab

**The hands-on training ground for classic LLM application security**

*Twenty-two deliberately vulnerable labs. Four difficulty tiers. Real models, real exploits, real fixes.*

[![CI](https://github.com/owaspsiliguri/Owasp_LLM_Lab/actions/workflows/ci.yml/badge.svg)](https://github.com/owaspsiliguri/Owasp_LLM_Lab/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Backend](https://img.shields.io/badge/FastAPI-22%20labs%20%E2%9C%94-009688)](docs/Architecture.md)
[![Frontend](https://img.shields.io/badge/React%20%2B%20Vite-frontend-61dafb)](frontend/)
[![OWASP](https://img.shields.io/badge/OWASP-Top%2010%20for%20LLM%20Apps-000000)](docs/LLM_Top_10_Mapping.md)
[![Docker](https://img.shields.io/badge/Docker%20compose-up%20%E2%80%94%201%20command-2496ed)](#-quick-start)

**Learn → Exploit → Understand → Fix → Validate**

</div>

---

## Why this lab exists

Existing resources cover agentic AI, scanner benchmarking, CTF games and standards documents. This lab fills a different gap: a **structured, progressive, hands-on environment** where a learner attacks a vulnerable LLM feature, reads the vulnerable code next to a secure implementation, repairs it themselves, and gets automatic proof that the fix holds.

> Proposed by OWASP Siliguri and developed by the community. This is **not** an official OWASP project and has not been endorsed or accepted by OWASP. "Juice Shop for classic LLM applications" is an internal conceptual comparison only.

---

## ✨ Platform highlights

| | |
|---|---|
| 🏴 **Real vulnerable labs, not demos** | Real prompt-channel concatenation, real SQLite injection, real HTML rendering in a sandboxed iframe, real ChromaDB poisoning, a real resource-limited Fix-It sandbox |
| 📈 **Four difficulty tiers** | Every module carries one of four levels: **Beginner**, **Intermediate**, **Advanced** or **Expert**. No mode buttons, no stripping guidance — the difficulty lives on the lab. |
| 🤖 **Groq + Gemini engines** | Set a key and the chat labs run on a real LLM — server-side only, no engine picker in the UI. No key? The deterministic simulator keeps everything reproducible and free |
| ⚖️ **Independent LLM judge** | A second, separate model grades whether a real-model run actually leaked the secret and reviews failing Fix-It code — with transparent cross-provider fallback |
| 🔐 **Accounts, admin, server-owned progress** | Backend-issued JWT cookies, rotating refresh sessions, CSRF protection, per-user progress, an admin console for the configured administrator, and a public course catalogue |
| 📚 **Companion courses** | One seeded Markdown course per lab, linked from the lab page and the learning paths. Administrators can upload, edit and publish more courses in the Admin console |
| 🧪 **Fix It sandbox** | Submitted remediation code runs in a resource-limited subprocess against deterministic attack replays — including a canary-leak regression check |
| 📖 **Guided end-to-end** | Complete walkthrough, vulnerability background, vulnerable + secure source and the Fix-It brief are all rendered **inside the lab page** — no GitHub hand-offs, no external docs |
| 🛡️ **Hardened by default** | HMAC per-installation flags (never hardcoded), backend-enforced scoring, HttpOnly/SameSite cookies, CSRF double submit, RLS read-only progress, output redaction so a benign "hi" can never hand you a flag |

---

## 📊 The twenty-two labs

| ID | Lab | OWASP | Level |
|----|-----|-------|-------|
| llm01 | Prompt Injection | LLM01 | 🟢 Beginner |
| llm02 | Sensitive Information Disclosure | LLM02 | 🟢 Beginner |
| llm11 | System Prompt Leakage | LLM07 | 🟢 Beginner |
| llm03 | Data & Knowledge Base Poisoning (ChromaDB) | LLM03 | 🟡 Intermediate |
| llm04 | Model Denial of Service (virtual resources) | LLM04 | 🟡 Intermediate |
| llm05 | Supply Chain (simulated registry) | LLM05 | 🟡 Intermediate |
| llm06 | Unbounded Consumption (cost dashboard) | LLM06 | 🟡 Intermediate |
| llm10 | Improper Output Handling (HTML · SQL · JSON) | LLM10 | 🟡 Intermediate |
| llm07 | Excessive Agency (tool calls) | LLM07 | 🟠 Advanced |
| llm08 | Overreliance (AI code review) | LLM08 | 🟠 Advanced |
| llm09 | Hallucinations (conflicting RAG sources) | LLM09 | 🟠 Advanced |
| llm12 | Vector & Embedding Weaknesses (multi-tenant RAG) | LLM08 | 🔴 Advanced |
| llm13 | RAG Tenant Isolation (shared index, two tenants) | LLM05 | 🟡 Intermediate |
| llm14 | RAG Tenant Isolation (clearance bypass) | LLM08 | 🔴 Advanced |
| llm15 | Tool Output Injection | LLM06 | 🔴 Advanced |
| llm16 | Function Call Parameter Tampering | LLM06 | 🔴 Advanced |
| llm17 | Agent Authorization Bypass | LLM06 | 🔴 Advanced |
| llm18 | Persistent Memory Poisoning | LLM04 | 🔴 Advanced |
| llm19 | Multi-Turn Jailbreak | LLM01 | 🔴 Advanced |
| llm20 | Overreliance on LLM Output | LLM09 | 🔴 Advanced |
| llm21 | MCP Server Security | LLM03 | 🔴 Advanced |
| llm22 | LLM-to-Code Injection | LLM10 | 🔴 Expert |

Every lab ships **vulnerable + secure implementations rendered from the real source that executes**, a flag capture and a Fix-It challenge. Difficulty is a property of each lab, not a switch you flip — there are no mode buttons, because no lab is easier or harder on demand. Full mapping: [docs/LLM_Top_10_Mapping.md](docs/LLM_Top_10_Mapping.md).

### Difficulty is per lab, not a mode

| Level | What you get |
|------|--------------|
| **Beginner** (llm01, llm02, llm11) | Walkthrough, ready-made payload buttons, hints on demand — everything you need to learn the pattern |
| **Intermediate** (llm03, llm04, llm05, llm06, llm10, llm13, llm14, llm15, llm18) | Full walkthrough of the *mechanism*, one-at-a-time hints, **no ready-made exploit payloads** — you phrase the attack yourself |
| **Advanced** (llm07, llm08, llm09, llm12, llm16, llm17, llm19, llm20, llm21) | No hints and no examples at all. Capture the flag **and** pass Fix-It to finish the lab |
| **Expert** (llm22) | No hints, no examples, the strongest Fix-It checks and the most hostile attack surface. Treated as finished only when flag, fix and replay all pass |

**Lab portfolio at a glance**

| Metric | Value |
|--------|-------|
| Labs | **22** |
| Difficulty tiers | **4** — Beginner · Intermediate · Advanced · Expert |
| Points per lab | **250** (100 flag + 150 fix-it; explore, hints, navigation and chat award 0) |
| Maximum points | **5,500** |
| Estimated practice | **~11 hours** (675 minutes) |
| OWASP risk categories | **10** — mapped to the 2025 list |
| Companion courses | **22** — one per lab, plus any administrator-authored courses |

---

## 🚀 Quick start

```bash
git clone https://github.com/owaspsiliguri/Owasp_LLM_Lab.git
cd Owasp_LLM_Lab
cp .env.example .env
docker compose up --build
```

Open **http://localhost:8080** — labs run key-free on the built-in simulator immediately.

**Want accounts and saved progress locally?** Uncomment `JWT_SECRET`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` (and keep `COOKIE_SECURE=0` for local HTTP), then restart:

```bash
docker compose up -d --build
```

Sign in with the administrator you configured. Students can also create their own accounts; progress is stored in the backend's local SQLite database, not in the browser.

**Want real models?** Add a key (Groq and/or Gemini) to `.env` and restart — the server picks the engine, the independent judge comes online, and the Dashboard shows engine status:

```bash
GROQ_API_KEY=gsk_...        # console.groq.com/keys
GEMINI_API_KEY=AIza...      # aistudio.google.com/apikey
docker compose up -d
```

Full setup (without Docker, Windows notes, troubleshooting): **[docs/Setup_Guide.md](docs/Setup_Guide.md)**.

---

## ☁️ Deploy it for a class (Supabase + Render + Vercel)

Everything has a free tier and the guide assumes zero deployment experience:

**[docs/Deployment_Guide.md](docs/Deployment_Guide.md)** — step by step:

1. **Supabase** — create the project, run [`supabase/schema.sql`](supabase/schema.sql), then the additive [`20261111_platform_upgrade.sql`](supabase/migrations/20261111_platform_upgrade.sql) migration. Existing users and progress are preserved.
2. **Render** — deploy the FastAPI backend (`backend/`, root directory + start command provided). Set `JWT_SECRET`, the Supabase keys, `ADMIN_EMAIL`, `COOKIE_SECURE=1` and `CORS_ORIGINS`.
3. **Vercel** — deploy the React frontend (`frontend/` root directory). Proxy `/api/*` to Render from the same Vercel origin (or use same-site custom domains) so the HttpOnly cookies are sent.
4. **Seed courses** — run `python scripts/seed_courses.py --allow-remote` once with the production Supabase environment, after checking the target.
5. **Verify** — a checklist covering sign-up, server progress, the 100/150/250 scoring, the admin console, course editing and persistence.

Result: a public site where students sign up, work the labs and keep their progress, administrators watch completion and author courses, and every achievement is validated by the backend.

---

## 🏗️ Architecture

```text
Local mode:
React UI (nginx) ──▶ FastAPI ──▶ SQLite (platform.db)
                         └─────▶ ChromaDB (RAG labs)

Deployed mode:
React UI (Vercel) ──/api rewrite──▶ FastAPI (Render) ──▶ Supabase Postgres + GoTrue
                                          └────────────▶ Groq / Gemini (real-model engine + judge)
```

The browser never holds an access token, a refresh token or Supabase keys. The API issues an HttpOnly access cookie and a rotating HttpOnly refresh cookie; a readable CSRF cookie is mirrored in `X-CSRF-Token` for state-changing requests. Cookie authentication requires the frontend and API to be **same-origin** (a Vercel `/api` rewrite) or **same-site** (custom domains under one registrable domain).

---

## 🛠️ Development

```bash
python -m venv .venv
. .venv/bin/activate                 # Windows: .venv\Scripts\activate
pip install -r backend/requirements-dev.txt
pytest -q tests/backend              # Linux, macOS and Windows
ruff check backend tests
cd frontend && npm ci && npm test -- --run && npm run lint && npm run build
python scripts/gen_guides.py         # regenerate labs/guided/*.md after editing a module
python scripts/seed_courses.py       # create the 22 companion courses locally (idempotent)
bash scripts/audit_free_flags_docker.sh   # prove no lab leaks its flag on a benign input
```

**Local API and UI:**

```bash
# terminal 1, from backend/
uvicorn app.main:app --host 127.0.0.1 --port 8000

# terminal 2, from frontend/
npm run dev -- --host 127.0.0.1       # proxies /api to http://127.0.0.1:8000
```

`VITE_PROXY_TARGET` overrides the proxy target. The default is the IPv4 literal `127.0.0.1` because Windows can resolve `localhost` to `::1`.

**Test matrix:** backend unit, security and infrastructure suites under `tests/`, plus the frontend Vitest suite. CI runs lint, tests, Docker builds and dependency scans.

**Environment:** copy `.env.example` to `.env`. Do not put Supabase keys in the frontend: browser auth and data access go through the API. Optional frontend overrides live in `frontend/.env.local` (git-ignored). See [docs/Deployment_Guide.md](docs/Deployment_Guide.md#running-the-same-stack-locally).

---

## 🤝 Contributing, security, license

[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · MIT [LICENSE](LICENSE)

New lab ideas follow [docs/Module_Development.md](docs/Module_Development.md): copy an existing module, implement the contract, add Fix-It tests, open a PR — CI does the rest.
