"""Notifications, usage, support tickets (user side) and the API-key authenticated ingestion endpoint."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_current_user, get_workspace_context
from app.api.v1.serializers import iso, job_out
from app.core.database import get_db
from app.core.errors import AppError, NotFound, Unauthorized
from app.core.rate_limit import hit
from app.core.security import hash_token, utcnow
from app.models import ApiKey, Notification, Project, ReviewSource, SupportMessage, SupportTicket, User
from app.schemas.common import Pagination, page
from app.services import analytics
from app.services.ingestion import (
    IngestionError,
    NormalizedReview,
    insert_reviews,
    normalize_text,
    parse_date,
)
from app.workers.jobs import create_job, enqueue

notifications = APIRouter(prefix="/notifications", tags=["notifications"])
usage = APIRouter(prefix="/usage", tags=["usage"])
support = APIRouter(prefix="/support", tags=["support"])
ingest = APIRouter(prefix="/ingest", tags=["ingest"])


@notifications.get("")
async def list_notifications(unread: bool = False, p: Pagination = Depends(), user: User = Depends(get_current_user),
                             db: AsyncSession = Depends(get_db)) -> dict:
    q = select(Notification).where(Notification.user_id == user.id)
    if unread:
        q = q.where(Notification.read_at.is_(None))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    unread_count = await db.scalar(select(func.count()).select_from(Notification).where(
        Notification.user_id == user.id, Notification.read_at.is_(None)))
    rows = (await db.scalars(q.order_by(Notification.created_at.desc()).offset(p.offset).limit(p.page_size))).all()
    return {**page([{"id": str(n.id), "type": n.notification_type, "title": n.title, "body": n.body, "link": n.link,
                     "read": n.read_at is not None, "workspace_id": str(n.workspace_id) if n.workspace_id else None,
                     "created_at": iso(n.created_at)} for n in rows], int(total or 0), p),
            "unread_count": int(unread_count or 0)}


@notifications.post("/{notification_id}/read")
async def mark_read(notification_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    n = await db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise NotFound("Notification not found.")
    n.read_at = n.read_at or utcnow()
    return {"message": "ok"}


@notifications.post("/read-all")
async def mark_all(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    await db.execute(update(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))
                     .values(read_at=utcnow()))
    return {"message": "ok"}


@usage.get("")
async def usage_summary(ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> dict:
    return await analytics.usage_summary(db, ctx.workspace_id)


# ---------------------------------------------------------------------------------------------- support
class TicketIn(BaseModel):
    subject: str = Field(min_length=3, max_length=300)
    category: str = Field(default="general", max_length=40)
    priority: str = Field(default="normal", pattern="^(low|normal|high|urgent)$")
    message: str = Field(min_length=5, max_length=10000)


class ReplyIn(BaseModel):
    message: str = Field(min_length=1, max_length=10000)


@support.get("/tickets")
async def my_tickets(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.scalars(select(SupportTicket).where(SupportTicket.user_id == user.id)
                             .order_by(SupportTicket.updated_at.desc()))).all()
    return [{"id": str(t.id), "subject": t.subject, "status": t.status, "priority": t.priority, "category": t.category,
             "created_at": iso(t.created_at), "updated_at": iso(t.updated_at)} for t in rows]


@support.post("/tickets", status_code=201)
async def create_ticket(body: TicketIn, ctx: WorkspaceContext = Depends(get_workspace_context),
                        db: AsyncSession = Depends(get_db)) -> dict:
    await hit(f"ticket:{ctx.user.id}", 10, 3600)
    t = SupportTicket(workspace_id=ctx.workspace_id, user_id=ctx.user.id, email=ctx.user.email, subject=body.subject,
                      category=body.category, priority=body.priority)
    db.add(t)
    await db.flush()
    db.add(SupportMessage(ticket_id=t.id, author_type="user", author_user_id=ctx.user.id, body=body.message))
    return {"id": str(t.id), "status": t.status}


@support.get("/tickets/{ticket_id}")
async def ticket(ticket_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    t = await db.get(SupportTicket, ticket_id)
    if not t or t.user_id != user.id:
        raise NotFound("Ticket not found.")
    msgs = (await db.scalars(select(SupportMessage).where(SupportMessage.ticket_id == t.id,
                                                          SupportMessage.is_internal.is_(False))
                             .order_by(SupportMessage.created_at))).all()
    return {"id": str(t.id), "subject": t.subject, "status": t.status, "priority": t.priority,
            "created_at": iso(t.created_at),
            "messages": [{"id": str(m.id), "author_type": m.author_type, "body": m.body, "created_at": iso(m.created_at)}
                         for m in msgs]}


@support.post("/tickets/{ticket_id}/reply")
async def reply(ticket_id: uuid.UUID, body: ReplyIn, user: User = Depends(get_current_user),
                db: AsyncSession = Depends(get_db)) -> dict:
    t = await db.get(SupportTicket, ticket_id)
    if not t or t.user_id != user.id:
        raise NotFound("Ticket not found.")
    db.add(SupportMessage(ticket_id=t.id, author_type="user", author_user_id=user.id, body=body.message))
    if t.status in ("waiting_on_customer", "resolved"):
        t.status = "open"
    t.updated_at = utcnow()
    return {"message": "Reply sent."}


# ---------------------------------------------------------------------------------------------- ingest API
class IngestReview(BaseModel):
    text: str = Field(min_length=3, max_length=10000)
    rating: float | None = Field(default=None, ge=0, le=5)
    review_date: str | None = None
    reviewer_name: str | None = Field(default=None, max_length=200)
    platform: str | None = Field(default=None, max_length=80)
    business: str | None = Field(default=None, max_length=200)
    product_name: str | None = Field(default=None, max_length=300)
    external_id: str | None = Field(default=None, max_length=200)


class IngestIn(BaseModel):
    project_id: uuid.UUID
    reviews: list[IngestReview] = Field(min_length=1, max_length=1000)
    analyze: bool = False


@ingest.post("/reviews", status_code=202)
async def ingest_reviews(body: IngestIn, request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    auth = request.headers.get("authorization", "")
    raw = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    key = await db.scalar(select(ApiKey).where(ApiKey.key_hash == hash_token(raw))) if raw else None
    if not key or key.revoked_at:
        raise Unauthorized("Invalid API key.", code="invalid_api_key")
    await hit(f"ingest:{key.id}", 120, 60)
    project = await db.get(Project, body.project_id)
    if not project or project.workspace_id != key.workspace_id or project.deleted_at:
        raise NotFound("Project not found.")
    key.last_used_at = utcnow()
    rows = []
    for i, r in enumerate(body.reviews):
        try:
            rows.append(NormalizedReview(text=normalize_text(r.text), rating=r.rating, review_date=parse_date(r.review_date),
                                         reviewer_name=r.reviewer_name, platform=r.platform, business=r.business,
                                         product_name=r.product_name, external_id=r.external_id))
        except IngestionError as exc:
            raise AppError(f"reviews[{i}]: {exc}", code="validation_error")
    src = ReviewSource(workspace_id=project.workspace_id, project_id=project.id, source_type="api",
                       name=f"API batch {date.today().isoformat()}", status="completed", rows_total=len(rows))
    db.add(src)
    await db.flush()
    inserted, dupes = await insert_reviews(db, project, rows, source_id=src.id)
    src.rows_imported, src.rows_duplicate = inserted, dupes
    job = None
    if body.analyze and inserted:
        job = await create_job(db, job_type="analyze_reviews", workspace_id=project.workspace_id, project_id=project.id,
                               user_id=None)
    await db.commit()
    if job:
        await enqueue(job.id)
    return {"received": len(rows), "imported": inserted, "duplicates": dupes, "job": job_out(job) if job else None}
