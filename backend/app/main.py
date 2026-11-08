from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health as health_endpoint
from app.api.routes import router
from app.config import get_settings
from app.core.security import RateLimitMiddleware, SecurityHeadersMiddleware
from app.services import supabase_store, vectorstore

log = logging.getLogger("lab.main")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Prepare the filesystem and vector store before serving traffic.

    A dependency failure is logged and exposed by /health; it must not crash the
    process, because the lab's simulator-only features still work without it.
    """
    s = get_settings()
    try:
        s.data_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        log.warning("Could not create data directory %s: %s", s.data_dir, exc.__class__.__name__)

    # Initialise Chroma and probe Supabase in parallel instead of racing the
    # first lab/health request. Both checks report failures rather than raising.
    vector, database = await asyncio.gather(
        asyncio.to_thread(vectorstore.status),
        supabase_store.health(),
    )
    log.info(
        "startup complete: vector_store=%s database=%s cors_origins=%s",
        "ok" if vector.get("reachable") else "unavailable",
        database.get("status", "unknown"),
        list(s.cors_origins),
    )
    yield
    log.info("shutdown complete")


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="OWASP LLM Learning Lab API",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware, per_minute=s.rate_limit_per_minute)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(s.cors_origins),
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Accept", "Content-Type", "Authorization"],
        expose_headers=["Retry-After"],
        max_age=600,
    )
    app.include_router(router, prefix="/api")
    # Root alias so Render and external uptime checks can probe /health
    # directly; the frontend and Render's configured check use /api/health.
    app.add_api_route("/health", health_endpoint, methods=["GET"], include_in_schema=False)
    return app


app = create_app()
