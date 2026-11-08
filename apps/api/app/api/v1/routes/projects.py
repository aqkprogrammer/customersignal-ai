from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_workspace_context, require_role
from app.api.v1.serializers import project_out
from app.core.database import get_db
from app.core.errors import NotFound
from app.core.security import utcnow
from app.models import Business, Project, Review
from app.schemas.common import Pagination, page
from app.services.activity import log_activity
from app.services.analysis_service import project_stats
from app.services.entitlements import assert_project_quota

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    industry: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=120)
    website: HttpUrl | None = None
    business_name: str | None = Field(default=None, max_length=200)
    data_source: Literal["csv", "excel", "manual", "api", "integration"] = "csv"


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    industry: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=120)
    website: HttpUrl | None = None
    business_name: str | None = Field(default=None, max_length=200)
    data_source: Literal["csv", "excel", "manual", "api", "integration"] | None = None


async def get_project(db: AsyncSession, ctx: WorkspaceContext, project_id: uuid.UUID) -> Project:
    """Tenant-isolated project lookup."""
    project = await db.get(Project, project_id)
    if not project or project.workspace_id != ctx.workspace_id or project.deleted_at:
        raise NotFound("Project not found.")
    return project


@router.get("")
async def list_projects(
    q: str | None = None, status: Literal["active", "archived", "all"] = "active", industry: str | None = None,
    kind: str | None = None, sort: Literal["created_desc", "created_asc", "name", "updated"] = "created_desc",
    p: Pagination = Depends(), ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(Project).where(Project.workspace_id == ctx.workspace_id, Project.deleted_at.is_(None))
    if status == "active":
        stmt = stmt.where(Project.status != "archived")
    elif status == "archived":
        stmt = stmt.where(Project.status == "archived")
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Project.name.ilike(like), Project.business_name.ilike(like), Project.city.ilike(like)))
    if industry:
        stmt = stmt.where(Project.industry == industry)
    if kind:
        stmt = stmt.where(Project.kind == kind)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    order = {"created_desc": Project.created_at.desc(), "created_asc": Project.created_at.asc(),
             "name": func.lower(Project.name).asc(), "updated": Project.updated_at.desc()}[sort]
    rows = (await db.scalars(stmt.order_by(order).offset(p.offset).limit(p.page_size))).all()
    counts = dict((await db.execute(select(Review.project_id, func.count()).where(
        Review.project_id.in_([r.id for r in rows]), Review.deleted_at.is_(None)).group_by(Review.project_id))).all()) if rows else {}
    return page([project_out(r, {"total": int(counts.get(r.id, 0))}) for r in rows], int(total or 0), p)


@router.post("", status_code=201)
async def create_project(body: ProjectIn, ctx: WorkspaceContext = Depends(require_role("analyst")),
                         db: AsyncSession = Depends(get_db)) -> dict:
    await assert_project_quota(db, ctx.workspace_id)
    data = body.model_dump()
    data["website"] = str(body.website) if body.website else None
    project = Project(workspace_id=ctx.workspace_id, created_by_id=ctx.user.id, **data)
    db.add(project)
    await db.flush()
    db.add(Business(workspace_id=ctx.workspace_id, project_id=project.id, name=project.business_name or project.name,
                    website=project.website, industry=project.industry, country=project.country, city=project.city,
                    is_primary=True))
    await log_activity(db, ctx.workspace_id, ctx.user.id, "project.created", "project", project.id,
                       f"Created project {project.name}")
    return project_out(project, {"total": 0})


@router.get("/{project_id}")
async def get_one(project_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                  db: AsyncSession = Depends(get_db)) -> dict:
    project = await get_project(db, ctx, project_id)
    businesses = (await db.scalars(select(Business).where(Business.project_id == project.id,
                                                          Business.deleted_at.is_(None)))).all()
    out = project_out(project, await project_stats(db, project.id))
    out["businesses"] = [{"id": str(b.id), "name": b.name, "is_primary": b.is_primary, "entity_type": b.entity_type}
                         for b in businesses]
    return out


@router.patch("/{project_id}")
async def update_project(project_id: uuid.UUID, body: ProjectUpdate, ctx: WorkspaceContext = Depends(require_role("analyst")),
                         db: AsyncSession = Depends(get_db)) -> dict:
    project = await get_project(db, ctx, project_id)
    data = body.model_dump(exclude_unset=True)
    if "website" in data:
        data["website"] = str(body.website) if body.website else None
    old_business = project.business_name or project.name
    for k, v in data.items():
        setattr(project, k, v)
    if "business_name" in data or "name" in data:
        primary = await db.scalar(select(Business).where(Business.project_id == project.id, Business.is_primary.is_(True)))
        new_name = project.business_name or project.name
        if primary and primary.name == old_business:
            primary.name = new_name
    await log_activity(db, ctx.workspace_id, ctx.user.id, "project.updated", "project", project.id,
                       f"Updated {', '.join(data)}")
    return project_out(project)


@router.post("/{project_id}/archive")
async def archive(project_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                  db: AsyncSession = Depends(get_db)) -> dict:
    project = await get_project(db, ctx, project_id)
    project.status, project.archived_at = "archived", utcnow()
    await log_activity(db, ctx.workspace_id, ctx.user.id, "project.archived", "project", project.id, "Archived project")
    return project_out(project)


@router.post("/{project_id}/unarchive")
async def unarchive(project_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                    db: AsyncSession = Depends(get_db)) -> dict:
    project = await get_project(db, ctx, project_id)
    project.status, project.archived_at = "active", None
    await log_activity(db, ctx.workspace_id, ctx.user.id, "project.restored", "project", project.id, "Restored project")
    return project_out(project)


@router.delete("/{project_id}")
async def delete(project_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("admin")),
                 db: AsyncSession = Depends(get_db)) -> dict:
    project = await get_project(db, ctx, project_id)
    project.deleted_at = utcnow()
    await log_activity(db, ctx.workspace_id, ctx.user.id, "project.deleted", "project", project.id,
                       f"Deleted project {project.name}")
    return {"message": "Project deleted."}


@router.get("/{project_id}/businesses")
async def businesses(project_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                     db: AsyncSession = Depends(get_db), with_stats: bool = Query(False)) -> list[dict]:
    project = await get_project(db, ctx, project_id)
    rows = (await db.scalars(select(Business).where(Business.project_id == project.id, Business.deleted_at.is_(None))
                             .order_by(Business.is_primary.desc(), Business.name))).all()
    out = []
    for b in rows:
        item = {"id": str(b.id), "name": b.name, "is_primary": b.is_primary, "entity_type": b.entity_type,
                "website": b.website, "city": b.city}
        if with_stats:
            item["stats"] = await project_stats(db, project.id, b.id)
        out.append(item)
    return out
