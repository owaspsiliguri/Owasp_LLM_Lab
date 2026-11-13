"""Backend-owned authentication endpoints.

The browser never receives a token in JavaScript. The access and refresh
tokens are HttpOnly cookies; the CSRF cookie is readable and mirrored in the
``X-CSRF-Token`` header for state-changing requests.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from app.config import get_settings
from app.core import auth
from app.services import auth_service, platform_store

router = APIRouter(prefix="/auth", tags=["auth"])
_login_hits: dict[str, deque[float]] = defaultdict(deque)


class LoginBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class RegisterBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=120)


class PasswordBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(default="", max_length=256)
    new_password: str = Field(min_length=8, max_length=128)


class ResetBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)


class ProfileBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str | None = Field(default=None, max_length=120)


def _login_allowed(request: Request) -> bool:
    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window = _login_hits[client]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= get_settings().login_rate_limit_per_minute:
        return False
    window.append(now)
    return True


@router.get("/config")
async def config() -> dict[str, Any]:
    return {
        "enabled": auth.auth_required(),
        "mode": auth.auth_mode(),
        "local": auth.local_auth_configured(),
        "supabase": auth.supabase_auth_configured(),
        "registration": auth.auth_configured(),
        "access_minutes": get_settings().access_token_minutes,
    }


@router.get("/csrf")
async def csrf(request: Request, response: Response) -> dict[str, str]:
    token = auth.ensure_csrf(response, request.cookies.get(auth.CSRF_COOKIE))
    return {"csrf_token": token}


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response) -> dict[str, Any]:
    if not _login_allowed(request):
        raise HTTPException(status_code=429, detail="Too many sign-in attempts. Wait a minute and try again.")
    user = await auth_service.login(body.email, body.password, request, response)
    return {"user": user}


@router.post("/register")
async def register(body: RegisterBody, request: Request, response: Response) -> dict[str, Any]:
    if not _login_allowed(request):
        raise HTTPException(status_code=429, detail="Too many account attempts. Wait a minute and try again.")
    result = await auth_service.register(body.email, body.password, body.full_name, request, response)
    return result


@router.post("/refresh")
async def refresh(request: Request, response: Response) -> dict[str, Any]:
    user = await auth_service.refresh_session(request, response)
    return {"user": user}


@router.post("/logout")
async def logout(request: Request, response: Response) -> dict[str, bool]:
    await auth_service.logout(request, response)
    return {"ok": True}


@router.get("/me")
async def me(user: auth.OptionalUser) -> dict[str, Any]:
    if user is None:
        return {"user": None, "auth_required": False}
    return {"user": await auth_service.me(user), "auth_required": True}


@router.patch("/profile")
async def profile(body: ProfileBody, user: auth.CurrentUser) -> dict[str, Any]:
    name = (body.full_name or "").strip()[:120] or None
    await platform_store.update_user_name(user["id"], name)
    return {"user": await auth_service.me(user)}


@router.post("/password")
async def change_password(body: PasswordBody, user: auth.CurrentUser, response: Response) -> dict[str, bool]:
    await auth_service.change_password(user, body.current_password, body.new_password)
    # Every session is revoked after a password change; clear this browser too.
    auth.clear_auth_cookies(response)
    return {"ok": True, "signed_out": True}


@router.post("/password-reset")
async def password_reset(body: ResetBody) -> dict[str, str]:
    return await auth_service.request_password_reset(body.email)


@router.get("/sessions")
async def sessions(user: auth.CurrentUser) -> dict[str, Any]:
    """A compact, non-sensitive summary of the current session.

    The API deliberately does not enumerate refresh-token hashes or IP hashes.
    """
    return {
        "current": {
            "id": user.get("sid"),
            "provider": user.get("provider"),
            "role": user.get("role"),
        }
    }
