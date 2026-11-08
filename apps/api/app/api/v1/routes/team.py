from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_current_user, get_workspace_context, require_role
from app.api.v1.serializers import iso
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AppError, Conflict, Forbidden, NotFound
from app.core.rate_limit import hit
from app.core.security import generate_token, hash_token, utcnow
from app.models import ActivityLog, User, UserProfile, Workspace, WorkspaceInvitation, WorkspaceMember
from app.services import email_service
from app.services.activity import log_activity, notify
from app.services.entitlements import assert_member_quota, get_entitlements
from app.services.workspace_service import ROLE_RANK

router = APIRouter(prefix="/team", tags=["team"])
Role = Literal["admin", "analyst", "viewer"]


class InviteIn(BaseModel):
    email: EmailStr
    role: Role = "analyst"


class RoleIn(BaseModel):
    role: Literal["owner", "admin", "analyst", "viewer"]


class AcceptIn(BaseModel):
    token: str


@router.get("/members")
async def members(ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> dict:
    rows = (await db.execute(
        select(WorkspaceMember, User, UserProfile).join(User, User.id == WorkspaceMember.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(WorkspaceMember.workspace_id == ctx.workspace_id).order_by(WorkspaceMember.created_at))).all()
    activity = dict((await db.execute(select(ActivityLog.actor_id, func.count()).where(
        ActivityLog.workspace_id == ctx.workspace_id, ActivityLog.created_at > utcnow() - timedelta(days=30))
        .group_by(ActivityLog.actor_id))).all())
    invites = (await db.scalars(select(WorkspaceInvitation).where(WorkspaceInvitation.workspace_id == ctx.workspace_id,
                                                                  WorkspaceInvitation.status.in_(("pending", "expired")))
                                .order_by(WorkspaceInvitation.created_at.desc()))).all()
    ent = await get_entitlements(db, ctx.workspace_id)
    return {
        "members": [{"id": str(m.id), "user_id": str(u.id), "email": u.email, "full_name": p.full_name if p else "",
                     "avatar_url": p.avatar_url if p else None, "role": m.role, "joined_at": iso(m.created_at),
                     "last_active_at": iso(m.last_active_at), "actions_30d": int(activity.get(u.id, 0)),
                     "is_you": u.id == ctx.user.id} for m, u, p in rows],
        "invitations": [{"id": str(i.id), "email": i.email, "role": i.role,
                         "status": "expired" if i.expires_at < utcnow() else i.status,
                         "expires_at": iso(i.expires_at), "created_at": iso(i.created_at)} for i in invites],
        "limit": ent.limits.get("max_members"), "your_role": ctx.role,
        "team_collaboration": ent.has("team_collaboration") or (ent.limits.get("max_members") or 0) > 1,
    }


async def _send_invite(db: AsyncSession, ctx: WorkspaceContext, inv: WorkspaceInvitation) -> None:
    token = generate_token(32)
    inv.token_hash = hash_token(token)
    inv.expires_at = utcnow() + timedelta(days=7)
    inv.status = "pending"
    await email_service.send_template(db, inv.email, "team_invitation", {
        "inviter": ctx.user.profile.full_name or ctx.user.email, "workspace": ctx.workspace.name, "role": inv.role,
        "invite_url": f"{settings.app_url}/invite/{token}"})


@router.post("/invitations", status_code=201)
async def invite(body: InviteIn, ctx: WorkspaceContext = Depends(require_role("admin")),
                 db: AsyncSession = Depends(get_db)) -> dict:
    await hit(f"invite:{ctx.workspace_id}", 30, 3600)
    email = body.email.lower()
    if body.role == "admin" and ctx.role != "owner":
        raise Forbidden("Only the owner can invite admins.")
    if await db.scalar(select(WorkspaceMember.id).join(User, User.id == WorkspaceMember.user_id).where(
            WorkspaceMember.workspace_id == ctx.workspace_id, User.email == email)):
        raise Conflict("This person is already a member.")
    pending = await db.scalar(select(func.count()).select_from(WorkspaceInvitation).where(
        WorkspaceInvitation.workspace_id == ctx.workspace_id, WorkspaceInvitation.status == "pending",
        WorkspaceInvitation.expires_at > utcnow()))
    await assert_member_quota(db, ctx.workspace_id, int(pending or 0))
    inv = await db.scalar(select(WorkspaceInvitation).where(WorkspaceInvitation.workspace_id == ctx.workspace_id,
                                                            WorkspaceInvitation.email == email,
                                                            WorkspaceInvitation.status == "pending"))
    if not inv:
        inv = WorkspaceInvitation(workspace_id=ctx.workspace_id, email=email, role=body.role, token_hash="pending",
                                  invited_by_id=ctx.user.id, expires_at=utcnow())
        db.add(inv)
    inv.role = body.role
    await _send_invite(db, ctx, inv)
    await db.flush()
    await log_activity(db, ctx.workspace_id, ctx.user.id, "team.invited", "invitation", inv.id, f"Invited {email} as {body.role}")
    return {"id": str(inv.id), "email": inv.email, "role": inv.role, "status": inv.status, "expires_at": iso(inv.expires_at)}


@router.post("/invitations/{invitation_id}/resend")
async def resend(invitation_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("admin")),
                 db: AsyncSession = Depends(get_db)) -> dict:
    inv = await db.get(WorkspaceInvitation, invitation_id)
    if not inv or inv.workspace_id != ctx.workspace_id or inv.status in ("accepted", "revoked"):
        raise NotFound("Invitation not found.")
    await _send_invite(db, ctx, inv)
    return {"message": "Invitation resent."}


@router.delete("/invitations/{invitation_id}")
async def revoke(invitation_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("admin")),
                 db: AsyncSession = Depends(get_db)) -> dict:
    inv = await db.get(WorkspaceInvitation, invitation_id)
    if not inv or inv.workspace_id != ctx.workspace_id:
        raise NotFound("Invitation not found.")
    inv.status = "revoked"
    return {"message": "Invitation revoked."}


@router.patch("/members/{member_id}")
async def change_role(member_id: uuid.UUID, body: RoleIn, ctx: WorkspaceContext = Depends(require_role("admin")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    m = await db.get(WorkspaceMember, member_id)
    if not m or m.workspace_id != ctx.workspace_id:
        raise NotFound("Member not found.")
    if m.user_id == ctx.user.id:
        raise AppError("You can't change your own role.")
    # Privilege-escalation guards: only owners manage admins/ownership; nobody can modify someone above them.
    if (body.role in ("owner", "admin") or m.role in ("owner", "admin")) and ctx.role != "owner":
        raise Forbidden("Only the owner can change admin roles.")
    if body.role == "owner":
        me = await db.scalar(select(WorkspaceMember).where(WorkspaceMember.workspace_id == ctx.workspace_id,
                                                           WorkspaceMember.user_id == ctx.user.id))
        me.role = "admin"
        ws = await db.get(Workspace, ctx.workspace_id)
        ws.owner_id = m.user_id
    old = m.role
    m.role = body.role
    await notify(db, m.user_id, ctx.workspace_id, "team", f"Your role in {ctx.workspace.name} is now {body.role}")
    await log_activity(db, ctx.workspace_id, ctx.user.id, "team.role_changed", "member", m.id, f"{old} → {body.role}")
    return {"id": str(m.id), "role": m.role}


@router.delete("/members/{member_id}")
async def remove(member_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                 db: AsyncSession = Depends(get_db)) -> dict:
    m = await db.get(WorkspaceMember, member_id)
    if not m or m.workspace_id != ctx.workspace_id:
        raise NotFound("Member not found.")
    leaving = m.user_id == ctx.user.id
    if m.role == "owner":
        raise AppError("Transfer ownership before the owner can leave.", code="owner_cannot_leave")
    if not leaving:
        ctx.require("admin")
        if ROLE_RANK[m.role] >= ROLE_RANK[ctx.role]:
            raise Forbidden("You can't remove a member with an equal or higher role.")
    await db.delete(m)
    user = await db.get(User, m.user_id)
    if user and user.default_workspace_id == ctx.workspace_id:
        user.default_workspace_id = None
    await log_activity(db, ctx.workspace_id, ctx.user.id, "team.removed", "member", m.id,
                       "Left the workspace" if leaving else f"Removed {user.email if user else 'member'}")
    return {"message": "Left workspace." if leaving else "Member removed."}


@router.get("/invitations/preview/{token}")
async def preview(token: str, db: AsyncSession = Depends(get_db)) -> dict:
    inv = await db.scalar(select(WorkspaceInvitation).where(WorkspaceInvitation.token_hash == hash_token(token)))
    if not inv or inv.status != "pending" or inv.expires_at < utcnow():
        raise NotFound("This invitation is invalid or has expired.")
    ws = await db.get(Workspace, inv.workspace_id)
    return {"workspace_name": ws.name if ws else "", "email": inv.email, "role": inv.role, "expires_at": iso(inv.expires_at)}


@router.post("/invitations/accept")
async def accept(body: AcceptIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    inv = await db.scalar(select(WorkspaceInvitation).where(WorkspaceInvitation.token_hash == hash_token(body.token)))
    if not inv or inv.status != "pending" or inv.expires_at < utcnow():
        raise NotFound("This invitation is invalid or has expired.")
    if inv.email.lower() != user.email.lower():
        raise Forbidden(f"This invitation was sent to {inv.email}. Sign in with that email to accept it.",
                        code="invitation_email_mismatch")
    existing = await db.scalar(select(WorkspaceMember).where(WorkspaceMember.workspace_id == inv.workspace_id,
                                                             WorkspaceMember.user_id == user.id))
    if not existing:
        db.add(WorkspaceMember(workspace_id=inv.workspace_id, user_id=user.id, role=inv.role))
    inv.status, inv.accepted_at = "accepted", utcnow()
    user.default_workspace_id = inv.workspace_id
    if user.email_verified_at is None:
        user.email_verified_at = utcnow()
    await log_activity(db, inv.workspace_id, user.id, "team.joined", "member", user.id, f"{user.email} joined as {inv.role}")
    return {"workspace_id": str(inv.workspace_id)}
