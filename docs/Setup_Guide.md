# Setup Guide

## Requirements
Docker Engine 24+ with Compose v2; about 1 GB free RAM. No GPU is needed. A Groq or Gemini API key is optional - without one the labs run on the built-in deterministic simulator.

## Start
```bash
docker compose up --build
```
Open http://localhost:8080 (published on 127.0.0.1 only). Everything works immediately on the simulator.

## Real-model engines (Groq / Gemini)
The server-side engine is Groq or Gemini; there is no picker in the UI. Add a key to `.env` and restart:

```bash
cp .env.example .env
# edit .env: GROQ_API_KEY=gsk_...   and/or   GEMINI_API_KEY=AIza...
docker compose up -d backend
```

- Get a key: https://console.groq.com/keys or https://aistudio.google.com/apikey
- Both keys may be set; Groq is preferred automatically.
- With a key, LLM01 and LLM02 (the chat labs) run on the real model, and the independent LLM judge grades exploit output and reviews failing Fix-It code.
- Labs LLM03-LLM10 stay on the built-in simulator on purpose: they measure virtual resources, deterministic retrieval and sandboxed code, which a probabilistic model would make unreliable.
- The Dashboard shows which engines are active.

## Configuration
Copy `.env.example` to `.env`. `RATE_LIMIT_PER_MINUTE` tunes the API limiter; `JUDGE_PROVIDER=auto|groq|gemini` picks the judge. ChromaDB runs as part of the default stack and is used by LLM03 and LLM09.

## Without Docker (development)
```bash
pip install -r backend/requirements-dev.txt
cd backend && uvicorn app.main:app --port 8000   # embedded ChromaDB; set CHROMA_URL to use a server
cd frontend && npm ci && npm run dev   # proxies /api to :8000
```
The backend test suite uses the Unix-only `resource` module (Fix-It sandbox limits), so `pytest` needs Linux or macOS. On Windows run `bash scripts/test_backend_docker.sh` (Docker Desktop) or use WSL.

Want login and cloud progress locally? See "Running the same stack locally" at the end of [Deployment_Guide.md](Deployment_Guide.md).

## Troubleshooting
- Labs answer but a run returns 503 mentioning Groq or Gemini: the key is set but the API is unreachable or rate-limited; check the key and `docker compose logs backend`.
- RAG labs return 503: ChromaDB is not reachable; check `docker compose ps` and `docker compose logs chromadb`.
- Port 8080 busy: change the mapping in `docker-compose.yml`.
- Reset everything including flags: `docker compose down -v` (flags are regenerated).
- Set `LAB_SECRET` to make flags stable across reinstalls.
