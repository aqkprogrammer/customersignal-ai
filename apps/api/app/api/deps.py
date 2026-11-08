"""Authentication, tenant resolution and authorization dependencies. All checks happen server-side."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta

from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import Forbidden, Unauthorized
from app.core.security import decode_access_token, hash_token, utcnow
from app.models import AdminSession, AdminUser, User, UserSession, Workspace, WorkspaceMember
from app.services.workspace_service import ROLE_RANK

ACCESS_COOKIE = "cs_access"
ADMIN_COOKIE = "cs_admin"


@dataclass
class WorkspaceContext:
    user: User
    workspace: Workspace
    role: str

    @property
    def workspace_id(self) -> uuid.UUID:
        return self.workspace.id

    def require(self, min_role: str) -> None:
        if ROLE_RANK[self.role] < ROLE_RANK[min_role]:
            raise Forbidden(f"This action requires the {min_role} role or higher.", code="insufficient_role")


def _bearer(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = request.cookies.get(ACCESS_COOKIE) or _bearer(request)
    if not token:
        raise Unauthorized("Authentication required.")
    payload = decode_access_token(token, "user")
    if not payload:
        raise Unauthorized("Session expired.", code="token_expired")
    try:
        user_id = uuid.UUID(payload["sub"])
        session_id = uuid.UUID(payload["sid"])
    except (KeyError, ValueError):
        raise Unauthorized("Invalid session.")
    session = await db.get(UserSession, session_id)
    if not session or session.revoked_at or session.user_id != user_id or session.expires_at < utcnow():
        raise Unauthorized("Session revoked.", code="session_revoked")
    user = await db.get(User, user_id)
    if not user or user.deleted_at:
        raise Unauthorized("Account not found.")
    if user.status != "active":
        raise Forbidden(f"Your account is {user.status}. Contact support.", code=f"account_{user.status}")
    now = utcnow()
    if not user.last_active_at or now - user.last_active_at > timedelta(minutes=5):
        user.last_active_at = now
    request.state.user_id = user.id
    request.state.session_id = session_id
    return user


async def get_workspace_context(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    x_workspace_id: str | None = Header(default=None),
) -> WorkspaceContext:
    ws_id_raw = x_workspace_id or request.query_params.get("workspace_id")
    try:
        ws_id = uuid.UUID(ws_id_raw) if ws_id_raw else user.default_workspace_id
    except ValueError:
        raise Forbidden("Invalid workspace.")
    if ws_id is None:
        raise Forbidden("No workspace selected.", code="no_workspace")
    row = (
        await db.execute(
            select(Workspace, WorkspaceMember)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .where(Workspace.id == ws_id, WorkspaceMember.user_id == user.id, Workspace.deleted_at.is_(None))
        )
    ).first()
    if not row:
        # Same response for "doesn't exist" and "not a member": no tenant enumeration.
        raise Forbidden("You don't have access to this workspace.", code="workspace_forbidden")
    ws, member = row
    if ws.status != "active":
        raise Forbidden("This workspace is suspended. Contact support.", code="workspace_suspended")
    now = utcnow()
    if not member.last_active_at or now - member.last_active_at > timedelta(minutes=5):
        member.last_active_at = now
    return WorkspaceContext(user=user, workspace=ws, role=member.role)


def require_role(min_role: str):
    async def _dep(ctx: WorkspaceContext = Depends(get_workspace_context)) -> WorkspaceContext:
        ctx.require(min_role)
        return ctx

    return _dep


# ---------------------------------------------------------------------------------------------- admin
ADMIN_PERMISSIONS: dict[str, set[str]] = {
    "super_admin": {"*"},
    "support_admin": {
        "dashboard.read", "users.read", "users.manage", "users.notify", "workspaces.read", "workspaces.manage",
        "projects.read", "reports.read", "support.read", "support.manage", "announcements.manage",
        "notifications.manage", "integrations.read", "jobs.read", "jobs.manage", "ai_usage.read",
        "analytics.read", "audit.read",
    },
    "billing_admin": {
        "dashboard.read", "users.read", "workspaces.read", "subscriptions.read", "subscriptions.manage",
        "payments.read", "revenue.read", "plans.read", "plans.manage", "analytics.read", "ai_usage.read",
    },
    "read_only": {
        "dashboard.read", "users.read", "workspaces.read", "subscriptions.read", "payments.read", "revenue.read",
        "plans.read", "ai_usage.read", "projects.read", "reports.read", "integrations.read", "jobs.read",
        "support.read", "audit.read", "analytics.read", "settings.read", "flags.read", "email_templates.read",
    },
}


def admin_can(role: str, permission: str) -> bool:
    perms = ADMIN_PERMISSIONS.get(role, set())
    return "*" in perms or permission in perms


@dataclass
class AdminContext:
    admin: AdminUser
    session: AdminSession
    ip: str | None
    user_agent: str | None


async def get_current_admin(request: Request, db: AsyncSession = Depends(get_db)) -> AdminContext:
    token = request.cookies.get(ADMIN_COOKIE)
    if not token:
        raise Unauthorized("Admin authentication required.", code="admin_auth_required")
    session = await db.scalar(select(AdminSession).where(AdminSession.token_hash == hash_token(token)))
    if not session or session.revoked_at or session.expires_at < utcnow():
        raise Unauthorized("Admin session expired.", code="admin_session_expired")
    admin = await db.get(AdminUser, session.admin_id)
    if not admin or not admin.is_active:
        raise Unauthorized("Admin account disabled.", code="admin_disabled")
    if admin.mfa_enabled and not session.mfa_verified:
        raise Unauthorized("MFA verification required.", code="mfa_required")
    from app.core.rate_limit import client_ip

    return AdminContext(admin=admin, session=session, ip=client_ip(request),
                        user_agent=request.headers.get("user-agent"))


def require_admin(permission: str):
    async def _dep(ctx: AdminContext = Depends(get_current_admin)) -> AdminContext:
        if not admin_can(ctx.admin.role, permission):
            raise Forbidden("Your admin role does not allow this action.", code="admin_forbidden")
        return ctx

    return _dep
