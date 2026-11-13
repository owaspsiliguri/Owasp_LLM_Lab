"""Environment-based configuration. No credentials are hardcoded."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

# Local development convenience: .env.local/.env are read only when python-dotenv
# is installed and only for variables that are not already in the environment.
# Production values stay in the platform's environment configuration.
try:  # pragma: no cover - optional dependency
    from dotenv import load_dotenv

    _ROOT = Path(__file__).resolve().parents[2]
    load_dotenv(_ROOT / ".env", override=False)
    load_dotenv(_ROOT / ".env.local", override=False)
except ImportError:  # pragma: no cover - dotenv is optional
    pass


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    chroma_url: str
    data_dir: Path
    cors_origins: tuple[str, ...]
    rate_limit_per_minute: int
    flag_rate_limit_per_minute: int
    fixit_timeout_seconds: int
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    groq_api_key: str
    groq_model: str
    gemini_api_key: str
    gemini_model: str
    lab_provider: str
    judge_provider: str
    judge_model: str
    llm_timeout_seconds: int
    jwt_secret: str
    auth_required: bool
    auth_issuer: str
    auth_audience: str
    access_token_minutes: int
    refresh_token_days: int
    cookie_secure: bool
    admin_email: str
    admin_password: str
    supabase_anon_key: str
    max_course_bytes: int
    login_rate_limit_per_minute: int


# The deployed frontend (Render static site). Always allowed so a production
# deployment keeps working even when CORS_ORIGINS is unset or still holds the
# placeholder from render.yaml. CORS_ORIGINS adds further origins.
DEPLOYED_FRONTEND_ORIGINS = ("https://owasp-llm-lab-web.onrender.com",)
LOCAL_DEVELOPMENT_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
)


def _cors_origins() -> tuple[str, ...]:
    raw = os.environ.get("CORS_ORIGINS")
    configured = tuple(o.strip().rstrip("/") for o in (raw or "").split(",") if o.strip())
    # Deduplicate while preserving order: deployed origin first, then extras.
    return tuple(dict.fromkeys((*DEPLOYED_FRONTEND_ORIGINS, *configured, *LOCAL_DEVELOPMENT_ORIGINS)))


def get_settings() -> Settings:
    return Settings(
        chroma_url=os.environ.get("CHROMA_URL", "").rstrip("/"),
        data_dir=Path(os.environ.get("LAB_DATA_DIR", "/tmp/llm-lab-data")),  # noqa: S108  # nosec B108 - dev default; Docker sets /data
        cors_origins=_cors_origins(),
        rate_limit_per_minute=_int("RATE_LIMIT_PER_MINUTE", 120),
        flag_rate_limit_per_minute=_int("FLAG_RATE_LIMIT_PER_MINUTE", 20),
        fixit_timeout_seconds=_int("FIXIT_TIMEOUT_SECONDS", 8),
        supabase_url=os.environ.get("SUPABASE_URL", "").rstrip("/"),
        supabase_service_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
        supabase_jwt_secret=os.environ.get("SUPABASE_JWT_SECRET", ""),
        groq_api_key=os.environ.get("GROQ_API_KEY", "").strip(),
        groq_model=os.environ.get("GROQ_MODEL", "allam-2-7b").strip(),
        gemini_api_key=os.environ.get("GEMINI_API_KEY", "").strip(),
        gemini_model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip(),
        # Which real provider serves the vulnerable/secure lab runs. The judge
        # is independent (it always prefers the hardened Groq model). Gemini
        # behaves coherently on the injected-configuration prompt: benign
        # turns stay clean and targeted config asks leak. Groq's small models
        # were erratic here (refused attacks, leaked on unrelated turns), so
        # Gemini is the default when its key is present.
        lab_provider=os.environ.get("LAB_PROVIDER", "gemini").strip().lower(),
        judge_provider=os.environ.get("JUDGE_PROVIDER", "auto").strip().lower(),
        # The judge is a small classifier, not the lab's reasoning engine: a
        # non-reasoning model keeps it fast and stops it burning its token
        # budget on hidden reasoning before it emits the verdict JSON.
        judge_model=os.environ.get("JUDGE_MODEL", "").strip(),
        llm_timeout_seconds=_int("LLM_TIMEOUT_SECONDS", 30),
        # Backend-owned authentication. A deployment that sets no JWT_SECRET and
        # no Supabase credentials keeps the historical open, local-only mode.
        jwt_secret=os.environ.get("JWT_SECRET", "").strip(),
        auth_required=_bool("AUTH_REQUIRED", True),
        auth_issuer=os.environ.get("JWT_ISSUER", "owasp-llm-lab").strip(),
        auth_audience=os.environ.get("JWT_AUDIENCE", "llm-lab-web").strip(),
        access_token_minutes=max(5, _int("ACCESS_TOKEN_MINUTES", 15)),
        refresh_token_days=max(1, _int("REFRESH_TOKEN_DAYS", 30)),
        # Default to the safe value in production; local HTTP development sets
        # COOKIE_SECURE=0 explicitly (see .env.example).
        cookie_secure=_bool("COOKIE_SECURE", bool(os.environ.get("RENDER"))),
        admin_email=os.environ.get("ADMIN_EMAIL", "").strip().lower(),
        admin_password=os.environ.get("ADMIN_PASSWORD", ""),
        supabase_anon_key=os.environ.get("SUPABASE_ANON_KEY", "").strip(),
        max_course_bytes=max(1024, _int("MAX_COURSE_BYTES", 512 * 1024)),
        login_rate_limit_per_minute=max(3, _int("LOGIN_RATE_LIMIT_PER_MINUTE", 10)),
    )
