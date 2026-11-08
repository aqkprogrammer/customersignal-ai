"""arq worker entrypoint:  arq app.workers.worker.WorkerSettings"""

from __future__ import annotations

import logging
from datetime import timedelta

from arq import cron
from arq.connections import RedisSettings
from sqlalchemy import delete, select, update

from app.core.config import settings
from app.core.database import session_scope
from app.core.logging import configure_logging
from app.core.security import utcnow
from app.models import AnalysisJob, Review, UserSession, Workspace, WorkspaceInvitation
from app.services import monitoring_service
from app.workers.jobs import run_job as _run_job

log = logging.getLogger("app.worker")


async def run_job(ctx: dict, job_id: str) -> str:
    return await _run_job(job_id, ctx)


async def scheduled_monitoring(ctx: dict) -> None:
    async with session_scope() as db:
        fired = await monitoring_service.evaluate_workspace(db)
        log.info("Scheduled monitoring: %s alert(s) triggered", fired)


async def maintenance(ctx: dict) -> None:
    """Daily: expire invitations, purge old sessions, apply workspace data-retention, recover stuck jobs."""
    now = utcnow()
    async with session_scope() as db:
        await db.execute(update(WorkspaceInvitation).where(WorkspaceInvitation.status == "pending",
                                                           WorkspaceInvitation.expires_at < now).values(status="expired"))
        await db.execute(delete(UserSession).where(UserSession.expires_at < now - timedelta(days=7)))
        for ws in (await db.scalars(select(Workspace).where(Workspace.data_retention_days.is_not(None)))).all():
            cutoff = now - timedelta(days=ws.data_retention_days or 0)
            await db.execute(update(Review).where(Review.workspace_id == ws.id, Review.created_at < cutoff,
                                                  Review.deleted_at.is_(None)).values(deleted_at=now))
        # Jobs stuck in "processing" for 2h (worker crash) are dead-lettered.
        await db.execute(update(AnalysisJob).where(AnalysisJob.status == "processing",
                                                   AnalysisJob.updated_at < now - timedelta(hours=2))
                         .values(status="failed", error="Worker timed out", dead_lettered_at=now))


async def recover_pending(ctx: dict | None = None) -> int:
    """Re-enqueue jobs left 'pending' for over a minute (e.g. a Redis flush or a crash before dispatch)."""
    from app.workers.jobs import enqueue

    async with session_scope() as db:
        ids = (await db.scalars(select(AnalysisJob.id).where(
            AnalysisJob.status == "pending", AnalysisJob.updated_at < utcnow() - timedelta(minutes=1)))).all()
    for job_id in ids:
        await enqueue(job_id)
    if ids:
        log.info("Recovered %s pending job(s)", len(ids))
    return len(ids)


async def startup(ctx: dict) -> None:
    configure_logging()
    log.info("Worker started (env=%s, queue=%s)", settings.environment, settings.jobs_queue_name)
    await recover_pending()


class WorkerSettings:
    functions = [run_job]
    cron_jobs = [
        cron(scheduled_monitoring, minute=5),
        cron(maintenance, hour=3, minute=30),
        cron(recover_pending, minute={0, 10, 20, 30, 40, 50}),
    ]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    queue_name = settings.jobs_queue_name
    on_startup = startup
    max_jobs = 8
    job_timeout = 60 * 60
    keep_result = 3600
