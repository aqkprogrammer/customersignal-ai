"""1-Star Review Cold Pitch (Opportunity Finder) and the lead pipeline."""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_workspace_context, require_role
from app.api.v1.serializers import iso, job_out, lead_out, report_out
from app.core.database import get_db
from app.core.errors import AppError, NotFound
from app.core.security import utcnow
from app.models import Business, Integration, Lead, LeadActivity, Project, Report, Review, UserProfile
from app.models.lead import LEAD_STATUSES
from app.schemas.common import Pagination, page
from app.services.activity import log_activity
from app.services.entitlements import assert_project_quota, assert_report_quota, require_feature
from app.services.integrations_service import deliver_webhook_event, push_lead_to_hubspot
from app.services.report_service import default_title
from app.workers.jobs import create_job, enqueue

router = APIRouter(prefix="/leads", tags=["leads"])
LeadStatus = Literal["new", "researched", "contacted", "replied", "meeting_booked", "converted", "not_interested"]


class FinderIn(BaseModel):
    business_name: str = Field(min_length=2, max_length=200)
    website: str | None = Field(default=None, max_length=500)
    country: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=120)
    industry: str | None = Field(default=None, max_length=120)
    competitors: list[str] = Field(default_factory=list, max_length=5)
    project_id: uuid.UUID | None = None  # reuse reviews already in a project


class LeadUpdate(BaseModel):
    status: LeadStatus | None = None
    contact_name: str | None = Field(default=None, max_length=200)
    contact_email: EmailStr | None = None
    contact_linkedin: str | None = Field(default=None, max_length=500)
    executive_summary: str | None = Field(default=None, max_length=5000)
    cold_email_subject: str | None = Field(default=None, max_length=300)
    cold_email: str | None = Field(default=None, max_length=10000)
    linkedin_message: str | None = Field(default=None, max_length=3000)
    follow_up_email: str | None = Field(default=None, max_length=10000)
    notes: str | None = Field(default=None, max_length=10000)


class NoteIn(BaseModel):
    message: str = Field(min_length=1, max_length=5000)


async def _lead(db: AsyncSession, ctx: WorkspaceContext, lead_id: uuid.UUID) -> Lead:
    lead = await db.get(Lead, lead_id)
    if not lead or lead.workspace_id != ctx.workspace_id or lead.deleted_at:
        raise NotFound("Lead not found.")
    return lead


@router.get("")
async def list_leads(status: str | None = None, q: str | None = None, p: Pagination = Depends(),
                     ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> dict:
    stmt = select(Lead).where(Lead.workspace_id == ctx.workspace_id, Lead.deleted_at.is_(None))
    if status:
        stmt = stmt.where(Lead.status == status)
    if q:
        stmt = stmt.where(Lead.business_name.ilike(f"%{q}%"))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.scalars(stmt.order_by(Lead.updated_at.desc()).offset(p.offset).limit(p.page_size))).all()
    counts = dict((await db.execute(select(Lead.status, func.count()).where(
        Lead.workspace_id == ctx.workspace_id, Lead.deleted_at.is_(None)).group_by(Lead.status))).all())
    return {**page([lead_out(x) for x in rows], int(total or 0), p),
            "pipeline": {s: int(counts.get(s, 0)) for s in LEAD_STATUSES}}


@router.post("", status_code=201)
async def create_lead(body: FinderIn, ctx: WorkspaceContext = Depends(require_role("analyst")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    await require_feature(db, ctx.workspace_id, "advanced_ai")
    if body.project_id:
        project = await db.get(Project, body.project_id)
        if not project or project.workspace_id != ctx.workspace_id or project.deleted_at:
            raise NotFound("Project not found.")
    else:
        await assert_project_quota(db, ctx.workspace_id)
        project = Project(workspace_id=ctx.workspace_id, name=f"Prospect: {body.business_name}", kind="opportunity_finder",
                          business_name=body.business_name, website=body.website, country=body.country, city=body.city,
                          industry=body.industry, data_source="csv", created_by_id=ctx.user.id,
                          description="Opportunity Finder dataset (authorized review data)")
        db.add(project)
        await db.flush()
        db.add(Business(workspace_id=ctx.workspace_id, project_id=project.id, name=body.business_name, is_primary=True,
                        website=body.website, city=body.city, country=body.country, industry=body.industry))
        for comp in body.competitors:
            if comp.strip() and comp.strip().lower() != body.business_name.lower():
                db.add(Business(workspace_id=ctx.workspace_id, project_id=project.id, name=comp.strip()[:200],
                                is_primary=False, city=body.city, country=body.country, industry=body.industry))
    lead = Lead(workspace_id=ctx.workspace_id, project_id=project.id, business_name=body.business_name,
                website=body.website, country=body.country, city=body.city, industry=body.industry,
                competitor_names=[c.strip()[:200] for c in body.competitors if c.strip()], created_by_id=ctx.user.id)
    db.add(lead)
    await db.flush()
    db.add(LeadActivity(lead_id=lead.id, workspace_id=ctx.workspace_id, actor_id=ctx.user.id, activity_type="created",
                        message="Lead created", to_status="new"))
    await log_activity(db, ctx.workspace_id, ctx.user.id, "lead.created", "lead", lead.id, f"New lead {lead.business_name}")
    businesses = (await db.scalars(select(Business).where(Business.project_id == project.id))).all()
    return {**lead_out(lead, detail=True), "businesses": [{"id": str(b.id), "name": b.name, "is_primary": b.is_primary}
                                                          for b in businesses]}


@router.get("/{lead_id}")
async def get_lead(lead_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                   db: AsyncSession = Depends(get_db)) -> dict:
    lead = await _lead(db, ctx, lead_id)
    review_count = await db.scalar(select(func.count()).select_from(Review).where(
        Review.project_id == lead.project_id, Review.deleted_at.is_(None))) if lead.project_id else 0
    businesses = (await db.scalars(select(Business).where(Business.project_id == lead.project_id,
                                                          Business.deleted_at.is_(None)))).all() if lead.project_id else []
    acts = (await db.execute(select(LeadActivity, UserProfile.full_name)
                             .outerjoin(UserProfile, UserProfile.user_id == LeadActivity.actor_id)
                             .where(LeadActivity.lead_id == lead.id).order_by(LeadActivity.created_at.desc()).limit(50))).all()
    return {**lead_out(lead, detail=True), "review_count": int(review_count or 0),
            "businesses": [{"id": str(b.id), "name": b.name, "is_primary": b.is_primary} for b in businesses],
            "activities": [{"id": str(a.id), "type": a.activity_type, "message": a.message, "from_status": a.from_status,
                            "to_status": a.to_status, "actor": name, "created_at": iso(a.created_at)} for a, name in acts]}


@router.patch("/{lead_id}")
async def update_lead(lead_id: uuid.UUID, body: LeadUpdate, ctx: WorkspaceContext = Depends(require_role("analyst")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    lead = await _lead(db, ctx, lead_id)
    data = body.model_dump(exclude_unset=True)
    new_status = data.pop("status", None)
    edited = [k for k in data if k in ("executive_summary", "cold_email_subject", "cold_email", "linkedin_message",
                                       "follow_up_email")]
    for k, v in data.items():
        setattr(lead, k, v)
    if edited:
        db.add(LeadActivity(lead_id=lead.id, workspace_id=ctx.workspace_id, actor_id=ctx.user.id, activity_type="edited",
                            message=f"Edited {', '.join(e.replace('_', ' ') for e in edited)}"))
    if new_status and new_status != lead.status:
        db.add(LeadActivity(lead_id=lead.id, workspace_id=ctx.workspace_id, actor_id=ctx.user.id,
                            activity_type="status_change", message=f"Moved to {new_status.replace('_', ' ')}",
                            from_status=lead.status, to_status=new_status))
        if new_status == "contacted":
            lead.last_contacted_at = utcnow()
        old = lead.status
        lead.status = new_status
        await deliver_webhook_event(db, ctx.workspace_id, "lead.status_changed",
                                    {"lead_id": str(lead.id), "business_name": lead.business_name, "from": old,
                                     "to": new_status})
    return lead_out(lead, detail=True)


@router.post("/{lead_id}/notes", status_code=201)
async def add_note(lead_id: uuid.UUID, body: NoteIn, ctx: WorkspaceContext = Depends(require_role("analyst")),
                   db: AsyncSession = Depends(get_db)) -> dict:
    lead = await _lead(db, ctx, lead_id)
    db.add(LeadActivity(lead_id=lead.id, workspace_id=ctx.workspace_id, actor_id=ctx.user.id, activity_type="note",
                        message=body.message))
    return {"message": "Note added."}


@router.post("/{lead_id}/generate", status_code=202)
async def generate(lead_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                   db: AsyncSession = Depends(get_db)) -> dict:
    await require_feature(db, ctx.workspace_id, "advanced_ai")
    lead = await _lead(db, ctx, lead_id)
    primary = await db.scalar(select(Business).where(Business.project_id == lead.project_id, Business.is_primary.is_(True)))
    count = await db.scalar(select(func.count()).select_from(Review).where(
        Review.project_id == lead.project_id, Review.deleted_at.is_(None),
        *([Review.business_id == primary.id] if primary else [])))
    if not count:
        raise AppError(f"Upload review data for {lead.business_name} first — pitches are only generated from actual "
                       "review evidence.", code="no_reviews")
    lead.pitch_status = "generating"
    job = await create_job(db, job_type="opportunity_finder", workspace_id=ctx.workspace_id, project_id=lead.project_id,
                           user_id=ctx.user.id, params={"lead_id": str(lead.id)})
    await db.commit()
    await enqueue(job.id)
    return job_out(job)


@router.post("/{lead_id}/report", status_code=202)
async def lead_report(lead_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    lead = await _lead(db, ctx, lead_id)
    if lead.pitch_status != "ready":
        raise AppError("Generate the outreach pack first.", code="pitch_not_ready")
    await assert_report_quota(db, ctx.workspace_id)
    report = Report(workspace_id=ctx.workspace_id, project_id=lead.project_id, created_by_id=ctx.user.id,
                    report_type="outreach_intelligence", title=default_title("outreach_intelligence", lead.business_name),
                    status="pending", is_demo=lead.is_demo)
    db.add(report)
    await db.flush()
    lead.report_id = report.id
    job = await create_job(db, job_type="generate_report", workspace_id=ctx.workspace_id, project_id=lead.project_id,
                           user_id=ctx.user.id, params={"report_id": str(report.id)})
    report.job_id = job.id
    await db.commit()
    await enqueue(job.id)
    return {"report": report_out(report), "job": job_out(job)}


@router.post("/{lead_id}/sync/hubspot")
async def sync_hubspot(lead_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                       db: AsyncSession = Depends(get_db)) -> dict:
    lead = await _lead(db, ctx, lead_id)
    integ = await db.scalar(select(Integration).where(Integration.workspace_id == ctx.workspace_id,
                                                      Integration.provider == "hubspot", Integration.status == "connected"))
    if not integ:
        raise AppError("Connect HubSpot in Integrations first.", code="integration_not_connected")
    result = await push_lead_to_hubspot(db, integ, lead)
    db.add(LeadActivity(lead_id=lead.id, workspace_id=ctx.workspace_id, actor_id=ctx.user.id, activity_type="exported",
                        message="Synced to HubSpot"))
    return result


@router.delete("/{lead_id}")
async def delete_lead(lead_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    lead = await _lead(db, ctx, lead_id)
    lead.deleted_at = utcnow()
    return {"message": "Lead deleted."}
