"""User authentication: email/password, Google OAuth, sessions, verification and password reset."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from fastapi import Request, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError, Conflict, Forbidden, Unauthorized
from app.core.rate_limit import client_ip
from app.core.security import (
    create_access_token,
    generate_token,
    hash_password,
    hash_token,
    password_strength_errors,
    utcnow,
    verify_password,
)
from app.models import AuthToken, User, UserProfile, UserSession
from app.services import email_service, settings_service
from app.services.workspace_service import create_workspace

ACCESS_COOKIE = "cs_access"
REFRESH_COOKIE = "cs_refresh"
SESSION_HINT_COOKIE = "cs_session"  # non-sensitive presence flag for edge route protection


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _cookie_kwargs(max_age: int | None, path: str = "/", httponly: bool = True) -> dict:
    return {"max_age": max_age, "path": path, "httponly": httponly, "secure": settings.secure_cookies,
            "samesite": "lax", "domain": settings.cookie_domain}


def set_session_cookies(response: Response, access: str, refresh: str, refresh_expires: datetime,
                        persistent: bool) -> None:
    refresh_age = int((refresh_expires - utcnow()).total_seconds()) if persistent else None
    response.set_cookie(ACCESS_COOKIE, access, **_cookie_kwargs(settings.access_token_ttl_minutes * 60))
    response.set_cookie(REFRESH_COOKIE, refresh, **_cookie_kwargs(refresh_age, path="/api/v1/auth"))
    response.set_cookie(SESSION_HINT_COOKIE, "1", **_cookie_kwargs(refresh_age, httponly=False))


def clear_session_cookies(response: Response) -> None:
    for name, path in ((ACCESS_COOKIE, "/"), (REFRESH_COOKIE, "/api/v1/auth"), (SESSION_HINT_COOKIE, "/")):
        response.delete_cookie(name, path=path, domain=settings.cookie_domain)


async def start_session(db: AsyncSession, user: User, request: Request, response: Response,
                        remember: bool = True) -> UserSession:
    refresh = generate_token(48)
    ttl = timedelta(days=settings.refresh_token_ttl_days if remember else settings.refresh_token_ttl_days_short)
    session = UserSession(
        user_id=user.id, refresh_token_hash=hash_token(refresh), user_agent=(request.headers.get("user-agent") or "")[:500],
        ip_address=client_ip(request), expires_at=utcnow() + ttl, last_used_at=utcnow(),
    )
    db.add(session)
    await db.flush()
    access = create_access_token(str(user.id), "user", {"sid": str(session.id)})
    set_session_cookies(response, access, refresh, session.expires_at, persistent=remember)
    user.last_login_at = utcnow()
    return session


async def refresh_session(db: AsyncSession, request: Request, response: Response) -> User:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise Unauthorized("No refresh token.")
    session = await db.scalar(select(UserSession).where(UserSession.refresh_token_hash == hash_token(token)))
    if not session or session.revoked_at or session.expires_at < utcnow():
        clear_session_cookies(response)
        raise Unauthorized("Session expired. Please sign in again.", code="session_expired")
    user = await db.get(User, session.user_id)
    if not user or user.deleted_at or user.status != "active":
        session.revoked_at = utcnow()
        clear_session_cookies(response)
        raise Unauthorized("Account unavailable.")
    # Rotate the refresh token on every use.
    new_refresh = generate_token(48)
    session.refresh_token_hash = hash_token(new_refresh)
    session.last_used_at = utcnow()
    access = create_access_token(str(user.id), "user", {"sid": str(session.id)})
    # "Remember me" sessions are the long-lived ones; short sessions keep browser-session cookies.
    persistent = (session.expires_at - session.created_at) > timedelta(days=settings.refresh_token_ttl_days_short, hours=1)
    set_session_cookies(response, access, new_refresh, session.expires_at, persistent=persistent)
    return user


async def revoke_session(db: AsyncSession, session_id: uuid.UUID) -> None:
    await db.execute(update(UserSession).where(UserSession.id == session_id).values(revoked_at=utcnow()))


async def revoke_all_sessions(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(UserSession).where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )


async def _issue_token(db: AsyncSession, user: User, purpose: str, ttl: timedelta) -> str:
    await db.execute(
        update(AuthToken).where(AuthToken.user_id == user.id, AuthToken.purpose == purpose,
                                AuthToken.used_at.is_(None)).values(used_at=utcnow())
    )
    token = generate_token(32)
    db.add(AuthToken(user_id=user.id, purpose=purpose, token_hash=hash_token(token), expires_at=utcnow() + ttl))
    await db.flush()
    return token


async def _consume_token(db: AsyncSession, token: str, purpose: str) -> User:
    row = await db.scalar(select(AuthToken).where(AuthToken.token_hash == hash_token(token), AuthToken.purpose == purpose))
    if not row or row.used_at or row.expires_at < utcnow():
        raise AppError("This link is invalid or has expired.", code="invalid_token")
    row.used_at = utcnow()
    user = await db.get(User, row.user_id)
    if not user or user.deleted_at:
        raise AppError("This link is invalid or has expired.", code="invalid_token")
    return user


async def send_verification(db: AsyncSession, user: User) -> None:
    token = await _issue_token(db, user, "verify_email", timedelta(hours=48))
    name = user.profile.full_name if user.profile else ""
    await email_service.send_template(
        db, user.email, "verify_email",
        {"name": name or "there", "verify_url": f"{settings.app_url}/verify-email?token={token}"},
    )


async def signup(db: AsyncSession, *, email: str, password: str, full_name: str, company_name: str | None,
                 accept_terms: bool) -> User:
    if not await settings_service.get(db, "registration_enabled"):
        raise Forbidden("New registrations are currently closed.", code="registration_closed")
    if not accept_terms:
        raise AppError("You must accept the terms of service.", code="terms_required")
    errors = password_strength_errors(password)
    if errors:
        raise AppError(errors[0], code="weak_password")
    email = normalize_email(email)
    if await db.scalar(select(User.id).where(User.email == email, User.deleted_at.is_(None))):
        raise Conflict("An account with this email already exists. Try signing in.", code="email_taken")
    user = User(email=email, password_hash=hash_password(password))
    db.add(user)
    await db.flush()
    db.add(UserProfile(user_id=user.id, full_name=full_name.strip(), company_name=company_name,
                       terms_accepted_at=utcnow(), notification_preferences=default_notification_prefs()))
    await db.flush()
    await db.refresh(user, ["profile"])
    await create_workspace(db, user, company_name or f"{full_name.split(' ')[0]}'s Workspace")
    verification_required = await settings_service.get(db, "email_verification_required")
    if verification_required and settings.email_verification_required:
        await send_verification(db, user)
    else:
        user.email_verified_at = utcnow()
    return user


def default_notification_prefs() -> dict:
    return {"analysis_completed": {"in_app": True, "email": True}, "report_ready": {"in_app": True, "email": False},
            "monitoring_alert": {"in_app": True, "email": True}, "team": {"in_app": True, "email": True},
            "billing": {"in_app": True, "email": True}, "product_updates": {"in_app": True, "email": False}}


async def authenticate(db: AsyncSession, email: str, password: str) -> User:
    user = await db.scalar(select(User).where(User.email == normalize_email(email), User.deleted_at.is_(None)))
    if not user or not verify_password(password, user.password_hash if user else None):
        raise Unauthorized("Incorrect email or password.", code="invalid_credentials")
    if user.status != "active":
        raise Forbidden(f"Your account is {user.status}. Contact support.", code=f"account_{user.status}")
    if user.email_verified_at is None and settings.email_verification_required and \
            await settings_service.get(db, "email_verification_required"):
        raise Forbidden("Please verify your email address before signing in.", code="email_not_verified")
    return user


async def verify_email(db: AsyncSession, token: str) -> User:
    user = await _consume_token(db, token, "verify_email")
    if user.email_verified_at is None:
        user.email_verified_at = utcnow()
        await email_service.send_template(
            db, user.email, "welcome",
            {"name": user.profile.full_name if user.profile else "", "app_url": f"{settings.app_url}/app"},
        )
    return user


async def forgot_password(db: AsyncSession, email: str) -> None:
    user = await db.scalar(select(User).where(User.email == normalize_email(email), User.deleted_at.is_(None)))
    if not user or user.status != "active":
        return  # do not reveal whether the account exists
    token = await _issue_token(db, user, "reset_password", timedelta(hours=1))
    await email_service.send_template(db, user.email, "reset_password",
                                      {"reset_url": f"{settings.app_url}/reset-password?token={token}"})


async def reset_password(db: AsyncSession, token: str, password: str) -> User:
    errors = password_strength_errors(password)
    if errors:
        raise AppError(errors[0], code="weak_password")
    user = await _consume_token(db, token, "reset_password")
    user.password_hash = hash_password(password)
    if user.email_verified_at is None:
        user.email_verified_at = utcnow()  # possession of the inbox proves ownership
    await revoke_all_sessions(db, user.id)
    return user


async def upsert_google_user(db: AsyncSession, *, sub: str, email: str, email_verified: bool, name: str,
                             picture: str | None) -> tuple[User, bool]:
    """Find-or-create a user for a Google identity. Returns (user, created). Never creates duplicates."""
    if not email_verified:
        raise AppError("Your Google account email is not verified.", code="google_email_unverified")
    email = normalize_email(email)
    user = await db.scalar(select(User).where(User.google_sub == sub))
    if user is None:
        user = await db.scalar(select(User).where(User.email == email, User.deleted_at.is_(None)))
        if user is not None:
            user.google_sub = sub  # link Google to the existing (same, Google-verified) email account
            if user.email_verified_at is None:
                user.email_verified_at = utcnow()
    if user is not None:
        if user.deleted_at:
            raise Forbidden("This account has been deleted.")
        if user.status != "active":
            raise Forbidden(f"Your account is {user.status}. Contact support.", code=f"account_{user.status}")
        if user.profile and picture and not user.profile.avatar_url:
            user.profile.avatar_url = picture
        return user, False
    if not await settings_service.get(db, "registration_enabled"):
        raise Forbidden("New registrations are currently closed.", code="registration_closed")
    user = User(email=email, google_sub=sub, email_verified_at=utcnow())
    db.add(user)
    await db.flush()
    db.add(UserProfile(user_id=user.id, full_name=name, avatar_url=picture, terms_accepted_at=utcnow(),
                       notification_preferences=default_notification_prefs()))
    await db.flush()
    await db.refresh(user, ["profile"])
    first = (name or email).split(" ")[0]
    await create_workspace(db, user, f"{first}'s Workspace")
    await email_service.send_template(db, email, "welcome", {"name": name, "app_url": f"{settings.app_url}/app"})
    return user, True
