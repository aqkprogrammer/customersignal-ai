"""Unauthenticated endpoints: plans, announcements, contact form, shared reports, invitation preview, health."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.serializers import iso, report_out
from app.core.database import get_db
from app.core.errors import NotFound
from app.core.rate_limit import limiter
from app.core.security import hash_token, utcnow
from app.core.storage import storage
from app.models import (
    Announcement,
    Report,
    ReportShare,
    SubscriptionPlan,
    SupportMessage,
    SupportTicket,
    Workspace,
)
from app.services import settings_service

router = APIRouter(prefix="/public", tags=["public"])


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    company: str | None = Field(default=None, max_length=200)
    topic: str = Field(default="sales", max_length=40)
    message: str = Field(min_length=10, max_length=5000)


def plan_out(p: SubscriptionPlan) -> dict:
    return {"code": p.code, "name": p.name, "description": p.description, "price_monthly_cents": p.price_monthly_cents,
            "currency": p.currency, "features": p.features, "marketing_features": p.marketing_features,
            "limits": {"max_workspaces": p.max_workspaces, "max_projects": p.max_projects,
                       "max_reviews_per_month": p.max_reviews_per_month, "max_reports_per_month": p.max_reports_per_month,
                       "max_members": p.max_members},
            "trial_days": p.trial_days, "highlighted": p.highlighted}


@router.get("/plans")
async def plans(db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.scalars(select(SubscriptionPlan).where(SubscriptionPlan.is_active.is_(True),
                                                            SubscriptionPlan.is_public.is_(True))
                             .order_by(SubscriptionPlan.sort_order))).all()
    return [plan_out(p) for p in rows]


@router.get("/config")
async def config(db: AsyncSession = Depends(get_db)) -> dict:
    s = await settings_service.get_all(db)
    from app.core.config import settings

    return {"platform_name": s["platform_name"], "maintenance_mode": s["maintenance_mode"],
            "maintenance_message": s["maintenance_message"], "registration_enabled": s["registration_enabled"],
            "google_oauth": settings.google_oauth_enabled, "stripe_enabled": settings.stripe_enabled,
            "supported_countries": s["supported_countries"], "support_email": s["support_email"]}


@router.get("/announcements")
async def announcements(db: AsyncSession = Depends(get_db)) -> list[dict]:
    now = utcnow()
    rows = (await db.scalars(select(Announcement).where(
        Announcement.is_active.is_(True), or_(Announcement.starts_at.is_(None), Announcement.starts_at <= now),
        or_(Announcement.ends_at.is_(None), Announcement.ends_at >= now)).order_by(Announcement.created_at.desc()).limit(3))).all()
    return [{"id": str(a.id), "title": a.title, "body": a.body, "level": a.level, "audience": a.audience} for a in rows]


@router.post("/contact", status_code=201, dependencies=[Depends(limiter("contact", 5, 3600))])
async def contact(body: ContactIn, db: AsyncSession = Depends(get_db)) -> dict:
    t = SupportTicket(email=body.email, subject=f"[{body.topic}] {body.name}" + (f" — {body.company}" if body.company else ""),
                      category=body.topic[:40], source="contact_form", priority="normal")
    db.add(t)
    await db.flush()
    db.add(SupportMessage(ticket_id=t.id, author_type="user", body=body.message))
    return {"message": "Thanks — our team will get back to you within one business day."}


async def _share(db: AsyncSession, token: str) -> tuple[ReportShare, Report]:
    s = await db.scalar(select(ReportShare).where(ReportShare.token_hash == hash_token(token)))
    if not s or s.revoked_at or (s.expires_at and s.expires_at < utcnow()):
        raise NotFound("This share link is invalid or has expired.")
    r = await db.get(Report, s.report_id)
    if not r or r.deleted_at or r.status != "ready":
        raise NotFound("This report is no longer available.")
    return s, r


@router.get("/reports/{token}", dependencies=[Depends(limiter("share", 60, 60))])
async def shared_report(token: str, db: AsyncSession = Depends(get_db)) -> dict:
    s, r = await _share(db, token)
    s.view_count += 1
    s.last_viewed_at = utcnow()
    ws = await db.get(Workspace, r.workspace_id)
    out = report_out(r, with_content=True)
    out.pop("project_id", None)
    return {**out, "workspace_name": ws.name if ws else "", "expires_at": iso(s.expires_at)}


@router.get("/reports/{token}/pdf", dependencies=[Depends(limiter("share", 60, 60))])
async def shared_pdf(token: str, db: AsyncSession = Depends(get_db)) -> Response:
    _, r = await _share(db, token)
    data = await storage.get(r.file_key or "")
    if data is None:
        raise NotFound("Report file is missing.")
    return Response(data, media_type="application/pdf", headers={"content-disposition": 'inline; filename="report.pdf"'})
