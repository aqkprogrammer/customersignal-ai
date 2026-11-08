"""Job creation, dispatch and execution. Jobs are rows in analysis_jobs; Redis/arq only carries the job id."""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.engine import AIEngine
from app.ai.providers.base import AIError
from app.core.config import settings
from app.core.database import session_scope
from app.core.errors import AppError
from app.core.redis import redis_available
from app.core.security import utcnow
from app.core.storage import storage
from app.models import AnalysisJob, Lead, Project, Report, ReviewSource
from app.services import analysis_service, intelligence, monitoring_service, report_service
from app.services.activity import notify
from app.services.entitlements import get_entitlements
from app.services.ingestion import IngestionError, insert_reviews, parse_upload
from app.services.integrations_service import deliver_webhook_event
from app.services.notification_service import notify_workspace

log = logging.getLogger("app.jobs")
_inline_tasks: set[asyncio.Task] = set()
_arq_pool = None


async def create_job(db: AsyncSession, *, job_type: str, workspace_id: uuid.UUID | None, project_id: uuid.UUID | None,
                     user_id: uuid.UUID | None, params: dict[str, Any] | None = None, max_attempts: int = 3) -> AnalysisJob:
    priority = 0
    if workspace_id:
        priority = 1 if (await get_entitlements(db, workspace_id)).has("priority_processing") else 0
    job = AnalysisJob(job_type=job_type, workspace_id=workspace_id, project_id=project_id, created_by_id=user_id,
                      params=params or {}, status="pending", stage="Queued", max_attempts=max_attempts, priority=priority)
    db.add(job)
    await db.flush()
    return job


async def _get_pool():
    global _arq_pool
    if _arq_pool is None:
        from arq import create_pool
        from arq.connections import RedisSettings

        _arq_pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    return _arq_pool


async def enqueue(job_id: uuid.UUID, defer_seconds: float = 0) -> str:
    """Dispatch after the creating transaction commits. Returns 'arq' or 'inline'."""
    if not settings.jobs_inline and await redis_available():
        try:
            pool = await _get_pool()
            await pool.enqueue_job("run_job", str(job_id), _queue_name=settings.jobs_queue_name,
                                   _defer_by=timedelta(seconds=defer_seconds) if defer_seconds else None)
            return "arq"
        except Exception as exc:  # noqa: BLE001
            log.warning("arq enqueue failed (%s); running job inline", exc)
    if settings.is_production:
        raise RuntimeError("Background worker unavailable")

    async def _later() -> None:
        if defer_seconds:
            await asyncio.sleep(defer_seconds)
        await run_job(str(job_id))

    task = asyncio.create_task(_later())
    _inline_tasks.add(task)
    task.add_done_callback(_inline_tasks.discard)
    return "inline"


# ------------------------------------------------------------------------------------------------- runner
async def run_job(job_id: str, ctx: dict | None = None) -> str:
    async with session_scope() as db:
        job = await db.get(AnalysisJob, uuid.UUID(job_id), with_for_update=True)
        if not job or job.status in ("completed", "cancelled", "failed"):
            return "skipped"
        # Standard plans: one heavy job at a time per workspace. Priority (Business+) jobs skip the line.
        if job.workspace_id and job.priority == 0 and job.job_type not in ("monitoring",):
            busy = await db.scalar(select(func.count()).select_from(AnalysisJob).where(
                AnalysisJob.workspace_id == job.workspace_id, AnalysisJob.status == "processing",
                AnalysisJob.id != job.id))
            if busy:
                job.stage = "Waiting for another job in this workspace"
                await db.commit()
                await enqueue(job.id, defer_seconds=8)
                return "deferred"
        job.status = "processing"
        job.started_at = job.started_at or utcnow()
        job.attempts += 1
        job.error = None
        await db.commit()

    async with session_scope() as db:
        job = await db.get(AnalysisJob, uuid.UUID(job_id))
        assert job is not None

        async def progress(pct: float, stage: str, processed: int = 0, total: int = 0) -> bool:
            job.progress = round(min(99.0, pct), 1)
            job.stage = stage
            if total:
                job.processed_items, job.total_items = processed, total
            await db.commit()
            await db.refresh(job, ["status"])
            return job.status != "cancelled"

        try:
            handler = HANDLERS[job.job_type]
            summary = await handler(db, job, progress)
            await db.refresh(job, ["status"])
            if job.status == "cancelled":
                await db.commit()
                return "cancelled"
            job.status = "completed"
            job.progress = 100
            job.stage = "Completed"
            job.result_summary = summary or {}
            job.completed_at = utcnow()
            await db.commit()
            return "completed"
        except Exception as exc:  # noqa: BLE001
            await db.rollback()
            retryable = isinstance(exc, (AIError, ConnectionError, TimeoutError)) and not isinstance(exc, AppError)
            job = await db.get(AnalysisJob, uuid.UUID(job_id))
            assert job is not None
            message = exc.message if isinstance(exc, AppError) else str(exc) or exc.__class__.__name__
            if not isinstance(exc, (AppError, IngestionError)):
                log.exception("Job %s (%s) failed", job_id, job.job_type)
            if retryable and job.attempts < job.max_attempts:
                job.status = "pending"
                job.stage = f"Retrying (attempt {job.attempts + 1} of {job.max_attempts})"
                job.error = message[:2000]
                await db.commit()
                await enqueue(job.id, defer_seconds=min(300, 15 * 2 ** job.attempts))
                return "retrying"
            job.status = "failed"
            job.stage = "Failed"
            job.error = message[:2000]
            job.completed_at = utcnow()
            if retryable or not isinstance(exc, (AppError, IngestionError)):
                job.dead_lettered_at = utcnow()  # exhausted retries / unexpected error -> dead-letter for admin review
            await _on_failure(db, job)
            await db.commit()
            return "failed"


async def _on_failure(db: AsyncSession, job: AnalysisJob) -> None:
    if job.job_type == "generate_report" and job.params.get("report_id"):
        report = await db.get(Report, uuid.UUID(job.params["report_id"]))
        if report:
            report.status, report.error = "failed", job.error
    if job.job_type == "opportunity_finder" and job.params.get("lead_id"):
        lead = await db.get(Lead, uuid.UUID(job.params["lead_id"]))
        if lead:
            lead.pitch_status = "failed"
    if job.job_type == "import_reviews" and job.params.get("source_id"):
        src = await db.get(ReviewSource, uuid.UUID(job.params["source_id"]))
        if src:
            src.status = "failed"
            src.errors = [*(src.errors or []), {"row": None, "error": job.error}][:50]
    if job.project_id:
        project = await db.get(Project, job.project_id)
        if project and project.status == "analyzing":
            project.status = "active"
    if job.created_by_id and job.job_type != "monitoring":
        await notify(db, job.created_by_id, job.workspace_id, "system", f"{_label(job.job_type)} failed",
                     job.error or "", "/app")


def _label(job_type: str) -> str:
    return {"import_reviews": "Review import", "analyze_reviews": "Review analysis",
            "opportunity_finder": "Opportunity analysis", "gap_finder": "Gap analysis",
            "competitor_analysis": "Competitor analysis", "generate_report": "Report generation"}.get(job_type, "Job")


async def _engine(db: AsyncSession, job: AnalysisJob) -> AIEngine:
    return await AIEngine.create(db, workspace_id=job.workspace_id, user_id=job.created_by_id, job_id=job.id)


# ------------------------------------------------------------------------------------------------ handlers
async def handle_import(db: AsyncSession, job: AnalysisJob, progress) -> dict:
    source = await db.get(ReviewSource, uuid.UUID(job.params["source_id"]))
    project = await db.get(Project, job.project_id)
    if not source or not project:
        raise AppError("Import source not found.")
    source.status = "processing"
    await progress(10, "Reading file")
    data = await storage.get(source.file_key or "")
    if data is None:
        raise AppError("Uploaded file is missing from storage.")
    from app.services import settings_service

    max_rows = int(await settings_service.get(db, "max_rows_per_upload"))
    try:
        parsed = await asyncio.to_thread(parse_upload, source.name, data, max_rows)
    except IngestionError as exc:
        source.status = "failed"
        source.errors = [{"row": None, "error": str(exc)}]
        await db.commit()
        raise AppError(str(exc), code="invalid_file")
    await progress(40, f"Validating {parsed.total} rows")
    biz_id = uuid.UUID(job.params["business_id"]) if job.params.get("business_id") else None
    inserted, dupes = await insert_reviews(db, project, parsed.rows, source_id=source.id,
                                           default_platform=source.platform, business_id=biz_id)
    source.rows_total, source.rows_imported = parsed.total, inserted
    source.rows_duplicate, source.rows_invalid = dupes, parsed.invalid
    source.errors = parsed.errors
    source.status = "completed"
    await progress(90, "Imported")
    summary = {"rows": parsed.total, "imported": inserted, "duplicates": dupes, "invalid": parsed.invalid,
               "columns": parsed.columns}
    if job.params.get("auto_analyze") and inserted:
        nxt = await create_job(db, job_type="analyze_reviews", workspace_id=job.workspace_id, project_id=project.id,
                               user_id=job.created_by_id)
        await db.commit()
        await enqueue(nxt.id)
        summary["analysis_job_id"] = str(nxt.id)
    return summary


async def handle_analyze(db: AsyncSession, job: AnalysisJob, progress) -> dict:
    project = await db.get(Project, job.project_id)
    if not project:
        raise AppError("Project not found.")
    engine = await _engine(db, job)
    result = await analysis_service.run_full_analysis(db, project, engine, progress, job.id,
                                                      reanalyze=bool(job.params.get("reanalyze")))
    if result.get("cancelled"):
        return result
    msg = f"{result['analyzed']} reviews analyzed · {result['clusters']} themes · {result['opportunities']} opportunities"
    if result.get("skipped_for_quota"):
        msg += f" · {result['skipped_for_quota']} skipped (monthly limit reached)"
    await notify_workspace(db, project.workspace_id, "analysis_completed", f"Analysis complete: {project.name}", msg,
                           f"/app/reviews?project={project.id}", email_template="account_notice",
                           email_vars={"subject": f"Analysis complete: {project.name}", "message": msg},
                           min_role="analyst")
    await deliver_webhook_event(db, project.workspace_id, "analysis.completed",
                                {"project_id": str(project.id), **{k: v for k, v in result.items() if k != "warnings"}})
    await monitoring_service.evaluate_workspace(db, project_id=project.id)
    return result


async def _ensure_analyzed(db: AsyncSession, job: AnalysisJob, project: Project, progress, engine: AIEngine) -> None:
    from app.models import Review

    pending = await db.scalar(select(func.count()).select_from(Review).where(
        Review.project_id == project.id, Review.analysis_status != "analyzed", Review.deleted_at.is_(None)))
    if pending:
        await analysis_service.run_full_analysis(db, project, engine, progress, job.id)


async def handle_opportunity_finder(db: AsyncSession, job: AnalysisJob, progress) -> dict:
    lead = await db.get(Lead, uuid.UUID(job.params["lead_id"]))
    project = await db.get(Project, job.project_id)
    if not lead or not project:
        raise AppError("Lead not found.")
    lead.pitch_status = "generating"
    engine = await _engine(db, job)

    async def scaled(pct, stage, processed=0, total=0):
        return await progress(pct * 0.8, stage, processed, total)

    await _ensure_analyzed(db, job, project, scaled, engine)
    await progress(85, "Writing outreach pack")
    await intelligence.generate_outreach(db, lead, engine, job.id)
    return {"lead_id": str(lead.id), "issues": len(lead.issues or []), "provider": engine.provider_name,
            "warnings": engine.warnings}


async def handle_gap_finder(db: AsyncSession, job: AnalysisJob, progress) -> dict:
    project = await db.get(Project, job.project_id)
    if not project:
        raise AppError("Project not found.")
    engine = await _engine(db, job)

    async def scaled(pct, stage, processed=0, total=0):
        return await progress(pct * 0.7, stage, processed, total)

    await _ensure_analyzed(db, job, project, scaled, engine)
    await progress(75, "Analyzing 3-star reviews")
    result = await intelligence.run_gap_finder(db, project, engine, job.id)
    return {**result, "provider": engine.provider_name, "warnings": engine.warnings}


async def handle_competitor(db: AsyncSession, job: AnalysisJob, progress) -> dict:
    project = await db.get(Project, job.project_id)
    if not project:
        raise AppError("Project not found.")
    engine = await _engine(db, job)

    async def scaled(pct, stage, processed=0, total=0):
        return await progress(pct * 0.75, stage, processed, total)

    await _ensure_analyzed(db, job, project, scaled, engine)
    await progress(80, "Comparing competitors")
    result = await intelligence.run_competitor_analysis(db, project, engine, job.id)
    return {**result, "provider": engine.provider_name, "warnings": engine.warnings}


async def handle_report(db: AsyncSession, job: AnalysisJob, progress) -> dict:
    report = await db.get(Report, uuid.UUID(job.params["report_id"]))
    if not report:
        raise AppError("Report not found.")
    engine = await _engine(db, job)
    await progress(20, "Collecting analytics")
    await report_service.generate_report(db, report, engine)
    await progress(95, "Rendering PDF")
    if job.created_by_id:
        await notify(db, job.created_by_id, report.workspace_id, "report_ready", f"Report ready: {report.title}", "",
                     f"/app/reports/{report.id}")
    await deliver_webhook_event(db, report.workspace_id, "report.ready", {"report_id": str(report.id),
                                                                          "title": report.title})
    return {"report_id": str(report.id), "file_size": report.file_size, "provider": engine.provider_name,
            "warnings": engine.warnings}


async def handle_monitoring(db: AsyncSession, job: AnalysisJob, progress) -> dict:
    fired = await monitoring_service.evaluate_workspace(db, workspace_id=job.workspace_id)
    return {"alerts_triggered": fired}


HANDLERS = {
    "import_reviews": handle_import,
    "analyze_reviews": handle_analyze,
    "opportunity_finder": handle_opportunity_finder,
    "gap_finder": handle_gap_finder,
    "competitor_analysis": handle_competitor,
    "generate_report": handle_report,
    "monitoring": handle_monitoring,
}
