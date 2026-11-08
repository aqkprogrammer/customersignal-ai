"""Response serializers shared across routers (explicit allow-lists — never dump ORM objects wholesale)."""

from __future__ import annotations

from typing import Any

from app.models import (
    AnalysisJob,
    Lead,
    Project,
    Report,
    Review,
    User,
    Workspace,
)


def iso(v: Any) -> str | None:
    return v.isoformat() if v is not None else None


def user_out(u: User) -> dict:
    p = u.profile
    return {
        "id": str(u.id), "email": u.email, "email_verified": u.email_verified_at is not None,
        "has_password": u.password_hash is not None, "google_linked": u.google_sub is not None,
        "full_name": p.full_name if p else "", "avatar_url": p.avatar_url if p else None,
        "company_name": p.company_name if p else None, "job_title": p.job_title if p else None,
        "timezone": p.timezone if p else "Asia/Dubai",
        "onboarding_step": p.onboarding_step if p else 1,
        "onboarding_completed": bool(p and p.onboarding_completed_at),
        "onboarding_data": p.onboarding_data if p else {},
        "notification_preferences": p.notification_preferences if p else {},
        "default_workspace_id": str(u.default_workspace_id) if u.default_workspace_id else None,
        "created_at": iso(u.created_at),
    }


def workspace_out(ws: Workspace, role: str | None = None) -> dict:
    return {
        "id": str(ws.id), "name": ws.name, "slug": ws.slug, "role": role, "is_demo": ws.is_demo,
        "business_type": ws.business_type, "industry": ws.industry, "country": ws.country, "city": ws.city,
        "website": ws.website, "company_size": ws.company_size, "goals": ws.goals,
        "preferred_sources": ws.preferred_sources, "branding": ws.branding, "status": ws.status,
        "data_retention_days": ws.data_retention_days, "created_at": iso(ws.created_at),
    }


def project_out(p: Project, stats: dict | None = None) -> dict:
    return {
        "id": str(p.id), "workspace_id": str(p.workspace_id), "name": p.name, "description": p.description,
        "industry": p.industry, "country": p.country, "city": p.city, "website": p.website,
        "business_name": p.business_name, "data_source": p.data_source, "kind": p.kind, "status": p.status,
        "is_demo": p.is_demo, "archived_at": iso(p.archived_at), "last_analyzed_at": iso(p.last_analyzed_at),
        "created_at": iso(p.created_at), "updated_at": iso(p.updated_at), "stats": stats,
    }


def review_out(r: Review, *, detail: bool = False) -> dict:
    s = r.sentiment
    out = {
        "id": str(r.id), "project_id": str(r.project_id), "business_id": str(r.business_id) if r.business_id else None,
        "platform": r.platform, "product_name": r.product_name, "reviewer_name": r.reviewer_name, "rating": r.rating,
        "title": r.title, "text": r.text, "review_date": iso(r.review_date), "location": r.location,
        "verified": r.verified, "language": r.language, "translated_text": r.translated_text,
        "analysis_status": r.analysis_status, "is_demo": r.is_demo, "created_at": iso(r.created_at),
        "sentiment": s.sentiment if s else None, "sentiment_score": s.score if s else None,
        "emotion": s.emotion if s else None,
        "categories": sorted({t.category_slug for t in r.topics if t.kind == "complaint"}),
    }
    if detail:
        out["analysis"] = {
            "explanation": s.explanation if s else None, "confidence": s.confidence if s else None,
            "provider": s.provider if s else None, "model": s.model if s else None,
            "prompt_version": s.prompt_version if s else None,
        } if s else None
        out["signals"] = [{"kind": t.kind, "category": t.category_slug, "label": t.label, "excerpt": t.excerpt,
                           "severity": t.severity, "cluster_id": str(t.cluster_id) if t.cluster_id else None}
                          for t in r.topics]
    return out


def job_out(j: AnalysisJob) -> dict:
    return {
        "id": str(j.id), "job_type": j.job_type, "status": j.status, "progress": j.progress, "stage": j.stage,
        "project_id": str(j.project_id) if j.project_id else None, "total_items": j.total_items,
        "processed_items": j.processed_items, "result_summary": j.result_summary, "error": j.error,
        "attempts": j.attempts, "max_attempts": j.max_attempts, "params": j.params,
        "dead_lettered": j.dead_lettered_at is not None, "created_at": iso(j.created_at),
        "started_at": iso(j.started_at), "completed_at": iso(j.completed_at),
    }


def report_out(r: Report, *, with_content: bool = False) -> dict:
    out = {
        "id": str(r.id), "project_id": str(r.project_id) if r.project_id else None, "report_type": r.report_type,
        "title": r.title, "status": r.status, "date_from": iso(r.date_from), "date_to": iso(r.date_to),
        "file_size": r.file_size, "provider": r.provider, "error": r.error, "generated_at": iso(r.generated_at),
        "download_count": r.download_count, "is_demo": r.is_demo, "created_at": iso(r.created_at),
        "has_pdf": bool(r.file_key),
    }
    if with_content:
        out["content"] = r.content
    return out


def lead_out(lead: Lead, *, detail: bool = False) -> dict:
    out = {
        "id": str(lead.id), "project_id": str(lead.project_id) if lead.project_id else None,
        "business_name": lead.business_name, "website": lead.website, "country": lead.country, "city": lead.city,
        "industry": lead.industry, "status": lead.status, "pitch_status": lead.pitch_status,
        "contact_name": lead.contact_name, "contact_email": lead.contact_email,
        "contact_linkedin": lead.contact_linkedin, "competitor_names": lead.competitor_names,
        "issue_count": len(lead.issues or []), "top_issue": (lead.issues or [{}])[0].get("title") if lead.issues else None,
        "last_contacted_at": iso(lead.last_contacted_at), "is_demo": lead.is_demo,
        "created_at": iso(lead.created_at), "updated_at": iso(lead.updated_at),
        "report_id": str(lead.report_id) if lead.report_id else None,
    }
    if detail:
        out.update({
            "executive_summary": lead.executive_summary, "cold_email_subject": lead.cold_email_subject,
            "cold_email": lead.cold_email, "linkedin_message": lead.linkedin_message,
            "follow_up_email": lead.follow_up_email, "issues": lead.issues, "opportunities": lead.opportunities,
            "notes": lead.notes,
        })
    return out
