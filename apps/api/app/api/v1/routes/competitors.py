from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_workspace_context, require_role
from app.api.v1.routes.projects import get_project
from app.api.v1.serializers import iso, job_out
from app.core.database import get_db
from app.core.errors import AppError, Conflict, NotFound
from app.core.security import utcnow
from app.models import AIAnalysisResult, Business, Competitor, Review
from app.services import analytics
from app.services.activity import log_activity
from app.services.entitlements import require_feature
from app.services.intelligence import competitor_comparison
from app.workers.jobs import create_job, enqueue

router = APIRouter(prefix="/competitors", tags=["competitors"])


class CompetitorIn(BaseModel):
    project_id: uuid.UUID
    name: str = Field(min_length=2, max_length=200)
    website: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)
    positioning: str | None = Field(default=None, max_length=200)


class CompetitorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    website: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=2000)
    positioning: str | None = Field(default=None, max_length=200)


@router.get("")
async def list_competitors(project_id: uuid.UUID | None = None, ctx: WorkspaceContext = Depends(get_workspace_context),
                           db: AsyncSession = Depends(get_db)) -> list[dict]:
    q = select(Competitor, Business).join(Business, Business.id == Competitor.business_id).where(
        Competitor.workspace_id == ctx.workspace_id, Competitor.deleted_at.is_(None), Business.deleted_at.is_(None))
    if project_id:
        q = q.where(Competitor.project_id == project_id)
    rows = (await db.execute(q.order_by(Business.name))).all()
    counts = dict((await db.execute(select(Review.business_id, func.count()).where(
        Review.business_id.in_([b.id for _, b in rows]), Review.deleted_at.is_(None)).group_by(Review.business_id))).all()) if rows else {}
    out = []
    for c, b in rows:
        stats = await analytics.kpis(db, analytics.Filters(ctx.workspace_id, c.project_id, b.id))
        out.append({"id": str(c.id), "business_id": str(b.id), "project_id": str(c.project_id), "name": b.name,
                    "website": b.website, "city": b.city, "notes": c.notes, "positioning": c.positioning,
                    "review_count": int(counts.get(b.id, 0)), "avg_rating": stats["avg_rating"],
                    "negative_pct": stats["negative_pct"], "positive_pct": stats["positive_pct"],
                    "is_demo": c.is_demo, "created_at": iso(c.created_at)})
    return out


@router.post("", status_code=201)
async def add(body: CompetitorIn, ctx: WorkspaceContext = Depends(require_role("analyst")),
              db: AsyncSession = Depends(get_db)) -> dict:
    await require_feature(db, ctx.workspace_id, "competitor_comparison")
    project = await get_project(db, ctx, body.project_id)
    existing = await db.scalar(select(Business).where(Business.project_id == project.id, Business.name == body.name.strip(),
                                                      Business.deleted_at.is_(None)))
    if existing and existing.is_primary:
        raise Conflict("That is the project's own business.")
    if existing and await db.scalar(select(Competitor.id).where(Competitor.business_id == existing.id,
                                                                Competitor.deleted_at.is_(None))):
        raise Conflict("This competitor already exists in the project.")
    biz = existing or Business(workspace_id=ctx.workspace_id, project_id=project.id, name=body.name.strip(),
                               website=body.website, city=body.city or project.city, country=project.country,
                               industry=project.industry, is_primary=False)
    if not existing:
        db.add(biz)
        await db.flush()
    comp = Competitor(workspace_id=ctx.workspace_id, project_id=project.id, business_id=biz.id, notes=body.notes,
                      positioning=body.positioning)
    db.add(comp)
    await db.flush()
    await log_activity(db, ctx.workspace_id, ctx.user.id, "competitor.added", "project", project.id,
                       f"Added competitor {biz.name}")
    return {"id": str(comp.id), "business_id": str(biz.id), "name": biz.name}


@router.patch("/{competitor_id}")
async def update(competitor_id: uuid.UUID, body: CompetitorUpdate, ctx: WorkspaceContext = Depends(require_role("analyst")),
                 db: AsyncSession = Depends(get_db)) -> dict:
    comp = await db.get(Competitor, competitor_id)
    if not comp or comp.workspace_id != ctx.workspace_id or comp.deleted_at:
        raise NotFound("Competitor not found.")
    biz = await db.get(Business, comp.business_id)
    data = body.model_dump(exclude_unset=True)
    for k in ("name", "website"):
        if k in data and biz:
            setattr(biz, k, data.pop(k))
    for k, v in data.items():
        setattr(comp, k, v)
    return {"id": str(comp.id), "name": biz.name if biz else None}


@router.delete("/{competitor_id}")
async def remove(competitor_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                 db: AsyncSession = Depends(get_db)) -> dict:
    comp = await db.get(Competitor, competitor_id)
    if not comp or comp.workspace_id != ctx.workspace_id or comp.deleted_at:
        raise NotFound("Competitor not found.")
    comp.deleted_at = utcnow()
    biz = await db.get(Business, comp.business_id)
    if biz:
        biz.deleted_at = utcnow()
    return {"message": "Competitor removed."}


@router.get("/comparison")
async def comparison(project_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                     db: AsyncSession = Depends(get_db)) -> dict:
    await get_project(db, ctx, project_id)
    comp = await competitor_comparison(db, project_id)
    # Monthly sentiment trend per business for trend tracking.
    trends = {}
    for c in comp:
        series = await analytics.volume_over_time(db, analytics.Filters(ctx.workspace_id, project_id,
                                                                        uuid.UUID(c["business_id"])))
        trends[c["business_id"]] = [{"period": s["period"], "avg_rating": s["avg_rating"],
                                     "negative_pct": round(100 * s["negative"] / s["total"], 1) if s["total"] else 0}
                                    for s in series]
    latest = await db.scalar(select(AIAnalysisResult).where(AIAnalysisResult.project_id == project_id,
                                                            AIAnalysisResult.kind == "competitor_analysis")
                             .order_by(AIAnalysisResult.created_at.desc()))
    return {"businesses": comp, "trends": trends,
            "analysis": {"payload": latest.payload, "provider": latest.provider, "created_at": iso(latest.created_at),
                         "is_demo": latest.is_demo} if latest else None}


@router.post("/analyze", status_code=202)
async def analyze(project_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                  db: AsyncSession = Depends(get_db)) -> dict:
    await require_feature(db, ctx.workspace_id, "competitor_comparison")
    project = await get_project(db, ctx, project_id)
    if len(await competitor_comparison(db, project.id)) < 2:
        raise AppError("Add at least one competitor and upload its reviews first.", code="no_competitors")
    job = await create_job(db, job_type="competitor_analysis", workspace_id=ctx.workspace_id, project_id=project.id,
                           user_id=ctx.user.id)
    await db.commit()
    await enqueue(job.id)
    return job_out(job)


_ = date
