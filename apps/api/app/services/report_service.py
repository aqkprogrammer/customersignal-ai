"""ReportGenerationService: assemble report content from analytics + AI narrative, render PDF, store it."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import heuristics, prompts
from app.ai.engine import AIEngine
from app.ai.schemas import ReportNarrative
from app.core.errors import AppError
from app.core.security import utcnow
from app.core.storage import storage
from app.models import AIAnalysisResult, Lead, ProductOpportunity, Project, Report, Workspace
from app.services import analytics
from app.services.entitlements import get_entitlements, record_usage
from app.services.intelligence import competitor_comparison, evidence_for
from app.services.pdf_service import render_report_pdf

REPORT_TITLES = {
    "customer_sentiment": "Customer Sentiment Report",
    "business_reputation": "Business Reputation Report",
    "competitor_intelligence": "Competitor Intelligence Report",
    "product_opportunity": "Product Opportunity Report",
    "customer_complaint": "Customer Complaint Report",
    "market_research": "Market Research Report",
    "executive_summary": "Executive Summary",
    "outreach_intelligence": "Outreach Intelligence Report",
    "gap_finder": "Product Gap Analysis",
}


async def build_content(db: AsyncSession, report: Report, engine: AIEngine) -> dict:
    ws = await db.get(Workspace, report.workspace_id)
    project = await db.get(Project, report.project_id) if report.project_id else None
    f = analytics.Filters(report.workspace_id, report.project_id, None, report.date_from, report.date_to)
    kpis = await analytics.kpis(db, f)
    if kpis["total_reviews"] == 0 and report.report_type not in ("outreach_intelligence", "gap_finder"):
        raise AppError("There are no reviews in the selected scope and date range.", code="no_data")
    themes = await analytics.clusters(db, f, "complaint", 12, "severity")
    praise = await analytics.clusters(db, f, "praise", 5, "count")
    ent = await get_entitlements(db, report.workspace_id)
    branding = (ws.branding if ws and ent.has("custom_branding") else {}) or {}
    contains_demo = bool(project.is_demo) if project else bool(ws and ws.is_demo)

    content: dict = {
        "title": report.title, "report_type": report.report_type, "workspace_name": ws.name if ws else "",
        "subtitle": (project.business_name or project.name) if project else "All projects",
        "period_label": _period(report), "branding": branding, "contains_demo_data": contains_demo,
        "kpis": kpis, "rating_distribution": await analytics.rating_distribution(db, f),
        "complaint_categories": await analytics.category_breakdown(db, f, "complaint"),
        "praise_categories": await analytics.category_breakdown(db, f, "praise"),
        "emotions": await analytics.emotion_breakdown(db, f),
        "sentiment_over_time": await analytics.volume_over_time(db, f), "themes": themes, "strengths": praise,
    }
    evidence = []
    for t in themes[:6]:
        from app.models import ComplaintCluster

        c = await db.get(ComplaintCluster, uuid.UUID(t["id"]))
        if c:
            items = await evidence_for(db, list(c.representative_review_ids or []), c.id)
            if items:
                evidence.append({"theme": t["label"], "items": items})
    content["evidence"] = evidence

    opp_q = select(ProductOpportunity).where(ProductOpportunity.workspace_id == report.workspace_id,
                                             ProductOpportunity.status != "dismissed")
    if report.project_id:
        opp_q = opp_q.where(ProductOpportunity.project_id == report.project_id)
    content["opportunities"] = [
        {"title": o.title, "description": o.description, "recommendation": o.recommendation, "impact": o.impact,
         "effort": o.effort, "score": o.score} for o in (await db.scalars(opp_q.order_by(ProductOpportunity.score.desc()).limit(10))).all()
    ]
    if report.project_id and report.report_type in ("competitor_intelligence", "market_research", "executive_summary",
                                                    "business_reputation"):
        comp = await competitor_comparison(db, report.project_id)
        content["competitor_comparison"] = comp if len(comp) > 1 else []
    if report.report_type == "gap_finder" and report.project_id:
        gap = await db.scalar(select(AIAnalysisResult).where(AIAnalysisResult.project_id == report.project_id,
                                                             AIAnalysisResult.kind == "gap_report")
                              .order_by(AIAnalysisResult.created_at.desc()))
        if not gap:
            raise AppError("Run the Gap Finder for this project first.", code="no_gap_report")
        content["gap_report"] = gap.payload
    if report.report_type == "outreach_intelligence" and report.project_id:
        lead = await db.scalar(select(Lead).where(Lead.project_id == report.project_id, Lead.deleted_at.is_(None)))
        if lead and lead.pitch_status == "ready":
            content["outreach"] = {"cold_email_subject": lead.cold_email_subject, "cold_email": lead.cold_email,
                                   "linkedin_message": lead.linkedin_message}
            content["lead_issues"] = lead.issues

    stats = {k: kpis[k] for k in ("total_reviews", "avg_rating", "positive_pct", "negative_pct", "neutral_pct")}
    compact = [{"key": f"C{i}", "kind": "complaint", "category": t["category"], "label": t["label"],
                "count": t["review_count"], "avg_rating": t["avg_rating"], "severity": t["severity_score"],
                "trend": t["trend"]} for i, t in enumerate(themes)] + \
              [{"key": f"P{i}", "kind": "praise", "category": t["category"], "label": t["label"],
                "count": t["review_count"], "avg_rating": t["avg_rating"], "severity": 0, "trend": t["trend"]}
               for i, t in enumerate(praise)]
    heur_stats = {"total": kpis["total_reviews"], "avg_rating": kpis["avg_rating"],
                  "positive_pct": kpis["positive_pct"], "negative_pct": kpis["negative_pct"]}
    narrative = await engine.run(
        "report_narrative", ReportNarrative, system=prompts.NARRATIVE_SYSTEM,
        prompt=prompts.narrative_prompt(report.report_type, report.title, stats, compact),
        context={"report_type": report.report_type, "stats": heur_stats, "clusters": compact},
        heuristic=lambda: heuristics.report_narrative(report.report_type, heur_stats, compact),
    )
    content["narrative"] = narrative.model_dump()
    content["provider"] = engine.provider_name
    content["provider_label"] = engine.provider.label if engine.used_llm else "Built-in keyword engine"
    return content


def _period(report: Report) -> str:
    if report.date_from and report.date_to:
        return f"{report.date_from:%d %b %Y} – {report.date_to:%d %b %Y}"
    if report.date_from:
        return f"Since {report.date_from:%d %b %Y}"
    return "All time"


async def generate_report(db: AsyncSession, report: Report, engine: AIEngine) -> Report:
    report.status = "generating"
    await db.flush()
    content = await build_content(db, report, engine)
    pdf = render_report_pdf(content)
    key = f"reports/{report.workspace_id}/{report.id}.pdf"
    await storage.put(key, pdf, "application/pdf")
    report.content = content
    report.file_key = key
    report.file_size = len(pdf)
    report.status = "ready"
    report.provider = engine.provider_name
    report.generated_at = utcnow()
    if not report.is_demo:
        await record_usage(db, report.workspace_id, "reports_generated", 1, reference_id=report.id)
    await db.flush()
    return report


def default_title(report_type: str, scope_name: str | None) -> str:
    base = REPORT_TITLES.get(report_type, "Report")
    return f"{base} — {scope_name}" if scope_name else base
