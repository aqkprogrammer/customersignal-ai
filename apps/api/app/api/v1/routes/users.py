"""Profile, preferences, onboarding, password change, data export and account deletion."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.serializers import iso, project_out, user_out, workspace_out
from app.core.database import get_db
from app.core.errors import AppError, Conflict, Unauthorized
from app.core.security import hash_password, password_strength_errors, utcnow, verify_password
from app.models import Lead, Project, Report, Review, User, UserProfile, Workspace, WorkspaceMember
from app.schemas.auth import ChangePasswordIn
from app.services import auth_service
from app.services.activity import log_activity
from app.services.workspace_service import user_workspaces

router = APIRouter(prefix="/users", tags=["users"])


class ProfileIn(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    company_name: str | None = Field(default=None, max_length=200)
    job_title: str | None = Field(default=None, max_length=200)
    timezone: str | None = Field(default=None, max_length=64)
    avatar_url: str | None = Field(default=None, max_length=1000)
    marketing_opt_in: bool | None = None


class PrefsIn(BaseModel):
    notification_preferences: dict[str, dict[str, bool]]


class OnboardingIn(BaseModel):
    step: int = Field(ge=1, le=7)
    data: dict[str, Any] = {}
    complete: bool = False


class DeleteAccountIn(BaseModel):
    password: str | None = None
    confirm: str


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)) -> dict:
    return user_out(user)


@router.patch("/me")
async def update_me(body: ProfileIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    profile = user.profile
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.flush()
    return user_out(user)


@router.put("/me/notification-preferences")
async def update_prefs(body: PrefsIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    allowed = {"analysis_completed", "report_ready", "monitoring_alert", "team", "billing", "product_updates"}
    prefs = dict(user.profile.notification_preferences or {})
    for key, channels in body.notification_preferences.items():
        if key in allowed:
            prefs[key] = {"in_app": bool(channels.get("in_app", True)), "email": bool(channels.get("email", False))}
    user.profile.notification_preferences = prefs
    await db.flush()
    return user_out(user)


@router.post("/me/password")
async def change_password(body: ChangePasswordIn, request: Request, response: Response,
                          user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    if user.password_hash and not verify_password(body.current_password or "", user.password_hash):
        raise Unauthorized("Current password is incorrect.", code="invalid_credentials")
    errors = password_strength_errors(body.new_password)
    if errors:
        raise AppError(errors[0], code="weak_password")
    user.password_hash = hash_password(body.new_password)
    await auth_service.revoke_all_sessions(db, user.id)
    await auth_service.start_session(db, user, request, response, remember=True)
    return {"message": "Password updated. Other sessions were signed out."}


@router.get("/me/onboarding")
async def get_onboarding(user: User = Depends(get_current_user)) -> dict:
    p = user.profile
    return {"step": p.onboarding_step, "data": p.onboarding_data, "completed": p.onboarding_completed_at is not None}


@router.put("/me/onboarding")
async def save_onboarding(body: OnboardingIn, user: User = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)) -> dict:
    """Persist onboarding progress; apply company info / goals / sources to the default workspace."""
    p: UserProfile = user.profile
    p.onboarding_data = {**(p.onboarding_data or {}), **body.data}
    p.onboarding_step = max(p.onboarding_step, body.step)
    d = p.onboarding_data
    ws = await db.get(Workspace, user.default_workspace_id) if user.default_workspace_id else None
    if ws:
        if d.get("business_type"):
            ws.business_type = str(d["business_type"])[:64]
        for f in ("industry", "country", "city", "website", "company_size"):
            if d.get(f):
                setattr(ws, f, str(d[f])[:500])
        if d.get("company_name"):
            ws.name = str(d["company_name"])[:200]
            p.company_name = ws.name
        if isinstance(d.get("goals"), list):
            ws.goals = [str(g)[:80] for g in d["goals"]][:10]
        if isinstance(d.get("preferred_sources"), list):
            ws.preferred_sources = [str(s)[:80] for s in d["preferred_sources"]][:10]
    if body.complete:
        p.onboarding_completed_at = p.onboarding_completed_at or utcnow()
    await db.flush()
    return {"step": p.onboarding_step, "data": p.onboarding_data, "completed": p.onboarding_completed_at is not None}


@router.get("/me/export")
async def export_data(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    """GDPR-style export of the user's personal data and owned workspace content metadata."""
    workspaces = await user_workspaces(db, user.id)
    owned_ids = [ws.id for ws, role in workspaces if role == "owner"]
    projects = (await db.scalars(select(Project).where(Project.workspace_id.in_(owned_ids)))).all() if owned_ids else []
    reports = (await db.scalars(select(Report).where(Report.created_by_id == user.id))).all()
    leads = (await db.scalars(select(Lead).where(Lead.created_by_id == user.id))).all()
    review_count = await db.scalar(select(func.count()).select_from(Review).where(Review.workspace_id.in_(owned_ids))) \
        if owned_ids else 0
    return {
        "exported_at": iso(utcnow()), "user": user_out(user),
        "workspaces": [workspace_out(ws, role) for ws, role in workspaces],
        "projects": [project_out(p) for p in projects],
        "reports": [{"id": str(r.id), "title": r.title, "type": r.report_type, "created_at": iso(r.created_at)} for r in reports],
        "leads": [{"id": str(ld.id), "business_name": ld.business_name, "status": ld.status} for ld in leads],
        "review_count_in_owned_workspaces": int(review_count or 0),
        "note": "Review datasets can be exported per project from Review Intelligence → Export.",
    }


@router.delete("/me")
async def delete_account(body: DeleteAccountIn, response: Response, user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)) -> dict:
    if body.confirm != "DELETE":
        raise AppError("Type DELETE to confirm.", code="confirmation_required")
    if user.password_hash and not verify_password(body.password or "", user.password_hash):
        raise Unauthorized("Password is incorrect.", code="invalid_credentials")
    owned = (await db.scalars(select(Workspace).where(Workspace.owner_id == user.id, Workspace.deleted_at.is_(None)))).all()
    for ws in owned:
        others = await db.scalar(select(func.count()).select_from(WorkspaceMember).where(
            WorkspaceMember.workspace_id == ws.id, WorkspaceMember.user_id != user.id))
        if others and not ws.is_demo:
            raise Conflict(f"Transfer ownership of '{ws.name}' or remove its members before deleting your account.",
                           code="owns_shared_workspace")
    now = utcnow()
    for ws in owned:
        ws.deleted_at = now
        await log_activity(db, ws.id, user.id, "workspace.deleted", "workspace", ws.id, "Deleted with owner account")
    user.deleted_at = now
    user.email = f"deleted+{user.id}@deleted.invalid"
    user.google_sub = None
    user.password_hash = None
    if user.profile:
        user.profile.full_name = "Deleted user"
        user.profile.avatar_url = None
    await db.execute(WorkspaceMember.__table__.delete().where(WorkspaceMember.user_id == user.id))
    await auth_service.revoke_all_sessions(db, user.id)
    auth_service.clear_session_cookies(response)
    return {"message": "Your account has been deleted."}
