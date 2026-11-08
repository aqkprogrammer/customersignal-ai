from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_workspace_context, require_role
from app.api.v1.routes.projects import get_project
from app.api.v1.serializers import iso
from app.core.database import get_db
from app.core.errors import NotFound
from app.core.security import utcnow
from app.models import Business, MonitoringEvent, MonitoringRule, Project
from app.schemas.common import Pagination, page
from app.services.entitlements import require_feature
from app.services.monitoring_service import RULE_DESCRIPTIONS, evaluate_rule

router = APIRouter(prefix="/monitoring", tags=["monitoring"])
RuleType = Literal["negative_sentiment_above", "average_rating_below", "rating_drop", "new_recurring_complaint",
                   "competitor_sentiment_change", "review_volume_spike"]


class RuleIn(BaseModel):
    project_id: uuid.UUID
    business_id: uuid.UUID | None = None
    name: str = Field(min_length=2, max_length=200)
    rule_type: RuleType
    threshold: float = Field(ge=0, le=10000)
    window_days: int = Field(default=7, ge=1, le=90)
    channels: list[Literal["in_app", "email"]] = ["in_app"]
    cooldown_hours: int = Field(default=24, ge=1, le=720)
    is_active: bool = True


class RuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    threshold: float | None = Field(default=None, ge=0, le=10000)
    window_days: int | None = Field(default=None, ge=1, le=90)
    channels: list[Literal["in_app", "email"]] | None = None
    cooldown_hours: int | None = Field(default=None, ge=1, le=720)
    is_active: bool | None = None


def rule_out(r: MonitoringRule, project_name: str | None = None) -> dict:
    return {"id": str(r.id), "project_id": str(r.project_id), "project_name": project_name,
            "business_id": str(r.business_id) if r.business_id else None, "name": r.name, "rule_type": r.rule_type,
            "description": RULE_DESCRIPTIONS.get(r.rule_type), "threshold": r.threshold, "window_days": r.window_days,
            "channels": r.channels, "cooldown_hours": r.cooldown_hours, "is_active": r.is_active,
            "last_evaluated_at": iso(r.last_evaluated_at), "last_triggered_at": iso(r.last_triggered_at),
            "last_value": r.last_value, "created_at": iso(r.created_at)}


async def _rule(db: AsyncSession, ctx: WorkspaceContext, rule_id: uuid.UUID) -> MonitoringRule:
    r = await db.get(MonitoringRule, rule_id)
    if not r or r.workspace_id != ctx.workspace_id:
        raise NotFound("Rule not found.")
    return r


@router.get("/rule-types")
async def rule_types() -> list[dict]:
    return [{"value": k, "label": v} for k, v in RULE_DESCRIPTIONS.items()]


@router.get("/rules")
async def rules(ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.execute(select(MonitoringRule, Project.name).join(Project, Project.id == MonitoringRule.project_id)
                             .where(MonitoringRule.workspace_id == ctx.workspace_id, Project.deleted_at.is_(None))
                             .order_by(MonitoringRule.created_at.desc()))).all()
    return [rule_out(r, n) for r, n in rows]


@router.post("/rules", status_code=201)
async def create_rule(body: RuleIn, ctx: WorkspaceContext = Depends(require_role("analyst")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    await require_feature(db, ctx.workspace_id, "monitoring")
    project = await get_project(db, ctx, body.project_id)
    if body.business_id:
        b = await db.get(Business, body.business_id)
        if not b or b.project_id != project.id:
            raise NotFound("Business not found in this project.")
    r = MonitoringRule(workspace_id=ctx.workspace_id, created_by_id=ctx.user.id, **body.model_dump())
    db.add(r)
    await db.flush()
    return rule_out(r, project.name)


@router.patch("/rules/{rule_id}")
async def update_rule(rule_id: uuid.UUID, body: RuleUpdate, ctx: WorkspaceContext = Depends(require_role("analyst")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    r = await _rule(db, ctx, rule_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    return rule_out(r)


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    await db.delete(await _rule(db, ctx, rule_id))
    return {"message": "Rule deleted."}


@router.post("/rules/{rule_id}/evaluate")
async def evaluate_now(rule_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                       db: AsyncSession = Depends(get_db)) -> dict:
    await require_feature(db, ctx.workspace_id, "monitoring")
    r = await _rule(db, ctx, rule_id)
    r.last_triggered_at = None  # manual check ignores cooldown
    event = await evaluate_rule(db, r)
    return {"triggered": event is not None, "last_value": r.last_value,
            "event": {"id": str(event.id), "title": event.title, "message": event.message} if event else None}


@router.get("/events")
async def events(rule_id: uuid.UUID | None = None, p: Pagination = Depends(),
                 ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> dict:
    q = select(MonitoringEvent, MonitoringRule.name).join(MonitoringRule, MonitoringRule.id == MonitoringEvent.rule_id) \
        .where(MonitoringEvent.workspace_id == ctx.workspace_id)
    if rule_id:
        q = q.where(MonitoringEvent.rule_id == rule_id)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (await db.execute(q.order_by(MonitoringEvent.created_at.desc()).offset(p.offset).limit(p.page_size))).all()
    return page([{"id": str(e.id), "rule_id": str(e.rule_id), "rule_name": n, "severity": e.severity, "title": e.title,
                  "message": e.message, "metric_value": e.metric_value, "acknowledged": e.acknowledged_at is not None,
                  "created_at": iso(e.created_at)} for e, n in rows], int(total or 0), p)


@router.post("/events/{event_id}/acknowledge")
async def acknowledge(event_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                      db: AsyncSession = Depends(get_db)) -> dict:
    e = await db.get(MonitoringEvent, event_id)
    if not e or e.workspace_id != ctx.workspace_id:
        raise NotFound("Event not found.")
    e.acknowledged_at = utcnow()
    return {"message": "Acknowledged."}
