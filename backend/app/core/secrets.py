"""Per-installation lab secret. Flags are derived via HMAC so they are never hardcoded."""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets as _secrets
from functools import lru_cache

from app.config import get_settings


@lru_cache(maxsize=1)
def _lab_secret() -> bytes:
    env = os.environ.get("LAB_SECRET")
    if env:
        return env.encode()
    data_dir = get_settings().data_dir
    data_dir.mkdir(parents=True, exist_ok=True)
    path = data_dir / "lab_secret"
    if path.exists():
        return path.read_bytes()
    value = _secrets.token_hex(32).encode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as fh:
        fh.write(value)
    return value


def derive(label: str, length: int = 16) -> str:
    return hmac.new(_lab_secret(), label.encode(), hashlib.sha256).hexdigest()[:length]


def flag_for(module_id: str) -> str:
    return f"FLAG{{{module_id}_{derive('flag:' + module_id)}}}"


def check_flag(module_id: str, submitted: str) -> bool:
    return hmac.compare_digest(submitted.strip().encode(), flag_for(module_id).encode())
