from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_workspace_context, require_role
from app.api.v1.routes.projects import get_project
from app.api.v1.serializers import iso, job_out, report_out
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AppError, NotFound
from app.core.security import generate_token, hash_token, utcnow
from app.core.storage import storage
from app.models import Report, ReportShare
from app.models.report import REPORT_TYPES
from app.schemas.common import Pagination, page
from app.services.activity import log_activity
from app.services.entitlements import assert_report_quota, require_feature
from app.services.report_service import default_title
from app.workers.jobs import create_job, enqueue

router = APIRouter(prefix="/reports", tags=["reports"])
FEATURE_FOR = {"competitor_intelligence": "competitor_comparison", "product_opportunity": "advanced_ai",
               "outreach_intelligence": "advanced_ai", "gap_finder": "advanced_ai", "market_research": "advanced_analytics"}


class ReportIn(BaseModel):
    report_type: Literal[REPORT_TYPES]  # type: ignore[valid-type]
    project_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=300)
    date_from: date | None = None
    date_to: date | None = None


class ShareIn(BaseModel):
    expires_in_days: int | None = Field(default=30, ge=1, le=365)


async def _report(db: AsyncSession, ctx: WorkspaceContext, report_id: uuid.UUID) -> Report:
    r = await db.get(Report, report_id)
    if not r or r.workspace_id != ctx.workspace_id or r.deleted_at:
        raise NotFound("Report not found.")
    return r


@router.get("")
async def list_reports(project_id: uuid.UUID | None = None, report_type: str | None = None, p: Pagination = Depends(),
                       ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> dict:
    q = select(Report).where(Report.workspace_id == ctx.workspace_id, Report.deleted_at.is_(None))
    if project_id:
        q = q.where(Report.project_id == project_id)
    if report_type:
        q = q.where(Report.report_type == report_type)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.scalars(q.order_by(Report.created_at.desc()).offset(p.offset).limit(p.page_size))).all()
    return page([report_out(r) for r in rows], int(total or 0), p)


@router.post("", status_code=202)
async def create_report(body: ReportIn, ctx: WorkspaceContext = Depends(require_role("analyst")),
                        db: AsyncSession = Depends(get_db)) -> dict:
    if body.report_type in FEATURE_FOR:
        await require_feature(db, ctx.workspace_id, FEATURE_FOR[body.report_type])
    if body.report_type in ("competitor_intelligence", "gap_finder", "outreach_intelligence") and not body.project_id:
        raise AppError("Select a project for this report type.", code="project_required")
    if body.date_from and body.date_to and body.date_from > body.date_to:
        raise AppError("Start date must be before end date.")
    await assert_report_quota(db, ctx.workspace_id)
    scope = None
    is_demo = ctx.workspace.is_demo
    if body.project_id:
        project = await get_project(db, ctx, body.project_id)
        scope, is_demo = project.business_name or project.name, project.is_demo
    report = Report(workspace_id=ctx.workspace_id, project_id=body.project_id, created_by_id=ctx.user.id,
                    report_type=body.report_type, title=body.title or default_title(body.report_type, scope),
                    date_from=body.date_from, date_to=body.date_to, status="pending", is_demo=is_demo)
    db.add(report)
    await db.flush()
    job = await create_job(db, job_type="generate_report", workspace_id=ctx.workspace_id, project_id=body.project_id,
                           user_id=ctx.user.id, params={"report_id": str(report.id)})
    report.job_id = job.id
    await log_activity(db, ctx.workspace_id, ctx.user.id, "report.created", "report", report.id, report.title)
    await db.commit()
    await enqueue(job.id)
    return {"report": report_out(report), "job": job_out(job)}


@router.get("/{report_id}")
async def get_report(report_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                     db: AsyncSession = Depends(get_db)) -> dict:
    r = await _report(db, ctx, report_id)
    shares = (await db.scalars(select(ReportShare).where(ReportShare.report_id == r.id).order_by(ReportShare.created_at.desc()))).all()
    return {**report_out(r, with_content=True), "job_id": str(r.job_id) if r.job_id else None,
            "shares": [{"id": str(s.id), "token_prefix": s.token_prefix, "expires_at": iso(s.expires_at),
                        "revoked": s.revoked_at is not None, "view_count": s.view_count, "created_at": iso(s.created_at)}
                       for s in shares]}


@router.get("/{report_id}/download")
async def download(report_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                   db: AsyncSession = Depends(get_db)) -> Response:
    r = await _report(db, ctx, report_id)
    if r.status != "ready" or not r.file_key:
        raise AppError("This report isn't ready yet.", code="report_not_ready")
    data = await storage.get(r.file_key)
    if data is None:
        raise NotFound("Report file is missing. Regenerate the report.")
    r.download_count += 1
    filename = "".join(c if c.isalnum() or c in "-_ " else "_" for c in r.title)[:80].strip().replace(" ", "-") or "report"
    return Response(data, media_type="application/pdf",
                    headers={"content-disposition": f'attachment; filename="{filename}.pdf"'})


@router.post("/{report_id}/regenerate", status_code=202)
async def regenerate(report_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                     db: AsyncSession = Depends(get_db)) -> dict:
    r = await _report(db, ctx, report_id)
    await assert_report_quota(db, ctx.workspace_id)
    r.status, r.error = "pending", None
    job = await create_job(db, job_type="generate_report", workspace_id=ctx.workspace_id, project_id=r.project_id,
                           user_id=ctx.user.id, params={"report_id": str(r.id)})
    r.job_id = job.id
    await db.commit()
    await enqueue(job.id)
    return {"report": report_out(r), "job": job_out(job)}


@router.post("/{report_id}/shares", status_code=201)
async def share(report_id: uuid.UUID, body: ShareIn, ctx: WorkspaceContext = Depends(require_role("analyst")),
                db: AsyncSession = Depends(get_db)) -> dict:
    r = await _report(db, ctx, report_id)
    if r.status != "ready":
        raise AppError("Only ready reports can be shared.")
    token = generate_token(24)
    s = ReportShare(report_id=r.id, workspace_id=ctx.workspace_id, token_hash=hash_token(token), token_prefix=token[:8],
                    expires_at=utcnow() + timedelta(days=body.expires_in_days) if body.expires_in_days else None,
                    created_by_id=ctx.user.id)
    db.add(s)
    await db.flush()
    await log_activity(db, ctx.workspace_id, ctx.user.id, "report.shared", "report", r.id, f"Shared {r.title}")
    return {"id": str(s.id), "url": f"{settings.app_url}/r/{token}", "expires_at": iso(s.expires_at)}


@router.delete("/{report_id}/shares/{share_id}")
async def revoke_share(report_id: uuid.UUID, share_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                       db: AsyncSession = Depends(get_db)) -> dict:
    await _report(db, ctx, report_id)
    s = await db.get(ReportShare, share_id)
    if not s or s.report_id != report_id:
        raise NotFound("Share link not found.")
    s.revoked_at = utcnow()
    return {"message": "Share link revoked."}


@router.delete("/{report_id}")
async def delete_report(report_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                        db: AsyncSession = Depends(get_db)) -> dict:
    r = await _report(db, ctx, report_id)
    r.deleted_at = utcnow()
    return {"message": "Report deleted."}
