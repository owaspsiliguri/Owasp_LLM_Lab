"""Environment-based configuration. No credentials are hardcoded."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    ollama_url: str
    ollama_model: str
    chroma_url: str
    data_dir: Path
    cors_origins: tuple[str, ...]
    rate_limit_per_minute: int
    fixit_timeout_seconds: int
    ollama_timeout_seconds: int
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str


def get_settings() -> Settings:
    origins = os.environ.get("CORS_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080")
    return Settings(
        ollama_url=os.environ.get("OLLAMA_URL", "http://ollama:11434").rstrip("/"),
        ollama_model=os.environ.get("OLLAMA_MODEL", "llama3.2:1b"),
        chroma_url=os.environ.get("CHROMA_URL", "").rstrip("/"),
        data_dir=Path(os.environ.get("LAB_DATA_DIR", "/tmp/llm-lab-data")),  # noqa: S108  # nosec B108 - dev default; Docker sets /data
        cors_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
        rate_limit_per_minute=_int("RATE_LIMIT_PER_MINUTE", 120),
        fixit_timeout_seconds=_int("FIXIT_TIMEOUT_SECONDS", 8),
        ollama_timeout_seconds=_int("OLLAMA_TIMEOUT_SECONDS", 60),
        supabase_url=os.environ.get("SUPABASE_URL", "").rstrip("/"),
        supabase_service_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
        supabase_jwt_secret=os.environ.get("SUPABASE_JWT_SECRET", ""),
    )
