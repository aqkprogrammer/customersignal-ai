"""Product opportunities + the Amazon 3-Star Gap Finder."""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_workspace_context, require_role
from app.api.v1.routes.projects import get_project
from app.api.v1.serializers import iso, job_out, project_out
from app.core.database import get_db
from app.core.errors import AppError, NotFound
from app.models import AIAnalysisResult, Business, ProductOpportunity, Project, Review
from app.services.activity import log_activity
from app.services.entitlements import assert_project_quota, require_feature
from app.services.intelligence import evidence_for
from app.workers.jobs import create_job, enqueue

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


class StatusIn(BaseModel):
    status: Literal["new", "planned", "in_progress", "done", "dismissed"]


class GapProjectIn(BaseModel):
    product_name: str = Field(min_length=2, max_length=200)
    product_url: str | None = Field(default=None, max_length=500)
    category: str | None = Field(default=None, max_length=120)
    competitor_product: str | None = Field(default=None, max_length=200)
    marketplace: str | None = Field(default="Amazon", max_length=80)


def opp_out(o: ProductOpportunity) -> dict:
    return {"id": str(o.id), "project_id": str(o.project_id), "title": o.title, "description": o.description,
            "recommendation": o.recommendation, "opportunity_type": o.opportunity_type, "score": o.score,
            "impact": o.impact, "effort": o.effort, "status": o.status, "source": o.source, "provider": o.provider,
            "cluster_id": str(o.cluster_id) if o.cluster_id else None,
            "evidence_count": len(o.evidence_review_ids or []), "is_demo": o.is_demo, "created_at": iso(o.created_at)}


@router.get("")
async def list_opportunities(project_id: uuid.UUID | None = None, status: str | None = None, source: str | None = None,
                             ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> list[dict]:
    q = select(ProductOpportunity).join(Project, Project.id == ProductOpportunity.project_id).where(
        ProductOpportunity.workspace_id == ctx.workspace_id, Project.deleted_at.is_(None))
    if project_id:
        q = q.where(ProductOpportunity.project_id == project_id)
    if status:
        q = q.where(ProductOpportunity.status == status)
    else:
        q = q.where(ProductOpportunity.status != "dismissed")
    if source:
        q = q.where(ProductOpportunity.source == source)
    rows = (await db.scalars(q.order_by(ProductOpportunity.score.desc()).limit(200))).all()
    return [opp_out(o) for o in rows]


@router.get("/{opportunity_id}")
async def get_opportunity(opportunity_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                          db: AsyncSession = Depends(get_db)) -> dict:
    o = await db.get(ProductOpportunity, opportunity_id)
    if not o or o.workspace_id != ctx.workspace_id:
        raise NotFound("Opportunity not found.")
    return {**opp_out(o), "evidence": await evidence_for(db, list(o.evidence_review_ids or []), o.cluster_id, 6)}


@router.patch("/{opportunity_id}")
async def set_status(opportunity_id: uuid.UUID, body: StatusIn, ctx: WorkspaceContext = Depends(require_role("analyst")),
                     db: AsyncSession = Depends(get_db)) -> dict:
    o = await db.get(ProductOpportunity, opportunity_id)
    if not o or o.workspace_id != ctx.workspace_id:
        raise NotFound("Opportunity not found.")
    o.status = body.status
    return opp_out(o)


# ------------------------------------------------------------------------------------------- Gap Finder
gap = APIRouter(prefix="/gap-finder", tags=["gap-finder"])


@gap.get("")
async def gap_projects(ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.scalars(select(Project).where(Project.workspace_id == ctx.workspace_id, Project.kind == "gap_finder",
                                                   Project.deleted_at.is_(None)).order_by(Project.created_at.desc()))).all()
    out = []
    for p in rows:
        res = await db.scalar(select(AIAnalysisResult).where(AIAnalysisResult.project_id == p.id,
                                                             AIAnalysisResult.kind == "gap_report")
                              .order_by(AIAnalysisResult.created_at.desc()))
        count = await db.scalar(select(func.count()).select_from(Review).where(Review.project_id == p.id,
                                                                               Review.deleted_at.is_(None)))
        out.append({**project_out(p, {"total": int(count or 0)}),
                    "opportunity_score": res.payload.get("opportunity_score") if res else None,
                    "last_report_at": iso(res.created_at) if res else None})
    return out


@gap.post("", status_code=201)
async def create_gap_project(body: GapProjectIn, ctx: WorkspaceContext = Depends(require_role("analyst")),
                             db: AsyncSession = Depends(get_db)) -> dict:
    await require_feature(db, ctx.workspace_id, "advanced_ai")
    await assert_project_quota(db, ctx.workspace_id)
    project = Project(workspace_id=ctx.workspace_id, name=f"Gap Finder: {body.product_name}", kind="gap_finder",
                      business_name=body.product_name, website=body.product_url, industry=body.category,
                      data_source="csv", description=f"3-star gap analysis ({body.marketplace or 'marketplace'})",
                      created_by_id=ctx.user.id)
    db.add(project)
    await db.flush()
    db.add(Business(workspace_id=ctx.workspace_id, project_id=project.id, name=body.product_name, is_primary=True,
                    entity_type="product", website=body.product_url))
    if body.competitor_product:
        db.add(Business(workspace_id=ctx.workspace_id, project_id=project.id, name=body.competitor_product,
                        is_primary=False, entity_type="product"))
    await log_activity(db, ctx.workspace_id, ctx.user.id, "gap_finder.created", "project", project.id,
                       f"Started gap analysis for {body.product_name}")
    await db.flush()
    businesses = (await db.scalars(select(Business).where(Business.project_id == project.id))).all()
    return {**project_out(project), "businesses": [{"id": str(b.id), "name": b.name, "is_primary": b.is_primary}
                                                   for b in businesses]}


@gap.post("/{project_id}/run", status_code=202)
async def run_gap(project_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                  db: AsyncSession = Depends(get_db)) -> dict:
    await require_feature(db, ctx.workspace_id, "advanced_ai")
    project = await get_project(db, ctx, project_id)
    primary = await db.scalar(select(Business).where(Business.project_id == project.id, Business.is_primary.is_(True)))
    count = await db.scalar(select(func.count()).select_from(Review).where(
        Review.business_id == (primary.id if primary else None), Review.deleted_at.is_(None)))
    if not count:
        raise AppError("Upload reviews for your product first.", code="no_reviews")
    job = await create_job(db, job_type="gap_finder", workspace_id=ctx.workspace_id, project_id=project.id,
                           user_id=ctx.user.id)
    await db.commit()
    await enqueue(job.id)
    return job_out(job)


@gap.get("/{project_id}/report")
async def gap_report(project_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                     db: AsyncSession = Depends(get_db)) -> dict:
    project = await get_project(db, ctx, project_id)
    res = await db.scalar(select(AIAnalysisResult).where(AIAnalysisResult.project_id == project.id,
                                                         AIAnalysisResult.kind == "gap_report")
                          .order_by(AIAnalysisResult.created_at.desc()))
    businesses = (await db.scalars(select(Business).where(Business.project_id == project.id,
                                                          Business.deleted_at.is_(None)))).all()
    counts = dict((await db.execute(select(Review.business_id, func.count()).where(
        Review.project_id == project.id, Review.deleted_at.is_(None)).group_by(Review.business_id))).all())
    return {
        "project": project_out(project),
        "businesses": [{"id": str(b.id), "name": b.name, "is_primary": b.is_primary,
                        "review_count": int(counts.get(b.id, 0))} for b in businesses],
        "report": {"id": str(res.id), "payload": res.payload, "provider": res.provider, "model": res.model,
                   "created_at": iso(res.created_at), "is_demo": res.is_demo} if res else None,
    }
