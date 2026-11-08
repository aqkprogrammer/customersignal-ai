"""Admin authentication — separate cookie, separate table, MFA (TOTP), lockout, audit-logged."""

from __future__ import annotations

from datetime import timedelta

import pyotp
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ADMIN_COOKIE, ADMIN_PERMISSIONS, AdminContext, get_current_admin
from app.api.v1.serializers import iso
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AppError, Forbidden, Unauthorized
from app.core.rate_limit import client_ip, hit, limiter
from app.core.security import (
    decrypt_secret,
    encrypt_secret,
    generate_token,
    hash_password,
    hash_token,
    password_strength_errors,
    utcnow,
    verify_password,
)
from app.models import AdminSession, AdminUser
from app.services.activity import audit

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


class AdminLoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)
    mfa_code: str | None = Field(default=None, max_length=10)


class MfaIn(BaseModel):
    code: str = Field(min_length=6, max_length=10)


class BootstrapIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=200)
    full_name: str = Field(default="Super Admin", max_length=200)
    bootstrap_secret: str


def admin_out(a: AdminUser) -> dict:
    return {"id": str(a.id), "email": a.email, "full_name": a.full_name, "role": a.role, "mfa_enabled": a.mfa_enabled,
            "is_active": a.is_active, "last_login_at": iso(a.last_login_at),
            "permissions": sorted(ADMIN_PERMISSIONS.get(a.role, set()))}


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(ADMIN_COOKIE, token, max_age=settings.admin_session_ttl_hours * 3600, httponly=True,
                        secure=settings.secure_cookies, samesite="strict", path="/", domain=settings.cookie_domain)


@router.post("/login", dependencies=[Depends(limiter("admin-login", 10, 300))])
async def login(body: AdminLoginIn, request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> dict:
    await hit(f"admin-login-email:{body.email.lower()}", 8, 900)
    admin = await db.scalar(select(AdminUser).where(AdminUser.email == body.email.lower()))
    ip, ua = client_ip(request), request.headers.get("user-agent")
    if admin and admin.locked_until and admin.locked_until > utcnow():
        raise Forbidden("Account temporarily locked after failed attempts. Try again later.", code="admin_locked")
    if not admin or not admin.is_active or not verify_password(body.password, admin.password_hash if admin else None):
        if admin:
            admin.failed_login_count += 1
            if admin.failed_login_count >= 5:
                admin.locked_until = utcnow() + timedelta(minutes=15)
                admin.failed_login_count = 0
        await audit(db, admin_id=admin.id if admin else None, admin_email=body.email.lower(), action="admin.login_failed",
                    ip=ip, user_agent=ua)
        await db.commit()
        raise Unauthorized("Incorrect email or password.", code="invalid_credentials")
    if admin.mfa_enabled:
        if not body.mfa_code:
            return {"status": "mfa_required"}
        secret = decrypt_secret(admin.mfa_secret_encrypted or "")
        if not secret or not pyotp.TOTP(secret).verify(body.mfa_code.replace(" ", ""), valid_window=1):
            await audit(db, admin_id=admin.id, admin_email=admin.email, action="admin.mfa_failed", ip=ip, user_agent=ua)
            await db.commit()
            raise Unauthorized("Invalid authentication code.", code="invalid_mfa")
    admin.failed_login_count = 0
    admin.last_login_at = utcnow()
    token = generate_token(40)
    db.add(AdminSession(admin_id=admin.id, token_hash=hash_token(token), ip_address=ip, user_agent=(ua or "")[:500],
                        expires_at=utcnow() + timedelta(hours=settings.admin_session_ttl_hours), mfa_verified=True))
    await audit(db, admin_id=admin.id, admin_email=admin.email, action="admin.login", ip=ip, user_agent=ua)
    _set_cookie(response, token)
    return {"status": "authenticated", "admin": admin_out(admin)}


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> dict:
    token = request.cookies.get(ADMIN_COOKIE)
    if token:
        s = await db.scalar(select(AdminSession).where(AdminSession.token_hash == hash_token(token)))
        if s:
            s.revoked_at = utcnow()
            await audit(db, admin_id=s.admin_id, admin_email=None, action="admin.logout", ip=client_ip(request))
    response.delete_cookie(ADMIN_COOKIE, path="/", domain=settings.cookie_domain)
    return {"status": "logged_out"}


@router.get("/me")
async def me(ctx: AdminContext = Depends(get_current_admin)) -> dict:
    return admin_out(ctx.admin)


@router.post("/mfa/setup")
async def mfa_setup(ctx: AdminContext = Depends(get_current_admin), db: AsyncSession = Depends(get_db)) -> dict:
    if ctx.admin.mfa_enabled:
        raise AppError("MFA is already enabled.")
    secret = pyotp.random_base32()
    ctx.admin.mfa_secret_encrypted = encrypt_secret(secret)
    uri = pyotp.TOTP(secret).provisioning_uri(name=ctx.admin.email, issuer_name="CustomerSignal AI Admin")
    return {"secret": secret, "otpauth_uri": uri}


@router.post("/mfa/enable")
async def mfa_enable(body: MfaIn, ctx: AdminContext = Depends(get_current_admin), db: AsyncSession = Depends(get_db)) -> dict:
    secret = decrypt_secret(ctx.admin.mfa_secret_encrypted or "")
    if not secret or not pyotp.TOTP(secret).verify(body.code, valid_window=1):
        raise AppError("Invalid code — check your authenticator app's time.", code="invalid_mfa")
    ctx.admin.mfa_enabled = True
    await audit(db, admin_id=ctx.admin.id, admin_email=ctx.admin.email, action="admin.mfa_enabled", ip=ctx.ip)
    return admin_out(ctx.admin)


@router.post("/mfa/disable")
async def mfa_disable(body: MfaIn, ctx: AdminContext = Depends(get_current_admin), db: AsyncSession = Depends(get_db)) -> dict:
    secret = decrypt_secret(ctx.admin.mfa_secret_encrypted or "")
    if not secret or not pyotp.TOTP(secret).verify(body.code, valid_window=1):
        raise AppError("Invalid code.", code="invalid_mfa")
    ctx.admin.mfa_enabled = False
    ctx.admin.mfa_secret_encrypted = None
    await audit(db, admin_id=ctx.admin.id, admin_email=ctx.admin.email, action="admin.mfa_disabled", ip=ctx.ip)
    return admin_out(ctx.admin)


@router.post("/bootstrap", dependencies=[Depends(limiter("admin-bootstrap", 5, 3600))])
async def bootstrap(body: BootstrapIn, request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """One-time creation of the first super-admin. Requires ADMIN_BOOTSTRAP_SECRET and ADMIN_BOOTSTRAP_EMAIL;
    refuses once any admin exists. Prefer the CLI: python -m app.scripts.bootstrap_admin"""
    import secrets as _s

    if not settings.admin_bootstrap_secret or not settings.admin_bootstrap_email:
        raise Forbidden("Admin bootstrap is not configured.", code="bootstrap_disabled")
    if await db.scalar(select(func.count()).select_from(AdminUser)):
        raise Forbidden("An administrator already exists.", code="bootstrap_closed")
    if not _s.compare_digest(body.bootstrap_secret, settings.admin_bootstrap_secret) or \
            body.email.lower() != settings.admin_bootstrap_email.lower():
        raise Forbidden("Invalid bootstrap credentials.", code="bootstrap_invalid")
    errors = password_strength_errors(body.password)
    if errors:
        raise AppError(errors[0])
    admin = AdminUser(email=body.email.lower(), full_name=body.full_name, password_hash=hash_password(body.password),
                      role="super_admin")
    db.add(admin)
    await db.flush()
    await audit(db, admin_id=admin.id, admin_email=admin.email, action="admin.bootstrap", ip=client_ip(request))
    return {"message": "Super-admin created. Sign in at /admin/login and enable MFA."}
