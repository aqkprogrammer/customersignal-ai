from __future__ import annotations

import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.serializers import user_out, workspace_out
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AppError, ServiceUnavailable
from app.core.rate_limit import client_ip, hit, limiter
from app.core.security import sign_value, unsign_value, utcnow
from app.models import User, UserSession
from app.schemas.auth import EmailIn, LoginIn, ResetIn, SignupIn, TokenIn
from app.services import auth_service
from app.services.workspace_service import user_workspaces

router = APIRouter(prefix="/auth", tags=["auth"])
GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"
OAUTH_STATE_COOKIE = "cs_oauth_state"


def _safe_next(value: str | None) -> str:
    """Only allow same-site relative redirects (prevents open redirects)."""
    if value and value.startswith("/") and not value.startswith("//") and "\\" not in value:
        return value
    return "/app"


async def _session_payload(db: AsyncSession, user: User) -> dict:
    workspaces = await user_workspaces(db, user.id)
    return {"user": user_out(user), "workspaces": [workspace_out(ws, role) for ws, role in workspaces]}


@router.post("/signup", status_code=201, dependencies=[Depends(limiter("signup", 10, 3600))])
async def signup(body: SignupIn, request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> dict:
    user = await auth_service.signup(db, email=body.email, password=body.password, full_name=body.full_name,
                                     company_name=body.company_name, accept_terms=body.accept_terms)
    if user.email_verified_at is None:
        return {"status": "verification_required", "email": user.email}
    await auth_service.start_session(db, user, request, response, remember=True)
    return {"status": "authenticated", **await _session_payload(db, user)}


@router.post("/login", dependencies=[Depends(limiter("login", 20, 300))])
async def login(body: LoginIn, request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> dict:
    await hit(f"login-email:{body.email.lower()}", 10, 900)  # per-account brute-force protection
    user = await auth_service.authenticate(db, body.email, body.password)
    await auth_service.start_session(db, user, request, response, remember=body.remember)
    return {"status": "authenticated", **await _session_payload(db, user)}


@router.post("/refresh", dependencies=[Depends(limiter("refresh", 60, 60))])
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> dict:
    user = await auth_service.refresh_session(db, request, response)
    return {"status": "refreshed", "user_id": str(user.id)}


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> dict:
    from app.core.security import decode_access_token, hash_token

    token = request.cookies.get(auth_service.ACCESS_COOKIE)
    payload = decode_access_token(token, "user") if token else None
    if payload and payload.get("sid"):
        import uuid

        await auth_service.revoke_session(db, uuid.UUID(payload["sid"]))
    elif request.cookies.get(auth_service.REFRESH_COOKIE):
        s = await db.scalar(select(UserSession).where(
            UserSession.refresh_token_hash == hash_token(request.cookies[auth_service.REFRESH_COOKIE])))
        if s:
            s.revoked_at = utcnow()
    auth_service.clear_session_cookies(response)
    return {"status": "logged_out"}


@router.get("/me")
async def me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    return await _session_payload(db, user)


@router.post("/verify-email")
async def verify_email(body: TokenIn, request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> dict:
    user = await auth_service.verify_email(db, body.token)
    await auth_service.start_session(db, user, request, response, remember=True)
    return {"status": "verified", **await _session_payload(db, user)}


@router.post("/resend-verification", dependencies=[Depends(limiter("resend", 5, 3600))])
async def resend_verification(body: EmailIn, db: AsyncSession = Depends(get_db)) -> dict:
    user = await db.scalar(select(User).where(User.email == auth_service.normalize_email(body.email),
                                              User.deleted_at.is_(None)))
    if user and user.email_verified_at is None:
        await auth_service.send_verification(db, user)
    return {"message": "If the account exists and is unverified, we've sent a new verification link."}


@router.post("/forgot-password", dependencies=[Depends(limiter("forgot", 5, 900))])
async def forgot_password(body: EmailIn, db: AsyncSession = Depends(get_db)) -> dict:
    await auth_service.forgot_password(db, body.email)
    return {"message": "If an account exists for that email, a reset link is on its way."}


@router.post("/reset-password", dependencies=[Depends(limiter("reset", 10, 900))])
async def reset_password(body: ResetIn, response: Response, db: AsyncSession = Depends(get_db)) -> dict:
    await auth_service.reset_password(db, body.token, body.password)
    auth_service.clear_session_cookies(response)
    return {"message": "Your password has been reset. Sign in with your new password."}


@router.get("/sessions")
async def list_sessions(request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.scalars(select(UserSession).where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None),
                                                       UserSession.expires_at > utcnow())
                             .order_by(UserSession.last_used_at.desc()))).all()
    current = getattr(request.state, "session_id", None)
    return [{"id": str(s.id), "user_agent": s.user_agent, "ip_address": s.ip_address, "current": s.id == current,
             "created_at": s.created_at.isoformat(), "last_used_at": s.last_used_at.isoformat() if s.last_used_at else None}
            for s in rows]


@router.delete("/sessions/{session_id}")
async def revoke_session(session_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    import uuid

    s = await db.get(UserSession, uuid.UUID(session_id))
    if s and s.user_id == user.id:
        s.revoked_at = utcnow()
    return {"status": "revoked"}


# ------------------------------------------------------------------------------------------- Google OAuth
@router.get("/google/start", dependencies=[Depends(limiter("google", 30, 300))])
async def google_start(next: str | None = Query(default=None)) -> RedirectResponse:
    if not settings.google_oauth_enabled:
        raise ServiceUnavailable("Google sign-in is not configured.", code="google_not_configured")
    state = secrets.token_urlsafe(24)
    params = {
        "client_id": settings.google_client_id, "response_type": "code", "scope": "openid email profile",
        "redirect_uri": f"{settings.app_url}/api/v1/auth/google/callback", "state": state, "prompt": "select_account",
        "access_type": "online",
    }
    resp = RedirectResponse(f"{GOOGLE_AUTH}?{urlencode(params)}", status_code=302)
    resp.set_cookie(OAUTH_STATE_COOKIE, sign_value(f"{state}|{_safe_next(next)}"), max_age=600, httponly=True,
                    secure=settings.secure_cookies, samesite="lax", path="/api/v1/auth/google")
    return resp


@router.get("/google/callback")
async def google_callback(request: Request, code: str | None = None, state: str | None = None,
                          error: str | None = None, db: AsyncSession = Depends(get_db)) -> RedirectResponse:
    def fail(reason: str) -> RedirectResponse:
        r = RedirectResponse(f"{settings.app_url}/auth/callback?error={reason}", status_code=302)
        r.delete_cookie(OAUTH_STATE_COOKIE, path="/api/v1/auth/google")
        return r

    if error:
        return fail("access_denied" if error == "access_denied" else "oauth_error")
    raw = unsign_value(request.cookies.get(OAUTH_STATE_COOKIE, ""))
    if not raw or not state or not code:
        return fail("invalid_state")
    expected_state, _, next_path = raw.partition("|")
    if not secrets.compare_digest(expected_state, state):
        return fail("invalid_state")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            token_resp = await client.post(GOOGLE_TOKEN, data={
                "code": code, "client_id": settings.google_client_id, "client_secret": settings.google_client_secret,
                "redirect_uri": f"{settings.app_url}/api/v1/auth/google/callback", "grant_type": "authorization_code",
            })
            if token_resp.status_code != 200:
                return fail("token_exchange_failed")
            access_token = token_resp.json().get("access_token")
            info_resp = await client.get(GOOGLE_USERINFO, headers={"Authorization": f"Bearer {access_token}"})
            if info_resp.status_code != 200:
                return fail("userinfo_failed")
            info = info_resp.json()
    except httpx.HTTPError:
        return fail("google_unreachable")
    try:
        user, created = await auth_service.upsert_google_user(
            db, sub=info["sub"], email=info.get("email", ""), email_verified=bool(info.get("email_verified")),
            name=info.get("name") or "", picture=info.get("picture"))
    except AppError as exc:
        return fail(exc.code)
    target = "/onboarding" if created or not (user.profile and user.profile.onboarding_completed_at) else next_path
    resp = RedirectResponse(f"{settings.app_url}/auth/callback?next={target}", status_code=302)
    await auth_service.start_session(db, user, request, resp, remember=True)
    resp.delete_cookie(OAUTH_STATE_COOKIE, path="/api/v1/auth/google")
    _ = client_ip(request)
    return resp


@router.get("/providers")
async def providers() -> dict:
    return {"google": settings.google_oauth_enabled, "email_password": True}
