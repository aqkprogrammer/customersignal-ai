from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_current_user, get_workspace_context, require_role
from app.api.v1.serializers import iso, workspace_out
from app.core.database import get_db
from app.core.errors import AppError, Conflict, Forbidden, NotFound
from app.core.security import utcnow
from app.models import ActivityLog, ReviewCategory, User, UserProfile, WorkspaceMember
from app.services.activity import log_activity
from app.services.entitlements import assert_workspace_quota, get_entitlements, require_feature
from app.services.workspace_service import create_workspace, slugify, user_workspaces

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class WorkspaceIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    industry: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=120)
    website: str | None = Field(default=None, max_length=500)


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    industry: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=120)
    website: str | None = Field(default=None, max_length=500)
    company_size: str | None = Field(default=None, max_length=40)
    data_retention_days: int | None = Field(default=None, ge=30, le=3650)


class BrandingIn(BaseModel):
    logo_url: str | None = Field(default=None, max_length=1000)
    primary_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    keywords: list[str] = Field(default_factory=list, max_length=40)


@router.get("")
async def list_workspaces(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[dict]:
    return [workspace_out(ws, role) for ws, role in await user_workspaces(db, user.id)]


@router.post("", status_code=201)
async def create(body: WorkspaceIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    await assert_workspace_quota(db, user.id)
    ws = await create_workspace(db, user, body.name, industry=body.industry, country=body.country, city=body.city,
                                website=body.website)
    await log_activity(db, ws.id, user.id, "workspace.created", "workspace", ws.id, f"Created workspace {ws.name}")
    return workspace_out(ws, "owner")


@router.post("/demo", status_code=201)
async def demo(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    """Create (or return) the user's DEMO workspace: synthetic sample reviews, fully analyzed, clearly labelled."""
    from app.services.demo_service import create_demo_workspace

    ws = await create_demo_workspace(db, user)
    return workspace_out(ws, "owner")


@router.get("/current")
async def current(ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> dict:
    ent = await get_entitlements(db, ctx.workspace_id)
    return {**workspace_out(ctx.workspace, ctx.role), "entitlements": ent.to_dict()}


@router.patch("/current")
async def update(body: WorkspaceUpdate, ctx: WorkspaceContext = Depends(require_role("admin")),
                 db: AsyncSession = Depends(get_db)) -> dict:
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ctx.workspace, k, v)
    await log_activity(db, ctx.workspace_id, ctx.user.id, "workspace.updated", "workspace", ctx.workspace_id,
                       "Updated workspace settings")
    return workspace_out(ctx.workspace, ctx.role)


@router.put("/current/branding")
async def branding(body: BrandingIn, ctx: WorkspaceContext = Depends(require_role("admin")),
                   db: AsyncSession = Depends(get_db)) -> dict:
    await require_feature(db, ctx.workspace_id, "custom_branding")
    ctx.workspace.branding = {**(ctx.workspace.branding or {}), **body.model_dump(exclude_unset=True)}
    return workspace_out(ctx.workspace, ctx.role)


@router.post("/{workspace_id}/default")
async def set_default(workspace_id: uuid.UUID, user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)) -> dict:
    member = await db.scalar(select(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id,
                                                           WorkspaceMember.user_id == user.id))
    if not member:
        raise Forbidden("You don't have access to this workspace.")
    user.default_workspace_id = workspace_id
    return {"default_workspace_id": str(workspace_id)}


@router.delete("/current")
async def delete_workspace(ctx: WorkspaceContext = Depends(require_role("owner")), db: AsyncSession = Depends(get_db)) -> dict:
    owned = [ws for ws, role in await user_workspaces(db, ctx.user.id) if role == "owner" and not ws.is_demo]
    if len(owned) <= 1 and not ctx.workspace.is_demo:
        raise Conflict("You can't delete your only workspace. Delete your account instead.", code="last_workspace")
    ctx.workspace.deleted_at = utcnow()
    if ctx.user.default_workspace_id == ctx.workspace_id:
        ctx.user.default_workspace_id = next((ws.id for ws in owned if ws.id != ctx.workspace_id), None)
    await log_activity(db, ctx.workspace_id, ctx.user.id, "workspace.deleted", "workspace", ctx.workspace_id,
                       "Deleted workspace")
    return {"message": "Workspace deleted."}


@router.get("/current/activity")
async def activity(entity_id: uuid.UUID | None = None, limit: int = 50,
                   ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> list[dict]:
    q = (select(ActivityLog, UserProfile.full_name).outerjoin(UserProfile, UserProfile.user_id == ActivityLog.actor_id)
         .where(ActivityLog.workspace_id == ctx.workspace_id))
    if entity_id:
        q = q.where(ActivityLog.entity_id == entity_id)
    rows = (await db.execute(q.order_by(ActivityLog.created_at.desc()).limit(min(limit, 200)))).all()
    return [{"id": str(a.id), "action": a.action, "entity_type": a.entity_type,
             "entity_id": str(a.entity_id) if a.entity_id else None, "summary": a.summary, "actor": name,
             "created_at": iso(a.created_at)} for a, name in rows]


# ---------------------------------------------------------------------------------------- custom categories
@router.get("/current/categories")
async def categories(ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.scalars(select(ReviewCategory).where(
        (ReviewCategory.workspace_id.is_(None)) | (ReviewCategory.workspace_id == ctx.workspace_id))
        .order_by(ReviewCategory.is_custom, ReviewCategory.name))).all()
    return [{"id": str(c.id), "slug": c.slug, "name": c.name, "description": c.description, "keywords": c.keywords,
             "is_custom": c.is_custom} for c in rows]


@router.post("/current/categories", status_code=201)
async def add_category(body: CategoryIn, ctx: WorkspaceContext = Depends(require_role("analyst")),
                       db: AsyncSession = Depends(get_db)) -> dict:
    slug = re.sub(r"-", "_", slugify(body.name))[:60]
    if await db.scalar(select(ReviewCategory.id).where(ReviewCategory.slug == slug, (
            ReviewCategory.workspace_id.is_(None)) | (ReviewCategory.workspace_id == ctx.workspace_id))):
        raise Conflict("A category with this name already exists.")
    cat = ReviewCategory(workspace_id=ctx.workspace_id, slug=slug, name=body.name, description=body.description,
                         keywords=[k.strip().lower() for k in body.keywords if k.strip()][:40], is_custom=True)
    db.add(cat)
    await db.flush()
    return {"id": str(cat.id), "slug": cat.slug, "name": cat.name, "description": cat.description,
            "keywords": cat.keywords, "is_custom": True}


@router.delete("/current/categories/{category_id}")
async def delete_category(category_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                          db: AsyncSession = Depends(get_db)) -> dict:
    cat = await db.get(ReviewCategory, category_id)
    if not cat or cat.workspace_id != ctx.workspace_id:
        raise NotFound("Category not found.")
    if not cat.is_custom:
        raise AppError("Built-in categories can't be deleted.")
    await db.delete(cat)
    return {"message": "Category deleted."}
