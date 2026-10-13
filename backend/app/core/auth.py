"""Supabase session verification for lab endpoints.

The lab is usable without Supabase: when neither ``SUPABASE_JWT_SECRET`` nor
``SUPABASE_URL`` is set, the API stays open and progress lives only in the
browser (local Docker mode).

When Supabase is configured, lab actions (run / flag / fix-it) require a valid
Supabase access token. Two verification paths are supported, because Supabase
projects differ:

1. Projects with a legacy HS256 **JWT Secret** are verified locally (fast).
2. Projects created after Supabase switched to asymmetric **JWT signing
   keys** have no shared secret; the token is validated against the project's
   own ``/auth/v1/user`` endpoint, with a short in-memory cache.
"""
from __future__ import annotations

import hashlib
import logging
import time
from typing import Annotated

import httpx
import jwt
from fastapi import Depends, HTTPException, Request

from app.config import get_settings

log = logging.getLogger("lab.auth")

SIGN_IN_REQUIRED = "Sign in to run labs on this deployment."
CACHE_TTL_SECONDS = 300
_cache: dict[str, tuple[float, dict[str, str]]] = {}


def auth_configured() -> bool:
    s = get_settings()
    return bool(s.supabase_jwt_secret or s.supabase_url)


def _user(claims: dict) -> dict[str, str]:
    return {"id": str(claims.get("sub") or claims.get("id") or ""), "email": str(claims.get("email") or "")}


def _cached(token: str) -> dict[str, str] | None:
    key = hashlib.sha256(token.encode()).hexdigest()
    entry = _cache.get(key)
    if not entry:
        return None
    expires_at, user = entry
    if time.monotonic() > expires_at:
        _cache.pop(key, None)
        return None
    return user


def _remember(token: str, user: dict[str, str]) -> None:
    if len(_cache) > 512:  # bounded: drop expired entries, then the oldest
        now = time.monotonic()
        for key in [k for k, (exp, _) in _cache.items() if now > exp]:
            _cache.pop(key, None)
        while len(_cache) >= 512:
            _cache.pop(next(iter(_cache)))
    key = hashlib.sha256(token.encode()).hexdigest()
    _cache[key] = (time.monotonic() + CACHE_TTL_SECONDS, user)


async def _verify_remote(token: str) -> dict[str, str]:
    """Validate the access token against the Supabase Auth (GoTrue) API."""
    s = get_settings()
    headers = {"Authorization": f"Bearer {token}"}
    if s.supabase_service_key:
        headers["apikey"] = s.supabase_service_key
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=3.0)) as client:
            resp = await client.get(f"{s.supabase_url}/auth/v1/user", headers=headers)
    except httpx.HTTPError as exc:
        log.warning("Supabase auth unreachable: %s", exc.__class__.__name__)
        raise HTTPException(status_code=503, detail="Cannot verify your session: the auth service is unreachable. Try again shortly.") from exc
    if resp.status_code == 200:
        try:
            data = resp.json()
        except ValueError as exc:
            raise HTTPException(status_code=501, detail="Unexpected response from the auth service.") from exc
        return _user({"id": data.get("id"), "sub": data.get("sub"), "email": data.get("email")})
    if resp.status_code in (401, 403):
        raise HTTPException(status_code=401, detail="Invalid or expired session. Sign in again.")
    log.warning("Supabase auth returned %s", resp.status_code)
    raise HTTPException(status_code=501, detail="Unexpected response from the auth service.")


async def optional_user(request: Request) -> dict[str, str] | None:
    """Return the signed-in Supabase user, or None when auth is not configured.

    Raises 401 when Supabase auth is configured but the request carries no
    valid access token, and 503 when the session cannot be verified because
    the auth service is unreachable (never fails open).
    """
    if not auth_configured():
        return None
    header = request.headers.get("Authorization", "")
    token = header.removeprefix("Bearer ").strip() if header.startswith("Bearer ") else ""
    if not token:
        raise HTTPException(status_code=401, detail=SIGN_IN_REQUIRED)

    secret = get_settings().supabase_jwt_secret
    if secret:
        try:
            claims = jwt.decode(token, secret, algorithms=["HS256"], options={"require": ["exp", "sub"]})
            return _user(claims)
        except jwt.ExpiredSignatureError as exc:
            raise HTTPException(status_code=401, detail="Your session expired. Sign in again.") from exc
        except jwt.PyJWTError:
            if not get_settings().supabase_url:
                raise HTTPException(status_code=401, detail="Invalid session token. Sign in again.") from None
            try:
                jwt.get_unverified_header(token)
            except jwt.PyJWTError:
                # Not even a JWT — no auth service can ever accept it.
                raise HTTPException(status_code=401, detail="Invalid session token. Sign in again.") from None
            # Not signed with the legacy secret (asymmetric signing keys):
            # fall through and let the project's auth service decide.

    user = _cached(token)
    if user is None:
        user = await _verify_remote(token)
        _remember(token, user)
    return user


OptionalUser = Annotated[dict[str, str] | None, Depends(optional_user)]
