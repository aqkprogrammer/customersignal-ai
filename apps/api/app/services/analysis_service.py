"""Review analysis pipeline: sentiment, topics, complaints, translation, embeddings, clustering, trends, opportunities."""

from __future__ import annotations

import logging
import uuid
from collections import Counter, defaultdict
from collections.abc import Awaitable, Callable
from datetime import date, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import heuristics, prompts
from app.ai.embeddings import greedy_cluster
from app.ai.engine import AIEngine
from app.ai.schemas import ClusterNaming, ProjectInsights, ReviewAnalysisItem, ReviewBatchAnalysis
from app.core.config import settings
from app.core.security import utcnow
from app.models import (
    AIAnalysisResult,
    Business,
    ComplaintCluster,
    ProductOpportunity,
    Project,
    Review,
    ReviewCategory,
    ReviewSentiment,
    ReviewTopic,
)
from app.services.entitlements import record_usage, remaining_review_quota

log = logging.getLogger(__name__)
Progress = Callable[[float, str, int, int], Awaitable[bool]]  # returns False if the job was cancelled


async def category_catalog(db: AsyncSession, workspace_id: uuid.UUID) -> list[ReviewCategory]:
    rows = (await db.scalars(
        select(ReviewCategory).where((ReviewCategory.workspace_id.is_(None)) | (ReviewCategory.workspace_id == workspace_id))
    )).all()
    custom_slugs = {c.slug for c in rows if c.workspace_id}
    return [c for c in rows if c.workspace_id or c.slug not in custom_slugs]


def _excerpt_ok(excerpt: str | None, text: str) -> str | None:
    """Anti-fabrication: keep an excerpt only if it really appears in the review text."""
    if not excerpt:
        return None
    ex = excerpt.strip().strip('"“”')
    if len(ex) < 3:
        return None
    if ex in text:
        return ex
    norm = " ".join(text.lower().split())
    if " ".join(ex.lower().split()) in norm:
        return ex
    return None


async def _store_item(db: AsyncSession, review: Review, item: ReviewAnalysisItem, valid_slugs: set[str],
                      provider: str, model: str | None) -> None:
    source_text = review.text
    await db.execute(delete(ReviewSentiment).where(ReviewSentiment.review_id == review.id))
    await db.execute(delete(ReviewTopic).where(ReviewTopic.review_id == review.id))
    db.add(ReviewSentiment(review_id=review.id, workspace_id=review.workspace_id, sentiment=item.sentiment,
                           score=item.sentiment_score, emotion=item.emotion, confidence=item.confidence,
                           explanation=item.explanation, provider=provider, model=model,
                           prompt_version=prompts.PROMPT_VERSIONS["classify_reviews"]))
    for kind, signals in (("complaint", item.complaints), ("praise", item.praises)):
        for sig in signals:
            slug = sig.category if sig.category in valid_slugs else "other"
            excerpt = _excerpt_ok(sig.excerpt, source_text)
            if excerpt is None and review.translated_text:
                excerpt = _excerpt_ok(sig.excerpt, review.translated_text)
            db.add(ReviewTopic(review_id=review.id, workspace_id=review.workspace_id, project_id=review.project_id,
                               kind=kind, category_slug=slug, label=sig.label[:300], excerpt=excerpt,
                               severity=sig.severity if kind == "complaint" else 1))
    for fr in item.feature_requests:
        db.add(ReviewTopic(review_id=review.id, workspace_id=review.workspace_id, project_id=review.project_id,
                           kind="feature_request", category_slug="other", label=fr.label[:300],
                           excerpt=_excerpt_ok(fr.excerpt, source_text), severity=2))
    for t in item.topics[:4]:
        db.add(ReviewTopic(review_id=review.id, workspace_id=review.workspace_id, project_id=review.project_id,
                           kind="topic", category_slug=t if t in valid_slugs else "other", label=t[:300], severity=1))
    review.language = item.language[:12] if item.language else review.language
    if item.translation and item.language and item.language != "en":
        review.translated_text = item.translation
    review.analysis_status = "analyzed"
    review.analyzed_at = utcnow()


async def analyze_reviews(db: AsyncSession, project: Project, engine: AIEngine, progress: Progress,
                          *, reanalyze: bool = False, commit: bool = True) -> dict:
    """Stage 1: per-review classification. Respects the workspace's monthly review quota."""
    cats = await category_catalog(db, project.workspace_id)
    cat_map = {c.slug: list(c.keywords or []) for c in cats}
    valid = set(cat_map)
    q = select(Review).where(Review.project_id == project.id, Review.deleted_at.is_(None))
    if not reanalyze:
        q = q.where(Review.analysis_status != "analyzed")
    reviews = (await db.scalars(q.order_by(Review.review_date.desc().nullslast(), Review.created_at))).all()
    quota = await remaining_review_quota(db, project.workspace_id)
    skipped_for_quota = 0
    if quota is not None and not project.is_demo and len(reviews) > quota:
        skipped_for_quota = len(reviews) - quota
        reviews = reviews[:quota]
    total = len(reviews)
    batch_size = max(1, settings.ai_batch_size)
    processed = 0
    for start in range(0, total, batch_size):
        batch = reviews[start:start + batch_size]
        refs = {f"R{i + 1}": r for i, r in enumerate(batch)}
        payload = [{"ref": ref, "text": r.text, "rating": r.rating, "title": r.title} for ref, r in refs.items()]

        def _heur(refs=refs) -> ReviewBatchAnalysis:
            return ReviewBatchAnalysis(items=[heuristics.classify_review(ref, r.text, r.rating, cat_map)
                                              for ref, r in refs.items()])

        result = await engine.run(
            "classify_reviews", ReviewBatchAnalysis, system=prompts.CLASSIFY_SYSTEM,
            prompt=prompts.classify_prompt(payload, [{"slug": c.slug, "name": c.name} for c in cats]),
            context={"reviews": payload, "categories": cat_map}, heuristic=_heur, max_tokens=12000,
        )
        by_ref = {it.ref: it for it in result.items}
        provider = engine.provider.name if engine.provider.is_llm and not engine.used_fallback else "heuristic"
        for ref, review in refs.items():
            item = by_ref.get(ref) or heuristics.classify_review(ref, review.text, review.rating, cat_map)
            await _store_item(db, review, item, valid, provider if ref in by_ref else "heuristic",
                              engine.model_name)
        processed += len(batch)
        await db.flush()
        if not project.is_demo:
            await record_usage(db, project.workspace_id, "reviews_analyzed", len(batch), reference_id=project.id)
        if commit:
            await db.commit()
        if not await progress(5 + 70 * processed / max(total, 1), f"Analyzing reviews ({processed}/{total})",
                              processed, total):
            return {"cancelled": True, "analyzed": processed}
    return {"analyzed": processed, "skipped_for_quota": skipped_for_quota}


async def embed_reviews(db: AsyncSession, project: Project, engine: AIEngine) -> str:
    reviews = (await db.scalars(select(Review).where(Review.project_id == project.id, Review.deleted_at.is_(None),
                                                     Review.embedding.is_(None)))).all()
    if not reviews:
        return "none"
    vectors, source = await engine.embed([r.translated_text or r.text for r in reviews])
    for r, v in zip(reviews, vectors, strict=True):
        r.embedding = v
    await db.flush()
    return source


def _severity(count: int, total_reviews: int, recent: int, avg_rating: float | None) -> float:
    freq = min(1.0, (count / max(total_reviews, 1)) * 4)
    recency = recent / count if count else 0
    rating_factor = (5 - avg_rating) / 4 if avg_rating is not None else 0.5
    return round(100 * (0.5 * freq + 0.25 * recency + 0.25 * rating_factor), 1)


async def cluster_project(db: AsyncSession, project: Project, engine: AIEngine, job_id: uuid.UUID | None) -> list[dict]:
    """Group complaints/praise/feature requests into recurring themes per business; compute severity + trend."""
    rows = (await db.execute(
        select(ReviewTopic, Review.rating, Review.review_date, Review.business_id, Review.id)
        .join(Review, Review.id == ReviewTopic.review_id)
        .where(ReviewTopic.project_id == project.id, ReviewTopic.kind.in_(("complaint", "praise", "feature_request")),
               Review.deleted_at.is_(None))
    )).all()
    await db.execute(update(ReviewTopic).where(ReviewTopic.project_id == project.id).values(cluster_id=None))
    await db.execute(delete(ComplaintCluster).where(ComplaintCluster.project_id == project.id))
    if not rows:
        return []
    totals = dict((await db.execute(
        select(Review.business_id, func.count()).where(Review.project_id == project.id, Review.deleted_at.is_(None))
        .group_by(Review.business_id)
    )).all())
    anchor = max((r[2] for r in rows if r[2]), default=date.today())
    recent_from, prev_from = anchor - timedelta(days=30), anchor - timedelta(days=60)

    groups: dict[tuple, list] = defaultdict(list)
    for topic, rating, rdate, business_id, review_id in rows:
        groups[(business_id, topic.kind, topic.category_slug)].append((topic, rating, rdate, review_id))

    label_vectors, _ = await engine.embed([t.label for (t, *_r) in (x for g in groups.values() for x in g)])
    idx = 0
    raw_clusters: list[dict] = []
    for (business_id, kind, cat), members in groups.items():
        vecs = label_vectors[idx: idx + len(members)]
        idx += len(members)
        assignments = greedy_cluster(vecs, threshold=0.55 if kind == "feature_request" else 0.35)
        sub: dict[int, list] = defaultdict(list)
        for a, m in zip(assignments, members, strict=True):
            sub[a].append(m)
        for sub_members in sub.values():
            review_ids = list(dict.fromkeys(m[3] for m in sub_members))
            ratings = [m[1] for m in sub_members if m[1] is not None]
            dates = [m[2] for m in sub_members if m[2]]
            recent = sum(1 for d in dates if d > recent_from)
            previous = sum(1 for d in dates if prev_from < d <= recent_from)
            label = Counter(m[0].label for m in sub_members).most_common(1)[0][0]
            avg = round(sum(ratings) / len(ratings), 2) if ratings else None
            if previous == 0 and recent > 0 and (not dates or min(dates) > recent_from):
                trend = "new"
            elif recent > previous * 1.25 and recent - previous >= 2:
                trend = "rising"
            elif recent < previous * 0.75 and previous - recent >= 2:
                trend = "declining"
            else:
                trend = "stable"
            reps = sorted(sub_members, key=lambda m: (-(m[0].severity or 1), m[1] or 5))
            raw_clusters.append({
                "business_id": business_id, "kind": kind, "category": cat, "label": label,
                "topics": [m[0] for m in sub_members], "review_ids": review_ids, "count": len(review_ids),
                "avg_rating": avg, "recent": recent, "previous": previous, "trend": trend,
                "first_seen": min(dates) if dates else None, "last_seen": max(dates) if dates else None,
                "severity": _severity(len(review_ids), totals.get(business_id, 1), recent, avg) if kind == "complaint"
                else 0.0,
                "reps": list(dict.fromkeys(m[3] for m in reps))[:5],
                "samples": [m[0].excerpt for m in reps if m[0].excerpt][:3],
            })

    # Ask the LLM for clean theme names (only for multi-member clusters; singletons keep their label).
    named = [c for c in raw_clusters if c["count"] >= 2]
    for i, c in enumerate(raw_clusters):
        c["key"] = f"C{i + 1}"
    if named and engine.provider.is_llm:
        payload = [{"key": c["key"], "kind": c["kind"], "category": c["category"],
                    "statements": list(dict.fromkeys(t.label for t in c["topics"]))[:8], "samples": c["samples"]}
                   for c in named[:60]]
        naming = await engine.run(
            "name_clusters", ClusterNaming, system=prompts.NAMING_SYSTEM, prompt=prompts.naming_prompt(payload),
            context={"clusters": [{"key": c["key"], "label": c["label"]} for c in named[:60]]},
            heuristic=lambda: ClusterNaming(clusters=[]), max_tokens=6000,
        )
        names = {n.key: n for n in naming.clusters}
        for c in raw_clusters:
            if c["key"] in names:
                c["label"] = names[c["key"]].label[:300]
                c["summary"] = names[c["key"]].summary

    out = []
    for c in raw_clusters:
        cluster = ComplaintCluster(
            workspace_id=project.workspace_id, project_id=project.id, business_id=c["business_id"], kind=c["kind"],
            category_slug=c["category"], label=c["label"], summary=c.get("summary"), review_count=c["count"],
            avg_rating=c["avg_rating"], severity_score=c["severity"], trend=c["trend"], recent_count=c["recent"],
            previous_count=c["previous"], first_seen=c["first_seen"], last_seen=c["last_seen"],
            representative_review_ids=c["reps"], job_id=job_id, is_demo=project.is_demo,
        )
        db.add(cluster)
        await db.flush()
        for t in c["topics"]:
            t.cluster_id = cluster.id
        c["id"] = cluster.id
        out.append(c)
    await db.flush()
    return out


async def project_stats(db: AsyncSession, project_id: uuid.UUID, business_id: uuid.UUID | None = None) -> dict:
    filters = [Review.project_id == project_id, Review.deleted_at.is_(None)]
    if business_id:
        filters.append(Review.business_id == business_id)
    total, avg_rating = (await db.execute(select(func.count(), func.avg(Review.rating)).where(*filters))).one()
    sent = dict((await db.execute(
        select(ReviewSentiment.sentiment, func.count()).join(Review, Review.id == ReviewSentiment.review_id)
        .where(*filters).group_by(ReviewSentiment.sentiment)
    )).all())
    analyzed = sum(sent.values())

    def pct(k: str) -> float:
        return round(100 * sent.get(k, 0) / analyzed, 1) if analyzed else 0.0

    return {"total": int(total or 0), "analyzed": analyzed,
            "avg_rating": round(float(avg_rating), 2) if avg_rating is not None else None,
            "positive_pct": pct("positive"), "neutral_pct": pct("neutral"), "negative_pct": pct("negative")}


async def generate_opportunities(db: AsyncSession, project: Project, engine: AIEngine, clusters: list[dict],
                                 job_id: uuid.UUID | None) -> ProjectInsights:
    stats = await project_stats(db, project.id)
    primary = await db.scalar(select(Business).where(Business.project_id == project.id, Business.is_primary.is_(True)))
    own = [c for c in clusters if primary is None or c["business_id"] == primary.id] or clusters
    ranked = sorted(own, key=lambda c: (c["kind"] != "complaint", -c["severity"], -c["count"]))[:25]
    compact = [{"key": c["key"], "kind": c["kind"], "category": c["category"], "label": c["label"],
                "count": c["count"], "avg_rating": c["avg_rating"], "severity": c["severity"], "trend": c["trend"],
                "samples": c["samples"]} for c in ranked]
    insights = await engine.run(
        "project_insights", ProjectInsights, system=prompts.INSIGHTS_SYSTEM,
        prompt=prompts.insights_prompt(project.business_name or project.name, stats, compact),
        context={"clusters": compact, "stats": stats},
        heuristic=lambda: heuristics.project_insights(compact, stats),
    )
    by_key = {c["key"]: c for c in clusters}
    await db.execute(delete(ProductOpportunity).where(ProductOpportunity.project_id == project.id,
                                                      ProductOpportunity.source == "analysis",
                                                      ProductOpportunity.status == "new"))
    impact_w = {"high": 1.0, "medium": 0.6, "low": 0.3}
    effort_w = {"low": 1.0, "medium": 0.75, "high": 0.5}
    for opp in insights.opportunities:
        linked = [by_key[k] for k in opp.cluster_keys if k in by_key]
        if not linked:
            continue  # grounding: every opportunity must be backed by at least one real theme
        evidence = list(dict.fromkeys(rid for c in linked for rid in c["reps"]))[:8]
        support = sum(c["count"] for c in linked)
        # Score blends the evidence (theme severity / share of reviews) with the impact-vs-effort judgement.
        evidence_strength = max([c["severity"] for c in linked] + [min(100.0, 400 * support / max(stats["total"], 1))])
        score = round(min(100.0, 0.55 * evidence_strength + 45 * impact_w[opp.impact] * effort_w[opp.effort]), 1)
        db.add(ProductOpportunity(
            workspace_id=project.workspace_id, project_id=project.id, business_id=linked[0]["business_id"],
            cluster_id=linked[0].get("id"), title=opp.title[:300], description=opp.description,
            recommendation=opp.recommendation, opportunity_type=opp.opportunity_type, score=score, impact=opp.impact,
            effort=opp.effort, evidence_review_ids=evidence, source="analysis", provider=engine.provider_name,
            job_id=job_id, is_demo=project.is_demo,
        ))
    db.add(AIAnalysisResult(
        workspace_id=project.workspace_id, project_id=project.id, job_id=job_id, kind="project_insights",
        payload=insights.model_dump(), provider=engine.provider_name, model=engine.model_name,
        prompt_version=prompts.PROMPT_VERSIONS["project_insights"], is_demo=project.is_demo,
    ))
    await db.flush()
    return insights


async def run_full_analysis(db: AsyncSession, project: Project, engine: AIEngine, progress: Progress,
                            job_id: uuid.UUID | None, *, reanalyze: bool = False, commit: bool = True) -> dict:
    project.status = "analyzing"
    if commit:
        await db.commit()
    try:
        await progress(2, "Preparing reviews", 0, 0)
        stage1 = await analyze_reviews(db, project, engine, progress, reanalyze=reanalyze, commit=commit)
        if stage1.get("cancelled"):
            return stage1
        await progress(78, "Generating embeddings", 0, 0)
        emb_source = await embed_reviews(db, project, engine)
        await progress(85, "Clustering recurring themes", 0, 0)
        clusters = await cluster_project(db, project, engine, job_id)
        await progress(93, "Discovering opportunities", 0, 0)
        insights = await generate_opportunities(db, project, engine, clusters, job_id)
        project.last_analyzed_at = utcnow()
        stats = await project_stats(db, project.id)
        return {**stage1, "embeddings": emb_source, "clusters": len(clusters),
                "opportunities": len(insights.opportunities), "stats": stats, "provider": engine.provider_name,
                "warnings": engine.warnings}
    finally:
        project.status = "active" if project.status == "analyzing" else project.status
