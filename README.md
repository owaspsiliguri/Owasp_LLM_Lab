# OWASP LLM Learning Lab

A deliberately vulnerable, containerized web application for learning to **identify, exploit, understand, fix and validate** security vulnerabilities in classic (non-agentic) LLM applications — now with **student accounts, an admin console and cloud-hosted progress**.

> Proposed by OWASP Siliguri and developed by the community. This is **not** an official OWASP project and has not been endorsed or accepted by OWASP. "Juice Shop for classic LLM applications" is an internal conceptual comparison only.

**Learn → Exploit → Understand → Fix → Validate**

Repository: [github.com/owaspsiliguri/Owasp_LLM_Lab](https://github.com/owaspsiliguri/Owasp_LLM_Lab)

## Why it exists

Existing resources cover agentic AI, scanner benchmarking, CTF-style games and standards documents. This lab fills a different gap: a structured, progressive, hands-on environment where developers attack a vulnerable LLM feature, read the vulnerable code next to a secure implementation, repair the code themselves and get automatic proof that the fix holds.

## Features

- Ten complete modules mapped to the OWASP Top 10 for LLM Applications (see table below), including two RAG labs on a real **ChromaDB**, two safe resource simulations, a simulated supply chain and a tool-calling lab
- **Real vulnerable labs, not demos**: real prompt-channel concatenation, real SQLite injection, real HTML rendering in a sandboxed iframe, real ChromaDB poisoning, a real resource-limited Fix-It sandbox
- **Accounts:** email/password sign-up and sign-in (Supabase Auth), per-user progress saved in the cloud, session-gated lab API
- **Admin console:** `owaspsiliguri@gmail.com` gets the admin role automatically — student roster, per-lab completion, captured flags, validated fixes and a forged-proof attempt audit log
- **Guided labs:** every module ships an in-app guided walkthrough (Beginner mode) plus a full written guide in [`labs/guided/`](labs/guided/README.md) with payload tables, expected output and completion checklists (regenerated from the module source by `scripts/gen_guides.py`)
- Vulnerable and secure implementations displayed from the real source that runs
- Beginner (guided), Intermediate (hints and flags) and Advanced (**Fix It**) modes
- **Fix It validation**: submitted code runs in a resource-limited sandbox against deterministic attack tests
- Two engines: a deterministic model simulator (reproducible, no GPU) and a real local model through **Ollama**
- Local-first: the full stack runs offline with `docker compose` (login optional), no cloud API keys needed
- Per-installation flags derived with HMAC; nothing hardcoded
- Row Level Security on every Supabase table; service-role key stays server-side; flags re-validated by the server before any achievement is recorded
- Tests: 152 backend and security, 8 infrastructure, 24 frontend, plus a Docker-host smoke script; CI with lint, tests, Docker build and dependency scans

## Quick start (local, no login)

```bash
git clone <repository>
cd llm-learning-lab
docker compose up --build
```

Open **http://localhost:8080**. The first start downloads the Ollama model (`llama3.2:1b`, roughly 1.3 GB) in the background; the deterministic engine works immediately. See [docs/Setup_Guide.md](docs/Setup_Guide.md).

Windows: the backend test suite needs Linux — run `bash scripts/test_backend_docker.sh`.

## Deploy it for a class (Supabase + Render + Vercel)

Everything has a free tier and the guide assumes zero deployment experience:

**[docs/Deployment_Guide.md](docs/Deployment_Guide.md)** — step by step:

1. **Supabase** — create the project, run [`supabase/schema.sql`](supabase/schema.sql) (tables, row level security, admin trigger), copy 4 keys
2. **Render** — deploy the FastAPI backend (`backend/`, root directory + start command provided), set the Supabase env vars
3. **Vercel** — deploy the React frontend (`frontend/` root directory), set `VITE_*` env vars
4. **Connect** — set `CORS_ORIGINS` on Render to your Vercel URL
5. **Verify** — a 10-point checklist that exercises sign-up, progress, flags, the admin console and persistence

Result: a public site where students sign up, work the labs and keep their progress, and administrators watch completion in the Admin console.

## Architecture

```
Local mode:                          Deployed mode:
React UI (nginx) ──▶ FastAPI          React UI (Vercel) ──▶ FastAPI (Render) ──▶ Supabase (auth + data)
                        │                                                ▲
                        └──▶ Ollama, ChromaDB                           └── service-role writes after
                                                                             server-side validation
```

Details: [docs/Architecture.md](docs/Architecture.md), security: [docs/Security_Model.md](docs/Security_Model.md).

## Modules

| ID | Module | OWASP | Modes |
|----|--------|-------|-------|
| llm01 | Prompt Injection | LLM01 | guided, hints + flag, Fix It |
| llm02 | Sensitive Information Disclosure | LLM02 | guided, hints + flag, Fix It |
| llm10 | Improper Output Handling (HTML, SQL, JSON) | LLM10 | guided, hints + flag, Fix It |
| llm03 | Data and Knowledge Base Poisoning (ChromaDB) | LLM03 | guided, hints + flag, Fix It |
| llm04 | Model Denial of Service (virtual resources) | LLM04 | guided, hints + flag, Fix It |
| llm06 | Unbounded Consumption (cost dashboard) | LLM06 | guided, hints + flag, Fix It |
| llm09 | Hallucinations (conflicting RAG sources) | LLM09 | guided, hints + flag, Fix It |
| llm05 | Supply Chain (simulated registry) | LLM05 | guided, hints + flag, Fix It |
| llm07 | Excessive Agency (tool calls) | LLM07 | guided, hints + flag, Fix It |
| llm08 | Overreliance (AI code review) | LLM08 | guided, hints + flag, Fix It |

All ten planned module IDs are implemented, each with a written guide in [labs/guided](labs/guided/README.md). Mapping: [docs/LLM_Top_10_Mapping.md](docs/LLM_Top_10_Mapping.md).

## Development

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r backend/requirements-dev.txt
pytest                              # Linux/macOS; Windows: bash scripts/test_backend_docker.sh
ruff check backend tests
cd frontend && npm ci && npm test && npm run lint && npm run build
python scripts/gen_guides.py        # regenerate labs/guided/*.md after editing a module
```

Environment: copy `.env.example` to `.env`. Frontend variables for local Supabase login go in `frontend/.env.local` (git-ignored) — see [docs/Deployment_Guide.md](docs/Deployment_Guide.md#running-the-same-stack-locally).

## Screenshots

Not bundled: they must be captured from a running stack, and the environment this archive was produced in had no browser. Start the stack and open http://localhost:8080.

## Contributing, security, license

[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · MIT [LICENSE](LICENSE)
