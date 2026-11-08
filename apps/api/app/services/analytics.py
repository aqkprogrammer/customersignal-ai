"""Workspace analytics. Every number is computed from stored reviews and analysis results — nothing is hardcoded."""

from __future__ import annotations

import re
import uuid
from collections import Counter
from datetime import date, timedelta

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AnalysisJob,
    ComplaintCluster,
    ProductOpportunity,
    Project,
    Report,
    Review,
    ReviewSentiment,
    ReviewTopic,
)
from app.services.entitlements import get_entitlements, usage_for_period

STOPWORDS = set("""a about above after again against all am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have having he her
here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or
other our ours out over own same she should so some such than that the their theirs them then there these they
this those through to too under until up very was we were what when where which while who whom why will with
would you your yours also really get got one even still back went go us place time like said told came made""".split())
_WORD = re.compile(r"[a-zA-Z][a-zA-Z']{2,}")


class Filters:
    def __init__(self, workspace_id: uuid.UUID, project_id: uuid.UUID | None = None,
                 business_id: uuid.UUID | None = None, date_from: date | None = None, date_to: date | None = None,
                 source: str | None = None) -> None:
        self.workspace_id = workspace_id
        self.project_id = project_id
        self.business_id = business_id
        self.date_from = date_from
        self.date_to = date_to
        self.source = source

    def apply(self, q: Select) -> Select:
        q = q.where(Review.workspace_id == self.workspace_id, Review.deleted_at.is_(None))
        if self.project_id:
            q = q.where(Review.project_id == self.project_id)
        else:
            # Exclude archived/deleted projects from workspace-wide analytics.
            q = q.where(Review.project_id.in_(select(Project.id).where(
                Project.workspace_id == self.workspace_id, Project.deleted_at.is_(None), Project.status != "archived")))
        if self.business_id:
            q = q.where(Review.business_id == self.business_id)
        if self.date_from:
            q = q.where(Review.review_date >= self.date_from)
        if self.date_to:
            q = q.where(Review.review_date <= self.date_to)
        if self.source:
            q = q.where(Review.platform == self.source)
        return q


async def kpis(db: AsyncSession, f: Filters) -> dict:
    total, avg_rating = (await db.execute(f.apply(select(func.count(), func.avg(Review.rating))))).one()
    sent = dict((await db.execute(
        f.apply(select(ReviewSentiment.sentiment, func.count()).join_from(Review, ReviewSentiment, ReviewSentiment.review_id == Review.id))
        .group_by(ReviewSentiment.sentiment))).all())
    avg_score = (await db.execute(f.apply(select(func.avg(ReviewSentiment.score))
                                          .join_from(Review, ReviewSentiment, ReviewSentiment.review_id == Review.id)))).scalar()
    analyzed = sum(sent.values())

    def pct(k: str) -> float:
        return round(100 * sent.get(k, 0) / analyzed, 1) if analyzed else 0.0

    return {
        "total_reviews": int(total or 0), "analyzed_reviews": analyzed,
        "positive_pct": pct("positive"), "neutral_pct": pct("neutral"), "negative_pct": pct("negative"),
        "positive": sent.get("positive", 0), "neutral": sent.get("neutral", 0), "negative": sent.get("negative", 0),
        "avg_sentiment": round(float(avg_score), 3) if avg_score is not None else None,
        "avg_rating": round(float(avg_rating), 2) if avg_rating is not None else None,
    }


async def volume_over_time(db: AsyncSession, f: Filters) -> list[dict]:
    span = (await db.execute(f.apply(select(func.min(Review.review_date), func.max(Review.review_date))))).one()
    if not span[0]:
        return []
    unit = "week" if (span[1] - span[0]).days <= 120 else "month"
    bucket = func.date_trunc(unit, Review.review_date).label("bucket")
    rows = (await db.execute(
        f.apply(select(bucket, ReviewSentiment.sentiment, func.count(), func.avg(Review.rating))
                .outerjoin_from(Review, ReviewSentiment, ReviewSentiment.review_id == Review.id))
        .where(Review.review_date.is_not(None)).group_by(bucket, ReviewSentiment.sentiment).order_by(bucket)
    )).all()
    series: dict[str, dict] = {}
    for b, sentiment, n, avg in rows:
        key = b.date().isoformat()
        entry = series.setdefault(key, {"period": key, "total": 0, "positive": 0, "neutral": 0, "negative": 0,
                                        "unanalyzed": 0, "_rating_sum": 0.0, "_rating_n": 0})
        entry["total"] += n
        entry[sentiment or "unanalyzed"] += n
        if avg is not None:
            entry["_rating_sum"] += float(avg) * n
            entry["_rating_n"] += n
    out = []
    for e in series.values():
        e["avg_rating"] = round(e.pop("_rating_sum") / e["_rating_n"], 2) if e["_rating_n"] else None
        e.pop("_rating_n")
        e["unit"] = unit
        out.append(e)
    return out


async def rating_distribution(db: AsyncSession, f: Filters) -> list[dict]:
    star = func.round(Review.rating).label("star")
    rows = dict((await db.execute(f.apply(select(star, func.count())).where(Review.rating.is_not(None))
                                  .group_by(star))).all())
    return [{"rating": s, "count": int(rows.get(s, 0))} for s in (1, 2, 3, 4, 5)]


async def category_breakdown(db: AsyncSession, f: Filters, kind: str = "complaint") -> list[dict]:
    rows = (await db.execute(
        f.apply(select(ReviewTopic.category_slug, func.count(func.distinct(ReviewTopic.review_id)))
                .join_from(Review, ReviewTopic, ReviewTopic.review_id == Review.id))
        .where(ReviewTopic.kind == kind).group_by(ReviewTopic.category_slug)
        .order_by(func.count(func.distinct(ReviewTopic.review_id)).desc())
    )).all()
    return [{"category": c, "count": int(n)} for c, n in rows]


async def emotion_breakdown(db: AsyncSession, f: Filters) -> list[dict]:
    rows = (await db.execute(
        f.apply(select(ReviewSentiment.emotion, func.count()).join_from(Review, ReviewSentiment, ReviewSentiment.review_id == Review.id))
        .group_by(ReviewSentiment.emotion).order_by(func.count().desc()))).all()
    return [{"emotion": e or "neutral", "count": int(n)} for e, n in rows]


async def top_keywords(db: AsyncSession, f: Filters, limit: int = 20) -> list[dict]:
    rows = (await db.execute(
        f.apply(select(Review.text, ReviewSentiment.sentiment).outerjoin_from(Review, ReviewSentiment, ReviewSentiment.review_id == Review.id))
        .order_by(Review.review_date.desc().nullslast()).limit(5000))).all()
    counts: Counter = Counter()
    neg: Counter = Counter()
    for text, sentiment in rows:
        words = {w.lower().strip("'") for w in _WORD.findall(text)} - STOPWORDS
        counts.update(words)
        if sentiment == "negative":
            neg.update(words)
    return [{"keyword": w, "count": n, "negative_share": round(neg[w] / n, 2)} for w, n in counts.most_common(limit)]


async def clusters(db: AsyncSession, f: Filters, kind: str = "complaint", limit: int = 10,
                   order: str = "count") -> list[dict]:
    q = select(ComplaintCluster).where(ComplaintCluster.workspace_id == f.workspace_id, ComplaintCluster.kind == kind)
    if f.project_id:
        q = q.where(ComplaintCluster.project_id == f.project_id)
    else:
        q = q.where(ComplaintCluster.project_id.in_(select(Project.id).where(
            Project.workspace_id == f.workspace_id, Project.deleted_at.is_(None), Project.status != "archived")))
    if f.business_id:
        q = q.where(ComplaintCluster.business_id == f.business_id)
    if order == "trending":
        q = q.where(ComplaintCluster.trend.in_(("rising", "new"))).order_by(ComplaintCluster.recent_count.desc())
    elif order == "severity":
        q = q.order_by(ComplaintCluster.severity_score.desc())
    else:
        q = q.order_by(ComplaintCluster.review_count.desc())
    return [cluster_dict(c) for c in (await db.scalars(q.limit(limit))).all()]


def cluster_dict(c: ComplaintCluster) -> dict:
    return {"id": str(c.id), "project_id": str(c.project_id), "business_id": str(c.business_id) if c.business_id else None,
            "kind": c.kind, "category": c.category_slug, "label": c.label, "summary": c.summary,
            "review_count": c.review_count, "avg_rating": c.avg_rating, "severity_score": c.severity_score,
            "trend": c.trend, "recent_count": c.recent_count, "previous_count": c.previous_count,
            "first_seen": c.first_seen.isoformat() if c.first_seen else None,
            "last_seen": c.last_seen.isoformat() if c.last_seen else None, "is_demo": c.is_demo}


async def usage_summary(db: AsyncSession, workspace_id: uuid.UUID) -> dict:
    ent = await get_entitlements(db, workspace_id)
    projects = await db.scalar(select(func.count()).select_from(Project).where(
        Project.workspace_id == workspace_id, Project.deleted_at.is_(None), Project.is_demo.is_(False)))
    return {
        "plan": ent.to_dict(),
        "reviews_analyzed": {"used": await usage_for_period(db, workspace_id, "reviews_analyzed"),
                             "limit": ent.limits.get("max_reviews_per_month")},
        "reports_generated": {"used": await usage_for_period(db, workspace_id, "reports_generated"),
                              "limit": ent.limits.get("max_reports_per_month")},
        "projects": {"used": int(projects or 0), "limit": ent.limits.get("max_projects")},
        "ai_tokens": {"used": await usage_for_period(db, workspace_id, "ai_tokens"), "limit": None},
    }


async def dashboard(db: AsyncSession, f: Filters) -> dict:
    opps = (await db.scalars(
        select(ProductOpportunity).where(ProductOpportunity.workspace_id == f.workspace_id,
                                         ProductOpportunity.status != "dismissed",
                                         *( [ProductOpportunity.project_id == f.project_id] if f.project_id else []))
        .order_by(ProductOpportunity.created_at.desc(), ProductOpportunity.score.desc()).limit(5))).all()
    reports = (await db.scalars(select(Report).where(Report.workspace_id == f.workspace_id, Report.deleted_at.is_(None))
                                .order_by(Report.created_at.desc()).limit(5))).all()
    jobs = (await db.scalars(select(AnalysisJob).where(AnalysisJob.workspace_id == f.workspace_id)
                             .order_by(AnalysisJob.created_at.desc()).limit(8))).all()
    from app.services.intelligence import competitor_comparison

    comp_project = f.project_id
    if comp_project is None:
        comp_project = await db.scalar(
            select(Project.id).where(Project.workspace_id == f.workspace_id, Project.deleted_at.is_(None),
                                     Project.status != "archived", Project.kind == "standard")
            .order_by(Project.is_demo, Project.created_at.desc()).limit(1))
    comparison = await competitor_comparison(db, comp_project) if comp_project else []
    return {
        "kpis": await kpis(db, f),
        "sentiment_over_time": await volume_over_time(db, f),
        "rating_distribution": await rating_distribution(db, f),
        "complaint_categories": await category_breakdown(db, f, "complaint"),
        "top_keywords": await top_keywords(db, f, 15),
        "top_complaints": await clusters(db, f, "complaint", 6, "count"),
        "trending_issues": await clusters(db, f, "complaint", 5, "trending"),
        "competitor_comparison": comparison if len(comparison) > 1 else [],
        "opportunities": [{"id": str(o.id), "title": o.title, "description": o.description, "score": o.score,
                           "impact": o.impact, "opportunity_type": o.opportunity_type, "is_demo": o.is_demo,
                           "created_at": o.created_at.isoformat()} for o in opps],
        "recent_reports": [{"id": str(r.id), "title": r.title, "report_type": r.report_type, "status": r.status,
                            "created_at": r.created_at.isoformat(), "is_demo": r.is_demo} for r in reports],
        "activity": [{"id": str(j.id), "job_type": j.job_type, "status": j.status, "progress": j.progress,
                      "stage": j.stage, "created_at": j.created_at.isoformat(),
                      "completed_at": j.completed_at.isoformat() if j.completed_at else None} for j in jobs],
        "usage": await usage_summary(db, f.workspace_id),
    }


def default_range(days: int = 90) -> tuple[date, date]:
    today = date.today()
    return today - timedelta(days=days), today
