"""Authentication primitives and FastAPI dependencies.

The platform issues its own short-lived JWT access token and an opaque,
single-use refresh token. Both travel in HttpOnly cookies. The historical
Supabase bearer-token path is retained for API compatibility, but the browser
no longer stores Supabase credentials.

Claims on platform tokens: ``sub``, ``email``, ``role``, ``name``, ``sid``,
``jti``, ``iat``, ``exp``, ``iss``, ``aud``.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

import httpx
import jwt
from fastapi import Depends, HTTPException, Request, Response

from app.config import get_settings

log = logging.getLogger("lab.auth")

ACCESS_COOKIE = "llm_access"
REFRESH_COOKIE = "llm_refresh"
CSRF_COOKIE = "llm_csrf"
CSRF_HEADER = "X-CSRF-Token"
SIGN_IN_REQUIRED = "Sign in to run labs on this deployment."
CACHE_TTL_SECONDS = 300
JWT_ALGORITHM = "HS256"
REFRESH_BYTES = 48

_cache: dict[str, tuple[float, dict[str, str]]] = {}


# ── Configuration helpers ────────────────────────────────────────────────────

def jwt_secret_value() -> str:
    s = get_settings()
    if s.jwt_secret:
        return s.jwt_secret
    if s.supabase_jwt_secret:
        return s.supabase_jwt_secret
    if s.supabase_service_key:
        return hashlib.sha256(f"jwt-key:{s.supabase_service_key}".encode()).hexdigest()
    if s.supabase_anon_key:
        return hashlib.sha256(f"jwt-anon:{s.supabase_anon_key}".encode()).hexdigest()
    seed = s.supabase_url or s.admin_email or "owasp-llm-lab-stable-secret"
    return hashlib.sha256(f"jwt-seed:{seed}".encode()).hexdigest()


def local_auth_configured() -> bool:
    return bool(get_settings().jwt_secret or get_settings().supabase_service_key)


def supabase_auth_configured() -> bool:
    s = get_settings()
    return bool(s.supabase_url and (s.supabase_anon_key or s.supabase_service_key))


def auth_configured() -> bool:
    """True when this deployment has any usable identity provider."""
    return local_auth_configured() or supabase_auth_configured()


def auth_required() -> bool:
    return bool(get_settings().auth_required and auth_configured())


def auth_mode() -> str:
    if local_auth_configured() and supabase_auth_configured():
        return "supabase+jwt"
    if supabase_auth_configured():
        return "supabase"
    if local_auth_configured():
        return "local"
    return "open"


# ── Access tokens ────────────────────────────────────────────────────────────

def create_access_token(user: dict[str, Any], session_id: str) -> str:
    settings = get_settings()
    secret = jwt_secret_value()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user["id"]),
        "email": user.get("email") or "",
        "role": user.get("role") or "student",
        "name": user.get("full_name") or "",
        "sid": session_id,
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_minutes)).timestamp()),
        "iss": settings.auth_issuer,
        "aud": settings.auth_audience,
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    secret = jwt_secret_value()
    return jwt.decode(
        token,
        secret,
        algorithms=[JWT_ALGORITHM],
        audience=settings.auth_audience,
        issuer=settings.auth_issuer,
        options={"require": ["exp", "iat", "sub", "aud", "iss", "sid", "jti"]},
    )


def _claims_user(claims: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(claims.get("sub") or ""),
        "email": str(claims.get("email") or ""),
        "role": str(claims.get("role") or "student"),
        "full_name": str(claims.get("name") or ""),
        "sid": str(claims.get("sid") or ""),
        "provider": "platform",
    }


# ── Refresh tokens ───────────────────────────────────────────────────────────

def new_refresh_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(REFRESH_BYTES)
    return raw, hash_refresh(raw)


def hash_refresh(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def refresh_expiry_iso() -> str:
    days = get_settings().refresh_token_days
    return (datetime.now(UTC) + timedelta(days=days)).isoformat(timespec="seconds")


def refresh_cookie_max_age() -> int:
    return get_settings().refresh_token_days * 24 * 60 * 60


# ── Cookies and CSRF ─────────────────────────────────────────────────────────

def set_auth_cookies(
    response: Response,
    *,
    access_token: str,
    refresh_token: str,
    existing_csrf: str | None = None,
) -> str:
    settings = get_settings()
    samesite_val = "none" if settings.cookie_secure else "lax"
    response.set_cookie(
        ACCESS_COOKIE,
        access_token,
        max_age=settings.access_token_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=samesite_val,
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=refresh_cookie_max_age(),
        httponly=True,
        secure=settings.cookie_secure,
        samesite=samesite_val,
        path="/api/auth",
    )
    return ensure_csrf(response, existing_csrf)


def clear_auth_cookies(response: Response) -> None:
    settings = get_settings()
    samesite_val = "none" if settings.cookie_secure else "lax"
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")
    response.delete_cookie(CSRF_COOKIE, path="/")
    # Use the same attributes where a browser distinguishes deletion cookies.
    if settings.cookie_secure:
        response.delete_cookie(ACCESS_COOKIE, path="/", secure=True, httponly=True, samesite=samesite_val)
        response.delete_cookie(REFRESH_COOKIE, path="/api/auth", secure=True, httponly=True, samesite=samesite_val)
        response.delete_cookie(CSRF_COOKIE, path="/", secure=True, httponly=False, samesite=samesite_val)


def ensure_csrf(response: Response, existing: str | None = None) -> str:
    settings = get_settings()
    token = existing or secrets.token_urlsafe(32)
    samesite_val = "none" if settings.cookie_secure else "lax"
    response.set_cookie(
        CSRF_COOKIE,
        token,
        max_age=refresh_cookie_max_age(),
        httponly=False,  # the browser must be able to mirror it in a header
        secure=settings.cookie_secure,
        samesite=samesite_val,
        path="/",
    )
    return token


def csrf_valid(request: Request) -> bool:
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get(CSRF_HEADER)
    if not cookie or not header:
        return False
    return hmac.compare_digest(cookie.encode(), header.encode())


def origin_allowed(request: Request) -> bool:
    origin = request.headers.get("Origin")
    if not origin:
        return True  # non-browser client; CSRF is a browser-cookie threat
    settings = get_settings()
    return origin.rstrip("/") in {item.rstrip("/") for item in settings.cors_origins}


def cookie_auth_present(request: Request) -> bool:
    return bool(request.cookies.get(ACCESS_COOKIE) or request.cookies.get(REFRESH_COOKIE))


# ── Legacy Supabase verification (compatibility path) ───────────────────────

def _legacy_user(claims: dict) -> dict[str, Any]:
    return {
        "id": str(claims.get("sub") or claims.get("id") or ""),
        "email": str(claims.get("email") or ""),
        "role": "admin" if str(claims.get("email") or "").lower() == get_settings().admin_email else "student",
        "full_name": "",
        "sid": "",
        "provider": "supabase",
    }


def _cached(token: str) -> dict[str, Any] | None:
    key = hashlib.sha256(token.encode()).hexdigest()
    entry = _cache.get(key)
    if not entry:
        return None
    expires_at, user = entry
    if time.monotonic() > expires_at:
        _cache.pop(key, None)
        return None
    return user


def _remember(token: str, user: dict[str, Any]) -> None:
    if len(_cache) > 512:
        now = time.monotonic()
        for key in [k for k, (exp, _) in _cache.items() if now > exp]:
            _cache.pop(key, None)
        while len(_cache) >= 512:
            _cache.pop(next(iter(_cache)))
    key = hashlib.sha256(token.encode()).hexdigest()
    _cache[key] = (time.monotonic() + CACHE_TTL_SECONDS, user)


async def _verify_remote(token: str) -> dict[str, Any]:
    settings = get_settings()
    headers = {"Authorization": f"Bearer {token}"}
    key = settings.supabase_anon_key or settings.supabase_service_key
    if key:
        headers["apikey"] = key
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=3.0)) as client:
            resp = await client.get(f"{settings.supabase_url}/auth/v1/user", headers=headers)
    except httpx.HTTPError as exc:
        log.warning("Supabase auth unreachable: %s", exc.__class__.__name__)
        raise HTTPException(
            status_code=503,
            detail="Cannot verify your session: the auth service is unreachable. Try again shortly.",
        ) from exc
    if resp.status_code == 200:
        try:
            data = resp.json()
        except ValueError as exc:
            raise HTTPException(status_code=501, detail="Unexpected response from the auth service.") from exc
        return _legacy_user({"id": data.get("id"), "sub": data.get("sub"), "email": data.get("email")})
    if resp.status_code in (401, 403):
        raise HTTPException(status_code=401, detail="Invalid or expired session. Sign in again.")
    log.warning("Supabase auth returned %s", resp.status_code)
    raise HTTPException(status_code=501, detail="Unexpected response from the auth service.")


async def _verify_legacy_bearer(token: str) -> dict[str, Any]:
    settings = get_settings()
    secret = settings.supabase_jwt_secret
    if secret:
        try:
            claims = jwt.decode(token, secret, algorithms=["HS256"], options={"require": ["exp", "sub"]})
            return _legacy_user(claims)
        except jwt.ExpiredSignatureError as exc:
            raise HTTPException(status_code=401, detail="Your session expired. Sign in again.") from exc
        except jwt.PyJWTError:
            if not settings.supabase_url:
                raise HTTPException(status_code=401, detail="Invalid session token. Sign in again.") from None
            try:
                jwt.get_unverified_header(token)
            except jwt.PyJWTError:
                raise HTTPException(status_code=401, detail="Invalid session token. Sign in again.") from None
    user = _cached(token)
    if user is None:
        user = await _verify_remote(token)
        _remember(token, user)
    return user


# ── Dependencies ─────────────────────────────────────────────────────────────

async def optional_user(request: Request) -> dict[str, Any] | None:
    """Return the signed-in user, or None when this deployment is open.

    A configured deployment with no valid credential raises 401; it never
    fails open. Public catalogue endpoints do not use this dependency.
    """
    if not auth_configured():
        return None

    access = request.cookies.get(ACCESS_COOKIE)
    if access:
        try:
            claims = decode_access_token(access)
        except jwt.ExpiredSignatureError as exc:
            # Let the client refresh. Do not accept an expired token for any
            # endpoint that uses this dependency.
            raise HTTPException(status_code=401, detail="Your session expired. Refresh and try again.") from exc
        except jwt.PyJWTError as exc:
            raise HTTPException(status_code=401, detail="Invalid session. Sign in again.") from exc
        # Platform tokens carry a server-side session id. Checking it makes
        # logout, refresh reuse detection and password changes effective
        # immediately rather than after the access token's short lifetime.
        sid = str(claims.get("sid") or "")
        if sid:
            from app.services import platform_store  # local import avoids a cycle

            active = await platform_store.session_active(sid)
            if active is False:
                raise HTTPException(status_code=401, detail="Your session was revoked. Sign in again.")
        return _claims_user(claims)

    header = request.headers.get("Authorization", "")
    bearer = header.removeprefix("Bearer ").strip() if header.startswith("Bearer ") else ""
    if bearer:
        # Legacy Supabase token compatibility. The modern browser flow never
        # sends this header.
        return await _verify_legacy_bearer(bearer)

    raise HTTPException(status_code=401, detail=SIGN_IN_REQUIRED)


async def current_user(request: Request) -> dict[str, Any]:
    user = await optional_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail=SIGN_IN_REQUIRED)
    return user


async def admin_user(user: Annotated[dict[str, Any], Depends(current_user)]) -> dict[str, Any]:
    """Authorise an administrator from the database, not from the JWT alone.

    A role downgrade therefore takes effect immediately, and hiding a button in
    the frontend is never the control.
    """
    from app.services import db  # local import avoids a cycle at module import

    record = db.get_user(user["id"])
    if record and record.get("role") == "admin":
        user["role"] = "admin"
        return user
    # Supabase-federated or legacy token: check the canonical Supabase role.
    if user.get("provider") == "supabase":
        from app.services import supabase_store

        role = await supabase_store.profile_role(user["id"])
        if role == "admin":
            user["role"] = "admin"
            return user
    raise HTTPException(status_code=403, detail="Administrator access is required.")


OptionalUser = Annotated[dict[str, Any] | None, Depends(optional_user)]
CurrentUser = Annotated[dict[str, Any], Depends(current_user)]
AdminUser = Annotated[dict[str, Any], Depends(admin_user)]
