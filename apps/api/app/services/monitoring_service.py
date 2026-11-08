"""Monitoring rules evaluation (scheduled hourly by the worker, and on demand after each analysis)."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import utcnow
from app.models import (
    Business,
    ComplaintCluster,
    MonitoringEvent,
    MonitoringRule,
    Project,
    Review,
    ReviewSentiment,
)
from app.services.integrations_service import deliver_webhook_event
from app.services.notification_service import notify_workspace

RULE_DESCRIPTIONS = {
    "negative_sentiment_above": "Negative sentiment exceeds a percentage",
    "average_rating_below": "Average rating falls below a value",
    "rating_drop": "Average rating drops by at least N stars vs. the previous window",
    "new_recurring_complaint": "A new recurring complaint appears (min. N reviews)",
    "competitor_sentiment_change": "A competitor's negative sentiment changes by N points",
    "review_volume_spike": "Review volume is N× the previous window",
}

_day = func.coalesce(Review.review_date, func.date(Review.created_at))


async def _window_stats(db: AsyncSession, project_id, business_id, start: date, end: date) -> dict:
    filters = [Review.project_id == project_id, Review.deleted_at.is_(None), _day > start, _day <= end]
    if business_id:
        filters.append(Review.business_id == business_id)
    count, avg = (await db.execute(select(func.count(), func.avg(Review.rating)).where(*filters))).one()
    neg, analyzed = (await db.execute(
        select(func.count().filter(ReviewSentiment.sentiment == "negative"), func.count(ReviewSentiment.id))
        .select_from(Review).join(ReviewSentiment, ReviewSentiment.review_id == Review.id).where(*filters)
    )).one()
    return {"count": int(count or 0), "avg_rating": float(avg) if avg is not None else None,
            "negative_pct": round(100 * neg / analyzed, 1) if analyzed else None}


async def evaluate_rule(db: AsyncSession, rule: MonitoringRule) -> MonitoringEvent | None:
    now = utcnow()
    rule.last_evaluated_at = now
    if rule.last_triggered_at and (now - rule.last_triggered_at).total_seconds() < rule.cooldown_hours * 3600:
        return None
    project = await db.get(Project, rule.project_id)
    if not project or project.deleted_at:
        return None
    today = date.today()
    cur_start, prev_start = today - timedelta(days=rule.window_days), today - timedelta(days=2 * rule.window_days)
    business_id = rule.business_id
    if business_id is None and rule.rule_type != "competitor_sentiment_change":
        business_id = await db.scalar(select(Business.id).where(Business.project_id == project.id,
                                                                Business.is_primary.is_(True)))
    triggered: tuple[str, str, float, str] | None = None  # title, message, value, severity
    if rule.rule_type in ("negative_sentiment_above", "average_rating_below", "rating_drop", "review_volume_spike"):
        cur = await _window_stats(db, project.id, business_id, cur_start, today)
        if rule.rule_type == "negative_sentiment_above" and cur["negative_pct"] is not None:
            rule.last_value = cur["negative_pct"]
            if cur["negative_pct"] > rule.threshold and cur["count"] >= 3:
                triggered = (f"Negative sentiment at {cur['negative_pct']}% for {project.name}",
                             f"{cur['negative_pct']}% of {cur['count']} reviews in the last {rule.window_days} days are "
                             f"negative (threshold {rule.threshold:g}%).", cur["negative_pct"],
                             "critical" if cur["negative_pct"] > rule.threshold * 1.5 else "warning")
        elif rule.rule_type == "average_rating_below" and cur["avg_rating"] is not None:
            rule.last_value = cur["avg_rating"]
            if cur["avg_rating"] < rule.threshold and cur["count"] >= 3:
                triggered = (f"Average rating dropped to {cur['avg_rating']:.2f}★ for {project.name}",
                             f"The average rating over the last {rule.window_days} days is {cur['avg_rating']:.2f} "
                             f"(threshold {rule.threshold:g}).", cur["avg_rating"], "warning")
        else:
            prev = await _window_stats(db, project.id, business_id, prev_start, cur_start)
            if rule.rule_type == "rating_drop" and cur["avg_rating"] is not None and prev["avg_rating"] is not None:
                drop = round(prev["avg_rating"] - cur["avg_rating"], 2)
                rule.last_value = drop
                if drop >= rule.threshold:
                    triggered = (f"Rating dropped by {drop:.2f}★ for {project.name}",
                                 f"Average rating fell from {prev['avg_rating']:.2f} to {cur['avg_rating']:.2f}.",
                                 drop, "warning")
            elif rule.rule_type == "review_volume_spike" and prev["count"]:
                ratio = round(cur["count"] / prev["count"], 2)
                rule.last_value = ratio
                if ratio >= rule.threshold and cur["count"] >= 5:
                    triggered = (f"Review volume spike for {project.name}",
                                 f"{cur['count']} reviews in the last {rule.window_days} days vs {prev['count']} before "
                                 f"({ratio}×).", ratio, "info")
    elif rule.rule_type == "new_recurring_complaint":
        q = select(ComplaintCluster).where(ComplaintCluster.project_id == project.id, ComplaintCluster.kind == "complaint",
                                           ComplaintCluster.trend.in_(("new", "rising")),
                                           ComplaintCluster.review_count >= rule.threshold,
                                           ComplaintCluster.created_at > (rule.last_triggered_at or rule.created_at))
        if business_id:
            q = q.where(ComplaintCluster.business_id == business_id)
        new = (await db.scalars(q.order_by(ComplaintCluster.severity_score.desc()))).all()
        rule.last_value = float(len(new))
        if new:
            c = new[0]
            triggered = (f"Emerging complaint: {c.label}",
                         f"'{c.label}' now appears in {c.review_count} reviews (trend: {c.trend}).",
                         float(c.review_count), "warning")
    elif rule.rule_type == "competitor_sentiment_change":
        comps = (await db.scalars(select(Business).where(Business.project_id == project.id,
                                                         Business.is_primary.is_(False),
                                                         Business.deleted_at.is_(None)))).all()
        biggest = 0.0
        for comp in comps:
            cur = await _window_stats(db, project.id, comp.id, cur_start, today)
            prev = await _window_stats(db, project.id, comp.id, prev_start, cur_start)
            if cur["negative_pct"] is None or prev["negative_pct"] is None:
                continue
            delta = round(cur["negative_pct"] - prev["negative_pct"], 1)
            biggest = max(biggest, abs(delta))
            if abs(delta) >= rule.threshold:
                direction = "worsened" if delta > 0 else "improved"
                triggered = (f"{comp.name} sentiment {direction} by {abs(delta)} pts",
                             f"Negative sentiment for competitor {comp.name} moved from {prev['negative_pct']}% to "
                             f"{cur['negative_pct']}%.", delta, "info")
                break
        rule.last_value = biggest
    if not triggered:
        return None
    title, message, value, severity = triggered
    event = MonitoringEvent(rule_id=rule.id, workspace_id=rule.workspace_id, severity=severity, title=title,
                            message=message, metric_value=value, payload={"rule_type": rule.rule_type,
                                                                          "project_id": str(project.id)})
    db.add(event)
    rule.last_triggered_at = now
    await db.flush()
    link = f"/app/monitoring?event={event.id}"
    await notify_workspace(db, rule.workspace_id, "monitoring_alert", title, message, link,
                           email_template="monitoring_alert" if "email" in (rule.channels or []) else None)
    await deliver_webhook_event(db, rule.workspace_id, "monitoring.triggered",
                                {"rule_id": str(rule.id), "title": title, "message": message, "value": value})
    return event


async def evaluate_workspace(db: AsyncSession, workspace_id=None, project_id=None) -> int:
    q = select(MonitoringRule).where(MonitoringRule.is_active.is_(True))
    if workspace_id:
        q = q.where(MonitoringRule.workspace_id == workspace_id)
    if project_id:
        q = q.where(MonitoringRule.project_id == project_id)
    fired = 0
    for rule in (await db.scalars(q)).all():
        if await evaluate_rule(db, rule):
            fired += 1
    return fired
