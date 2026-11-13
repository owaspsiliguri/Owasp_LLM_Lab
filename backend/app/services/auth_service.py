"""Authentication flows: local accounts, Supabase federation and sessions."""
from __future__ import annotations

import hashlib
import logging
import re
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import HTTPException, Request, Response

from app.config import get_settings
from app.core import auth
from app.core.passwords import PasswordPolicyError, hash_password, validate_password, verify_password
from app.services import db, platform_store, supabase_store

log = logging.getLogger("lab.auth.service")

EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")


def normalise_email(value: str) -> str:
    email = (value or "").strip().lower()
    if len(email) > 254 or not EMAIL_RE.fullmatch(email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    return email


def public_user(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record["id"],
        "email": record["email"],
        "full_name": record.get("full_name") or "",
        "role": record.get("role") or "student",
        "created_at": record.get("created_at"),
        "provider": record.get("provider") or "local",
    }


def _client_host(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _ip_hash(request: Request) -> str:
    return hashlib.sha256(_client_host(request).encode()).hexdigest()[:32]


# ── Session issuance ─────────────────────────────────────────────────────────

async def issue_session(user: dict[str, Any], request: Request, response: Response) -> dict[str, Any]:
    raw_refresh, refresh_hash = auth.new_refresh_token()
    session_id = await platform_store.create_session(
        user_id=user["id"],
        refresh_hash=refresh_hash,
        expires_at=auth.refresh_expiry_iso(),
        user_agent=(request.headers.get("User-Agent") or "")[:300],
        ip_hash=_ip_hash(request),
    )
    access = auth.create_access_token(user, session_id=session_id)
    auth.set_auth_cookies(response, access_token=access, refresh_token=raw_refresh)
    return public_user(user)


async def _session_for_request(request: Request) -> dict[str, Any] | None:
    raw = request.cookies.get(auth.REFRESH_COOKIE)
    if not raw:
        return None
    return await platform_store.get_session_by_refresh(auth.hash_refresh(raw))


# ── Local accounts ───────────────────────────────────────────────────────────

def _local_login(email: str, password: str) -> dict[str, Any]:
    user = db.get_user_by_email(email)
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    if not verify_password(password, user["password_hash"]):
        db.record_auth_event("login_failed", user_id=user["id"], detail="invalid password")
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    if user["role"] == "admin" or email == get_settings().admin_email:
        if user["role"] != "admin":
            db.set_user_role(user["id"], "admin")
            user["role"] = "admin"
    db.touch_login(user["id"])
    db.record_auth_event("login", user_id=user["id"])
    return user


def _local_register(email: str, password: str, full_name: str | None) -> dict[str, Any]:
    try:
        validate_password(password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if db.get_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with that email already exists.")
    role = "admin" if email == get_settings().admin_email else "student"
    try:
        user = db.create_user(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            role=role,
            provider="local",
        )
    except Exception as exc:  # sqlite uniqueness race
        log.warning("Registration failed: %s", exc.__class__.__name__)
        raise HTTPException(status_code=409, detail="An account with that email already exists.") from exc
    db.record_auth_event("register", user_id=user["id"])
    return user


# ── Supabase federation ──────────────────────────────────────────────────────

def _supabase_headers() -> dict[str, str]:
    settings = get_settings()
    key = settings.supabase_anon_key or settings.supabase_service_key
    return {"apikey": key, "Content-Type": "application/json"}


async def _supabase_json(method: str, path: str, body: dict[str, Any] | None = None, *, token: str | None = None) -> tuple[int, dict[str, Any] | None]:
    settings = get_settings()
    headers = _supabase_headers()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
            response = await client.request(
                method,
                f"{settings.supabase_url}{path}",
                headers=headers,
                json=body,
            )
    except httpx.HTTPError as exc:
        log.warning("Supabase auth request failed: %s", exc.__class__.__name__)
        raise HTTPException(status_code=503, detail="The authentication service is unreachable. Try again shortly.") from exc
    try:
        data = response.json() if response.content else None
    except ValueError:
        data = None
    return response.status_code, data


async def _provision_supabase_user(payload: dict[str, Any]) -> dict[str, Any]:
    user_data = payload.get("user") or {}
    user_id = user_data.get("id")
    email = user_data.get("email") or payload.get("email")
    if not user_id or not email:
        raise HTTPException(status_code=502, detail="The authentication service returned an incomplete account.")
    metadata = user_data.get("user_metadata") or {}
    full_name = metadata.get("full_name") or metadata.get("name")
    role = await supabase_store.profile_role(str(user_id))
    if role != "admin" and str(email).lower() == get_settings().admin_email:
        role = "admin"
    return db.upsert_provider_user(
        user_id=str(user_id),
        email=str(email),
        full_name=str(full_name)[:120] if full_name else None,
        role=role,
    )


async def _supabase_login(email: str, password: str) -> dict[str, Any]:
    status, data = await _supabase_json(
        "POST",
        "/auth/v1/token?grant_type=password",
        {"email": email, "password": password},
    )
    if status in (400, 401):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    if status >= 400 or not data or not data.get("access_token"):
        log.warning("Supabase login returned %s", status)
        raise HTTPException(status_code=503, detail="The authentication service could not complete the sign-in.")
    user = await _provision_supabase_user(data)
    await platform_store.touch_login(user["id"])
    await platform_store.record_auth_event("login", user_id=user["id"], detail="supabase")
    return user


async def _supabase_register(email: str, password: str, full_name: str | None) -> dict[str, Any] | None:
    status, data = await _supabase_json(
        "POST",
        "/auth/v1/signup",
        {"email": email, "password": password, "data": {"full_name": full_name or ""}},
    )
    if status in (400, 422):
        detail = "Could not create the account. Check the email and password requirements."
        if isinstance(data, dict) and data.get("msg"):
            detail = str(data["msg"])[:200]
        raise HTTPException(status_code=422, detail=detail)
    if status >= 400 or not data:
        log.warning("Supabase signup returned %s", status)
        raise HTTPException(status_code=503, detail="The authentication service could not create the account.")
    if not data.get("access_token"):
        return None  # email confirmation is required; the user logs in later
    user = await _provision_supabase_user(data)
    await platform_store.record_auth_event("register", user_id=user["id"], detail="supabase")
    return user


# ── Public flows ─────────────────────────────────────────────────────────────

async def login(email: str, password: str, request: Request, response: Response) -> dict[str, Any]:
    address = normalise_email(email)
    if not password or len(password) > 256:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    if not auth.auth_configured():
        raise HTTPException(status_code=503, detail="Authentication is not configured on this deployment.")
    if auth.supabase_auth_configured():
        user = await _supabase_login(address, password)
    else:
        user = _local_login(address, password)
    return await issue_session(user, request, response)


async def register(
    email: str,
    password: str,
    full_name: str | None,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    address = normalise_email(email)
    try:
        validate_password(password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    name = (full_name or "").strip()[:120] or None
    if not auth.auth_configured():
        raise HTTPException(status_code=503, detail="Authentication is not configured on this deployment.")
    if auth.supabase_auth_configured():
        user = await _supabase_register(address, password, name)
        if user is None:
            return {"needs_confirmation": True, "user": None}
    else:
        user = _local_register(address, password, name)
    return {"needs_confirmation": False, "user": await issue_session(user, request, response)}


async def refresh_session(request: Request, response: Response) -> dict[str, Any]:
    raw = request.cookies.get(auth.REFRESH_COOKIE)
    if not raw:
        raise HTTPException(status_code=401, detail="No refresh session is present. Sign in again.")
    row = await platform_store.get_session_by_refresh(auth.hash_refresh(raw))
    if not row:
        raise HTTPException(status_code=401, detail="Session not recognised. Sign in again.")
    if row.get("revoked_at"):
        # Presenting a rotated or logged-out token is a reuse signal. Revoke
        # every active session for the account so a stolen token cannot keep
        # the session alive.
        await platform_store.revoke_all_for_user(row["user_id"])
        await platform_store.record_auth_event(
            "refresh_reuse", user_id=row.get("user_id"), detail="revoked refresh token presented"
        )
        auth.clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Your session was revoked. Sign in again.")
    if str(row["expires_at"]) < datetime.now(UTC).isoformat(timespec="seconds"):
        await platform_store.revoke_all_for_user(row["user_id"])
        auth.clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Your session expired. Sign in again.")
    user = await platform_store.get_user(row["user_id"])
    if not user:
        await platform_store.revoke_all_for_user(row["user_id"])
        auth.clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Account not found. Sign in again.")
    raw_new, hash_new = auth.new_refresh_token()
    new_session_id = await platform_store.rotate_session(
        row, new_hash=hash_new, new_expires_at=auth.refresh_expiry_iso()
    )
    access = auth.create_access_token(user, session_id=new_session_id)
    # Keep the caller's CSRF value stable so concurrent tabs do not invalidate
    # each other's forms. set_auth_cookies also sets a fresh value when none is
    # present, so pass the existing one through first.
    auth.set_auth_cookies(
        response,
        access_token=access,
        refresh_token=raw_new,
        existing_csrf=request.cookies.get(auth.CSRF_COOKIE),
    )
    return public_user(user)


async def logout(request: Request, response: Response) -> None:
    row = await _session_for_request(request)
    if row:
        await platform_store.revoke_all_for_user(row["user_id"])
        await platform_store.record_auth_event("logout", user_id=row.get("user_id"))
    access = request.cookies.get(auth.ACCESS_COOKIE)
    if access:
        try:
            claims = auth.decode_access_token(access)
            if claims.get("sub"):
                await platform_store.revoke_all_for_user(str(claims["sub"]))
        except Exception:  # noqa: BLE001 - clearing a bad cookie is always safe
            log.debug("Ignoring an invalid access cookie during logout")
    auth.clear_auth_cookies(response)


async def me(user: dict[str, Any]) -> dict[str, Any]:
    record = await platform_store.get_user(user["id"])
    if not record:
        return {
            "id": user["id"], "email": user["email"], "full_name": user.get("full_name") or "",
            "role": user.get("role") or "student", "created_at": None, "provider": user.get("provider") or "external",
        }
    return public_user(record)


async def change_password(user: dict[str, Any], current_password: str, new_password: str) -> None:
    try:
        validate_password(new_password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    record = await platform_store.get_user(user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="Account not found.")
    if not record.get("password_hash"):
        # Federated identities keep their credential with the identity provider.
        # Silently changing it through the service role would bypass the
        # provider's own verification, so we refuse and explain instead.
        raise HTTPException(
            status_code=400,
            detail="This password is managed by your sign-in provider. Change it there.",
        )
    if not verify_password(current_password, record["password_hash"]):
        raise HTTPException(status_code=403, detail="Current password is incorrect.")
    db.set_password(record["id"], hash_password(new_password))
    await platform_store.revoke_all_for_user(record["id"])
    await platform_store.record_auth_event("password_changed", user_id=record["id"])


async def request_password_reset(email: str) -> dict[str, Any]:
    address = normalise_email(email)
    if auth.supabase_auth_configured():
        status, _ = await _supabase_json("POST", "/auth/v1/recover", {"email": address})
        if status >= 500:
            raise HTTPException(status_code=503, detail="The authentication service is unavailable.")
    else:
        db.record_auth_event("password_reset_requested", detail="local deployment has no email delivery")
    # Always the same response: do not disclose whether the account exists.
    return {"message": "If an account exists for that address, password reset instructions will be sent."}


def bootstrap_admin() -> None:
    """Create the configured local administrator once.

    This is a development/self-hosted convenience. Supabase deployments use the
    existing profile trigger and do not need it. It never resets an existing
    password and never runs when the account already exists.
    """
    settings = get_settings()
    if auth.supabase_auth_configured():
        return
    if not settings.jwt_secret or not settings.admin_email or not settings.admin_password:
        return
    existing = db.get_user_by_email(settings.admin_email)
    if existing:
        if existing.get("role") != "admin":
            db.set_user_role(existing["id"], "admin")
        return
    try:
        validate_password(settings.admin_password)
        db.create_user(
            email=settings.admin_email,
            password_hash=hash_password(settings.admin_password),
            full_name="Local administrator",
            role="admin",
            provider="local",
        )
        log.warning("Created the configured local administrator account %s", settings.admin_email)
    except (PasswordPolicyError, ValueError) as exc:
        log.warning("Could not create the configured administrator: %s", exc.__class__.__name__)
