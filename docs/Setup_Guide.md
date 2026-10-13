# Setup Guide

## Requirements
Docker Engine 24+ with Compose v2; about 4 GB free RAM and 3 GB disk for the default model. No GPU or cloud account is needed.

## Start
```bash
docker compose up --build
```
Open http://localhost:8080 (published on 127.0.0.1 only). `ollama-init` pulls the model once; progress: `docker compose logs -f ollama-init`. The Dashboard shows whether the model is ready. The deterministic engine needs no model.

## Configuration
Copy `.env.example` to `.env`. `OLLAMA_MODEL` selects any model from the Ollama library; `RATE_LIMIT_PER_MINUTE` tunes the API limiter. ChromaDB runs as part of the default stack and is used by LLM03 and LLM09.

## Without Docker (development)
```bash
pip install -r backend/requirements-dev.txt
cd backend && uvicorn app.main:app --port 8000   # embedded ChromaDB; set CHROMA_URL to use a server
cd frontend && npm ci && npm run dev   # proxies /api to :8000
```
The backend test suite uses the Unix-only `resource` module (Fix-It sandbox limits), so `pytest` needs Linux or macOS. On Windows run `bash scripts/test_backend_docker.sh` (Docker Desktop) or use WSL.

Want login and cloud progress locally? See “Running the same stack locally” at the end of [Deployment_Guide.md](Deployment_Guide.md).

## Troubleshooting
- Ollama engine returns 503: model still downloading or name wrong; check `docker compose logs ollama-init`.
- RAG labs return 503: ChromaDB is not reachable; check `docker compose ps` and `docker compose logs chromadb`.
- Port 8080 busy: change the mapping in `docker-compose.yml`.
- Reset everything including flags: `docker compose down -v` (flags are regenerated).
- Set `LAB_SECRET` to make flags stable across reinstalls.
