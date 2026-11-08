"""Request logging, request ids, security headers and CSRF protection (double-submit cookie)."""

from __future__ import annotations

import logging
import secrets
import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings

log = logging.getLogger("app.request")

CSRF_COOKIE = "cs_csrf"
CSRF_HEADER = "x-csrf-token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
# Endpoints that are authenticated by other means (signatures, API keys) or establish the session.
CSRF_EXEMPT_PREFIXES = (
    "/api/v1/billing/webhook",
    "/api/v1/ingest/",
    "/api/v1/auth/login",
    "/api/v1/auth/signup",
    "/api/v1/auth/refresh",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    "/api/v1/auth/verify-email",
    "/api/v1/auth/resend-verification",
    "/api/v1/admin/auth/login",
    "/api/v1/admin/auth/bootstrap",
    "/api/v1/public/",
)


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("x-request-id") or secrets.token_hex(8)
        request.state.request_id = request_id
        start = time.perf_counter()

        # CSRF: cookie-authenticated, state-changing requests must echo the CSRF cookie in a header.
        if (
            request.method not in SAFE_METHODS
            and request.url.path.startswith("/api/")
            and not request.url.path.startswith(CSRF_EXEMPT_PREFIXES)
            and (request.cookies.get("cs_access") or request.cookies.get("cs_refresh") or request.cookies.get("cs_admin"))
        ):
            cookie = request.cookies.get(CSRF_COOKIE)
            header = request.headers.get(CSRF_HEADER)
            if not cookie or not header or not secrets.compare_digest(cookie, header):
                return JSONResponse(
                    status_code=403,
                    content={"error": {"code": "csrf_failed", "message": "Invalid or missing CSRF token.", "details": None}},
                )

        response = await call_next(request)
        duration = round((time.perf_counter() - start) * 1000, 1)
        response.headers["x-request-id"] = request_id
        response.headers.setdefault("x-content-type-options", "nosniff")
        response.headers.setdefault("x-frame-options", "DENY")
        response.headers.setdefault("referrer-policy", "strict-origin-when-cross-origin")
        if settings.is_production:
            response.headers.setdefault("strict-transport-security", "max-age=63072000; includeSubDomains")

        # Issue a CSRF cookie if the client does not have one yet (readable by JS by design).
        if not request.cookies.get(CSRF_COOKIE):
            response.set_cookie(
                CSRF_COOKIE, secrets.token_urlsafe(24), httponly=False, samesite="lax",
                secure=settings.secure_cookies, domain=settings.cookie_domain, path="/",
            )

        if request.url.path != "/health":
            log.info(
                "%s %s -> %s (%sms)", request.method, request.url.path, response.status_code, duration,
                extra={"request_id": request_id, "method": request.method, "path": request.url.path,
                       "status": response.status_code, "duration_ms": duration},
            )
        return response
