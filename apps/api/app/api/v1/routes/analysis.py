from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.registry import get_provider
from app.api.deps import WorkspaceContext, get_workspace_context, require_role
from app.api.v1.routes.projects import get_project
from app.api.v1.serializers import job_out
from app.core.database import get_db
from app.core.errors import AppError, Conflict, NotFound
from app.core.security import utcnow
from app.models import AIAnalysisResult, AnalysisJob, Review
from app.schemas.common import Pagination, page
from app.services import analytics
from app.services.entitlements import remaining_review_quota
from app.workers.jobs import create_job, enqueue

router = APIRouter(prefix="/analysis", tags=["analysis"])


class RunIn(BaseModel):
    project_id: uuid.UUID
    reanalyze: bool = False


@router.get("/dashboard")
async def dashboard(project_id: uuid.UUID | None = None, date_from: date | None = None, date_to: date | None = None,
                    ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> dict:
    if project_id:
        await get_project(db, ctx, project_id)
    data = await analytics.dashboard(db, analytics.Filters(ctx.workspace_id, project_id, None, date_from, date_to))
    provider = await get_provider(db)
    data["ai_provider"] = {"name": provider.name, "label": provider.label, "is_llm": provider.is_llm}
    return data


@router.post("/run", status_code=202)
async def run(body: RunIn, ctx: WorkspaceContext = Depends(require_role("analyst")), db: AsyncSession = Depends(get_db)) -> dict:
    project = await get_project(db, ctx, body.project_id)
    running = await db.scalar(select(AnalysisJob.id).where(
        AnalysisJob.project_id == project.id, AnalysisJob.job_type == "analyze_reviews",
        AnalysisJob.status.in_(("pending", "processing"))))
    if running:
        raise Conflict("An analysis is already running for this project.", code="analysis_running",
                       details={"job_id": str(running)})
    count_q = select(func.count()).select_from(Review).where(Review.project_id == project.id, Review.deleted_at.is_(None))
    if not body.reanalyze:
        count_q = count_q.where(Review.analysis_status != "analyzed")
    pending = await db.scalar(count_q)
    if not pending:
        raise AppError("There are no new reviews to analyze. Upload reviews or choose re-analyze.", code="nothing_to_analyze")
    quota = await remaining_review_quota(db, ctx.workspace_id)
    if quota == 0 and not project.is_demo:
        from app.core.errors import PaymentRequired

        raise PaymentRequired("You've reached this month's review analysis limit. Upgrade to analyze more.")
    job = await create_job(db, job_type="analyze_reviews", workspace_id=ctx.workspace_id, project_id=project.id,
                           user_id=ctx.user.id, params={"reanalyze": body.reanalyze})
    await db.commit()
    await enqueue(job.id)
    return job_out(job)


@router.get("/jobs")
async def jobs(project_id: uuid.UUID | None = None, status: str | None = None, p: Pagination = Depends(),
               ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> dict:
    q = select(AnalysisJob).where(AnalysisJob.workspace_id == ctx.workspace_id)
    if project_id:
        q = q.where(AnalysisJob.project_id == project_id)
    if status:
        q = q.where(AnalysisJob.status == status)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.scalars(q.order_by(AnalysisJob.created_at.desc()).offset(p.offset).limit(p.page_size))).all()
    return page([job_out(j) for j in rows], int(total or 0), p)


async def _job(db: AsyncSession, ctx: WorkspaceContext, job_id: uuid.UUID) -> AnalysisJob:
    job = await db.get(AnalysisJob, job_id)
    if not job or job.workspace_id != ctx.workspace_id:
        raise NotFound("Job not found.")
    return job


@router.get("/jobs/{job_id}")
async def job(job_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
              db: AsyncSession = Depends(get_db)) -> dict:
    return job_out(await _job(db, ctx, job_id))


@router.post("/jobs/{job_id}/cancel")
async def cancel(job_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                 db: AsyncSession = Depends(get_db)) -> dict:
    job = await _job(db, ctx, job_id)
    if job.status not in ("pending", "processing"):
        raise AppError("Only pending or running jobs can be cancelled.")
    job.status, job.stage, job.completed_at = "cancelled", "Cancelled", utcnow()
    return job_out(job)


@router.get("/insights")
async def insights(project_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                   db: AsyncSession = Depends(get_db)) -> dict | None:
    await get_project(db, ctx, project_id)
    r = await db.scalar(select(AIAnalysisResult).where(AIAnalysisResult.project_id == project_id,
                                                       AIAnalysisResult.kind == "project_insights")
                        .order_by(AIAnalysisResult.created_at.desc()))
    if not r:
        return None
    return {"id": str(r.id), "payload": r.payload, "provider": r.provider, "model": r.model,
            "created_at": r.created_at.isoformat(), "is_demo": r.is_demo}
