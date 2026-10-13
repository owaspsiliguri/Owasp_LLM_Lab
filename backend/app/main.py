from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import get_settings
from app.core.security import RateLimitMiddleware, SecurityHeadersMiddleware


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="OWASP LLM Learning Lab API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware, per_minute=s.rate_limit_per_minute)
    app.add_middleware(CORSMiddleware, allow_origins=list(s.cors_origins), allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization"])
    app.include_router(router, prefix="/api")
    return app


app = create_app()
