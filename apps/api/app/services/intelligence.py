"""OpportunityDiscovery / OutreachGeneration / Gap Finder / CompetitorAnalysis services."""

from __future__ import annotations

import uuid
from collections import Counter, defaultdict

from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import heuristics, prompts
from app.ai.engine import AIEngine
from app.ai.schemas import CompetitorAnalysis, GapReport, OutreachPack
from app.core.errors import AppError
from app.models import (
    AIAnalysisResult,
    Business,
    ComplaintCluster,
    Lead,
    LeadActivity,
    ProductOpportunity,
    Project,
    Review,
    ReviewSentiment,
    ReviewTopic,
    Workspace,
)
from app.services.analysis_service import category_catalog, project_stats


async def evidence_for(db: AsyncSession, review_ids: list[uuid.UUID], cluster_id: uuid.UUID | None = None,
                       limit: int = 3) -> list[dict]:
    """Representative *actual* review excerpts with source references."""
    if not review_ids:
        return []
    reviews = {r.id: r for r in (await db.scalars(select(Review).where(Review.id.in_(review_ids)))).all()}
    excerpts: dict[uuid.UUID, str] = {}
    if cluster_id:
        for t in (await db.scalars(select(ReviewTopic).where(ReviewTopic.cluster_id == cluster_id,
                                                             ReviewTopic.review_id.in_(review_ids)))).all():
            if t.excerpt and t.review_id not in excerpts:
                excerpts[t.review_id] = t.excerpt
    out = []
    for rid in review_ids:
        r = reviews.get(rid)
        if not r:
            continue
        text = excerpts.get(rid) or (r.text if len(r.text) <= 280 else r.text[:277].rsplit(" ", 1)[0] + "…")
        out.append({"review_id": str(r.id), "excerpt": text, "rating": r.rating,
                    "date": r.review_date.isoformat() if r.review_date else None, "platform": r.platform,
                    "reviewer": r.reviewer_name, "is_demo": r.is_demo, "translated": r.translated_text})
        if len(out) >= limit:
            break
    return out


# ---------------------------------------------------------------------------------------- Opportunity Finder
async def generate_outreach(db: AsyncSession, lead: Lead, engine: AIEngine, job_id: uuid.UUID | None) -> Lead:
    if not lead.project_id:
        raise AppError("This lead has no review dataset. Upload reviews first.", code="no_reviews")
    project = await db.get(Project, lead.project_id)
    primary = await db.scalar(select(Business).where(Business.project_id == lead.project_id, Business.is_primary.is_(True)))
    stats = await project_stats(db, lead.project_id, primary.id if primary else None)
    if stats["analyzed"] == 0:
        raise AppError("No analyzed reviews for this business yet.", code="no_reviews")
    q = select(ComplaintCluster).where(ComplaintCluster.project_id == lead.project_id, ComplaintCluster.kind == "complaint")
    if primary:
        q = q.where(ComplaintCluster.business_id == primary.id)
    clusters = (await db.scalars(q.order_by(ComplaintCluster.severity_score.desc()))).all()
    # Only recurring problems (2+ reviews) qualify as issues, unless the dataset is tiny.
    specific = [c for c in clusters if c.category_slug != "other"]
    recurring = [c for c in specific if c.review_count >= 2] or [c for c in clusters if c.review_count >= 2] \
        or (clusters[:2] if stats["total"] < 10 else [])
    issues = []
    for i, c in enumerate(recurring[:6]):
        issues.append({
            "key": f"I{i + 1}", "cluster_id": str(c.id), "label": c.label, "category": c.category_slug,
            "count": c.review_count, "avg_rating": c.avg_rating, "severity": c.severity_score, "trend": c.trend,
            "evidence": await evidence_for(db, list(c.representative_review_ids or []), c.id, limit=3),
        })
    ws = await db.get(Workspace, lead.workspace_id)
    ctx_issues = [{"cluster_key": i["key"], "label": i["label"], "count": i["count"], "avg_rating": i["avg_rating"],
                   "severity": i["severity"], "trend": i["trend"],
                   "evidence": [e["excerpt"] for e in i["evidence"]]} for i in issues]
    heur_issues = [{"key": i["key"], "label": i["label"], "category": i["category"], "count": i["count"],
                    "severity": i["severity"], "avg_rating": i["avg_rating"]} for i in issues]
    pack = await engine.run(
        "outreach_pack", OutreachPack, system=prompts.OUTREACH_SYSTEM,
        prompt=prompts.outreach_prompt(
            lead.business_name,
            {"city": lead.city, "country": lead.country, "industry": lead.industry, "website": lead.website,
             "stats": stats, "competitors": lead.competitor_names},
            ctx_issues, {"company": ws.name if ws else None},
        ),
        context={"business": lead.business_name, "city": lead.city, "industry": lead.industry, "issues": heur_issues,
                 "stats": stats, "sender_company": ws.name if ws else None},
        heuristic=lambda: heuristics.outreach_pack(lead.business_name, lead.city, lead.industry, heur_issues, stats,
                                                   ws.name if ws else None),
    )
    by_key = {i["key"]: i for i in issues}
    ranked = []
    for ri in pack.issues:
        src = by_key.get(ri.cluster_key)
        if not src:
            continue  # drop anything not backed by an actual cluster
        ranked.append({**src, "title": ri.title, "why_it_matters": ri.why_it_matters})
    for i in issues:  # keep evidence-backed issues the model may have omitted
        if not any(r["key"] == i["key"] for r in ranked):
            ranked.append({**i, "title": i["label"], "why_it_matters": f"Mentioned in {i['count']} reviews."})
    lead.issues = ranked
    lead.opportunities = [o.model_dump() for o in pack.opportunities] + \
        [{"title": s.title, "description": s.description, "kind": "solution"} for s in pack.solutions]
    lead.executive_summary = pack.executive_summary
    lead.cold_email_subject = pack.cold_email_subject[:300]
    lead.cold_email = pack.cold_email
    lead.linkedin_message = pack.linkedin_message
    lead.follow_up_email = pack.follow_up_email
    lead.pitch_status = "ready"
    if lead.status == "new":
        lead.status = "researched"
    result = AIAnalysisResult(
        workspace_id=lead.workspace_id, project_id=lead.project_id, job_id=job_id, kind="outreach_pack",
        payload={**pack.model_dump(), "stats": stats, "issues": ranked}, provider=engine.provider_name,
        model=engine.model_name, prompt_version=prompts.PROMPT_VERSIONS["outreach_pack"],
        is_demo=project.is_demo if project else False,
    )
    db.add(result)
    await db.flush()
    lead.analysis_result_id = result.id
    db.add(LeadActivity(lead_id=lead.id, workspace_id=lead.workspace_id, activity_type="pitch_generated",
                        message=f"Outreach pack generated ({engine.provider_name}) from {stats['total']} reviews."))
    await db.flush()
    return lead


# -------------------------------------------------------------------------------------------- Gap Finder
def _is_three_star(rating: float | None) -> bool:
    return rating is not None and 2.5 <= rating < 3.5


async def run_gap_finder(db: AsyncSession, project: Project, engine: AIEngine, job_id: uuid.UUID | None) -> dict:
    businesses = (await db.scalars(select(Business).where(Business.project_id == project.id,
                                                          Business.deleted_at.is_(None)))).all()
    primary = next((b for b in businesses if b.is_primary), businesses[0] if businesses else None)
    if not primary:
        raise AppError("Upload product reviews first.", code="no_reviews")
    competitor = next((b for b in businesses if b.id != primary.id), None)

    async def three_star(biz: Business | None) -> list[Review]:
        if not biz:
            return []
        rows = (await db.scalars(select(Review).where(Review.business_id == biz.id, Review.deleted_at.is_(None))
                                 .order_by(Review.review_date.desc().nullslast()))).all()
        return [r for r in rows if _is_three_star(r.rating)][:120]

    own = await three_star(primary)
    comp = await three_star(competitor)
    if not own:
        raise AppError("No 3-star reviews were found in the uploaded product reviews. The Gap Finder needs ratings "
                       "between 2.5 and 3.4 stars.", code="no_three_star_reviews")
    refs: dict[str, Review] = {}
    own_payload, comp_payload = [], []
    for i, r in enumerate(own):
        refs[f"R{i + 1}"] = r
        own_payload.append({"ref": f"R{i + 1}", "text": r.translated_text or r.text, "rating": r.rating})
    for i, r in enumerate(comp):
        refs[f"C{i + 1}"] = r
        comp_payload.append({"ref": f"C{i + 1}", "text": r.translated_text or r.text, "rating": r.rating})
    cats = {c.slug: list(c.keywords or []) for c in await category_catalog(db, project.workspace_id)}
    report = await engine.run(
        "gap_report", GapReport, system=prompts.GAP_SYSTEM,
        prompt=prompts.gap_prompt(primary.name, own_payload, competitor.name if competitor else None, comp_payload),
        context={"product": primary.name, "reviews": own_payload, "competitor_reviews": comp_payload, "categories": cats},
        heuristic=lambda: heuristics.gap_report(primary.name, own_payload, comp_payload, cats), max_tokens=12000,
    )
    data = report.model_dump()

    def resolve(points: list[dict]) -> list[dict]:
        out = []
        for p in points:
            ev = []
            for ref in p.get("evidence_refs", [])[:4]:
                r = refs.get(ref)
                if r:
                    ev.append({"review_id": str(r.id), "ref": ref, "excerpt": r.text[:280], "rating": r.rating,
                               "competitor": ref.startswith("C"), "date": r.review_date.isoformat() if r.review_date else None})
            out.append({"point": p["point"], "evidence": ev})
        return out

    for key in ("likes", "dislikes", "wishes", "missing_features", "quality_complaints", "price_value",
                "unmet_expectations", "competitor_advantages"):
        data[key] = resolve(data[key])
    data["dataset"] = {"product": primary.name, "competitor": competitor.name if competitor else None,
                       "three_star_reviews": len(own), "competitor_three_star_reviews": len(comp),
                       "total_reviews": await db.scalar(select(func.count()).select_from(Review).where(
                           Review.business_id == primary.id, Review.deleted_at.is_(None)))}
    await db.execute(delete(ProductOpportunity).where(ProductOpportunity.project_id == project.id,
                                                      ProductOpportunity.source == "gap_finder",
                                                      ProductOpportunity.status == "new"))
    for fr in report.feature_recommendations[:6]:
        db.add(ProductOpportunity(
            workspace_id=project.workspace_id, project_id=project.id, business_id=primary.id, title=fr.title[:300],
            description=fr.rationale, recommendation=fr.rationale, opportunity_type="new_feature",
            score=float({"high": 80, "medium": 60, "low": 40}[fr.priority]), impact=fr.priority, effort="medium",
            evidence_review_ids=[r.id for r in own[:3]], source="gap_finder", provider=engine.provider_name,
            job_id=job_id, is_demo=project.is_demo,
        ))
    result = AIAnalysisResult(workspace_id=project.workspace_id, project_id=project.id, job_id=job_id, kind="gap_report",
                              payload=data, provider=engine.provider_name, model=engine.model_name,
                              prompt_version=prompts.PROMPT_VERSIONS["gap_report"], is_demo=project.is_demo)
    db.add(result)
    await db.flush()
    return {"result_id": str(result.id), "opportunity_score": report.opportunity_score, "three_star": len(own)}


# ----------------------------------------------------------------------------------- Competitor intelligence
async def competitor_comparison(db: AsyncSession, project_id: uuid.UUID) -> list[dict]:
    """Side-by-side metrics per business in a project, computed from stored analysis results."""
    businesses = (await db.scalars(select(Business).where(Business.project_id == project_id,
                                                          Business.deleted_at.is_(None))
                                   .order_by(Business.is_primary.desc(), Business.name))).all()
    if not businesses:
        return []
    ids = [b.id for b in businesses]
    agg = {row[0]: row for row in (await db.execute(
        select(Review.business_id, func.count(), func.avg(Review.rating),
               func.sum(case((ReviewSentiment.sentiment == "positive", 1), else_=0)),
               func.sum(case((ReviewSentiment.sentiment == "negative", 1), else_=0)),
               func.sum(case((ReviewSentiment.sentiment == "neutral", 1), else_=0)),
               func.avg(ReviewSentiment.score))
        .outerjoin(ReviewSentiment, ReviewSentiment.review_id == Review.id)
        .where(Review.business_id.in_(ids), Review.deleted_at.is_(None)).group_by(Review.business_id)
    )).all()}
    cat_rows = (await db.execute(
        select(ReviewTopic.kind, ReviewTopic.category_slug, Review.business_id, func.count(func.distinct(ReviewTopic.review_id)))
        .join(Review, Review.id == ReviewTopic.review_id)
        .where(Review.business_id.in_(ids), ReviewTopic.kind.in_(("complaint", "praise")), Review.deleted_at.is_(None))
        .group_by(ReviewTopic.kind, ReviewTopic.category_slug, Review.business_id)
    )).all()
    cats: dict[uuid.UUID, dict[str, Counter]] = defaultdict(lambda: {"complaint": Counter(), "praise": Counter()})
    for kind, slug, bid, n in cat_rows:
        cats[bid][kind][slug] = n
    clusters = (await db.scalars(select(ComplaintCluster).where(ComplaintCluster.project_id == project_id)
                                 .order_by(ComplaintCluster.review_count.desc()))).all()
    out = []
    for b in businesses:
        row = agg.get(b.id)
        count = int(row[1]) if row else 0
        analyzed = int((row[3] or 0) + (row[4] or 0) + (row[5] or 0)) if row else 0

        def pct(v: object, analyzed: int = analyzed) -> float:
            return round(100 * int(v or 0) / analyzed, 1) if analyzed else 0.0

        complaint_labels = [c.label for c in clusters if c.business_id == b.id and c.kind == "complaint"][:5]
        praise_labels = [c.label for c in clusters if c.business_id == b.id and c.kind == "praise"][:5]
        out.append({
            "business_id": str(b.id), "name": b.name, "is_primary": b.is_primary, "review_count": count,
            "avg_rating": round(float(row[2]), 2) if row and row[2] is not None else None,
            "positive_pct": pct(row[3]) if row else 0.0, "negative_pct": pct(row[4]) if row else 0.0,
            "neutral_pct": pct(row[5]) if row else 0.0,
            "avg_sentiment": round(float(row[6]), 3) if row and row[6] is not None else None,
            "complaint_categories": dict(cats[b.id]["complaint"]), "praise_categories": dict(cats[b.id]["praise"]),
            "top_complaints": complaint_labels, "top_praise": praise_labels,
        })
    return out


async def run_competitor_analysis(db: AsyncSession, project: Project, engine: AIEngine, job_id: uuid.UUID | None) -> dict:
    comparison = await competitor_comparison(db, project.id)
    if len(comparison) < 2:
        raise AppError("Add at least one competitor with reviews to run a comparison.", code="no_competitors")
    payload = [{"key": f"B{i + 1}", "name": c["name"], "is_you": c["is_primary"], "reviews": c["review_count"],
                "avg_rating": c["avg_rating"], "positive_pct": c["positive_pct"], "negative_pct": c["negative_pct"],
                "top_complaints": c["top_complaints"], "top_praise": c["top_praise"]} for i, c in enumerate(comparison)]
    heur_payload = [{"key": p["key"], "name": p["name"], "avg_rating": p["avg_rating"],
                     "positive_pct": p["positive_pct"], "negative_pct": p["negative_pct"],
                     "praise_labels": p["top_praise"], "complaint_labels": p["top_complaints"]} for p in payload]
    analysis = await engine.run(
        "competitor_analysis", CompetitorAnalysis, system=prompts.COMPETITOR_SYSTEM,
        prompt=prompts.competitor_prompt(payload), context={"businesses": heur_payload},
        heuristic=lambda: heuristics.competitor_analysis(heur_payload),
    )
    data = analysis.model_dump()
    key_to_biz = {p["key"]: comparison[i] for i, p in enumerate(payload)}
    data["profiles"] = [{**p, "business_id": key_to_biz[p["business_key"]]["business_id"],
                         "name": key_to_biz[p["business_key"]]["name"]}
                        for p in data["profiles"] if p["business_key"] in key_to_biz]
    data["comparison"] = comparison
    result = AIAnalysisResult(workspace_id=project.workspace_id, project_id=project.id, job_id=job_id,
                              kind="competitor_analysis", payload=data, provider=engine.provider_name,
                              model=engine.model_name, prompt_version=prompts.PROMPT_VERSIONS["competitor_analysis"],
                              is_demo=project.is_demo)
    db.add(result)
    await db.flush()
    return {"result_id": str(result.id), "businesses": len(comparison)}
