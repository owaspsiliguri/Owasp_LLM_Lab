"""Security headers and an in-process sliding-window rate limiter."""
from __future__ import annotations

import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cache-Control": "no-store",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        for key, value in SECURITY_HEADERS.items():
            response.headers.setdefault(key, value)
        return response


class CSRFMiddleware(BaseHTTPMiddleware):
    """Double-submit CSRF protection for cookie-authenticated writes.

    Login, registration, refresh and password-reset are origin-checked but do
    not require a pre-existing CSRF pair (there may be no session yet). Bearer
    clients are exempt because the browser does not attach their credentials
    automatically.
    """

    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
    EXEMPT = {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
        "/api/auth/csrf",
        "/api/auth/password-reset",
    }

    async def dispatch(self, request, call_next):
        from app.core import auth as auth_core

        path = request.url.path
        if request.method in self.SAFE_METHODS or not path.startswith("/api"):
            return await call_next(request)
        if not auth_core.origin_allowed(request):
            return JSONResponse({"detail": "Cross-origin request rejected."}, status_code=403)
        if path in self.EXEMPT:
            return await call_next(request)
        if request.headers.get("Authorization", "").startswith("Bearer "):
            return await call_next(request)
        if not auth_core.cookie_auth_present(request):
            # Open local mode has no cookies, and unauthenticated writes will be
            # rejected by the route dependency where authentication is enabled.
            return await call_next(request)
        if not auth_core.csrf_valid(request):
            return JSONResponse({"detail": "Missing or invalid CSRF token. Refresh the page and retry."}, status_code=403)
        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, per_minute: int) -> None:
        super().__init__(app)
        self.per_minute = per_minute
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request, call_next):
        path = request.url.path
        if path.startswith("/api/") and path != "/api/health":
            client = request.client.host if request.client else "unknown"
            now = time.monotonic()
            window = self.hits[client]
            while window and now - window[0] > 60:
                window.popleft()
            if len(window) >= self.per_minute:
                return JSONResponse({"detail": "Rate limit exceeded. Retry in a minute."}, status_code=429)
            window.append(now)
        return await call_next(request)
