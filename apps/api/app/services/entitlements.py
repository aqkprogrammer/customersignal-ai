"""Server-side enforcement of plan limits and feature entitlements. Never trust the client for any of this."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import PaymentRequired
from app.models import Project, Subscription, SubscriptionPlan, UsageRecord, Workspace, WorkspaceMember

LIMIT_FIELDS = ("max_workspaces", "max_projects", "max_reviews_per_month", "max_reports_per_month", "max_members")
ACTIVE_STATUSES = ("active", "trialing", "past_due")


def current_period() -> str:
    return datetime.now(UTC).strftime("%Y-%m")


@dataclass
class Entitlements:
    plan_code: str
    plan_name: str
    status: str
    features: set[str] = field(default_factory=set)
    limits: dict[str, int | None] = field(default_factory=dict)

    def has(self, feature: str) -> bool:
        return feature in self.features

    def to_dict(self) -> dict:
        return {"plan_code": self.plan_code, "plan_name": self.plan_name, "status": self.status,
                "features": sorted(self.features), "limits": self.limits}


async def get_free_plan(db: AsyncSession) -> SubscriptionPlan:
    plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == "free"))
    if plan is None:
        from app.services.seed_reference import seed_reference_data

        await seed_reference_data(db)
        plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == "free"))
    assert plan is not None
    return plan


async def get_entitlements(db: AsyncSession, workspace_id: uuid.UUID) -> Entitlements:
    row = (
        await db.execute(
            select(Subscription, SubscriptionPlan)
            .join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id)
            .where(Subscription.workspace_id == workspace_id)
        )
    ).first()
    if row is None:
        plan = await get_free_plan(db)
        sub = None
    else:
        sub, plan = row
        if sub.status not in ACTIVE_STATUSES:
            plan = await get_free_plan(db)  # lapsed subscriptions fall back to Free limits
    limits = {f: getattr(plan, f) for f in LIMIT_FIELDS}
    if sub and sub.limit_overrides:
        for key, value in sub.limit_overrides.items():
            if key in LIMIT_FIELDS:
                limits[key] = value
    return Entitlements(
        plan_code=plan.code, plan_name=plan.name, status=sub.status if sub else "active",
        features=set(plan.features or []), limits=limits,
    )


async def usage_for_period(db: AsyncSession, workspace_id: uuid.UUID, metric: str, period: str | None = None) -> int:
    total = await db.scalar(
        select(func.coalesce(func.sum(UsageRecord.quantity), 0)).where(
            UsageRecord.workspace_id == workspace_id, UsageRecord.metric == metric,
            UsageRecord.period == (period or current_period()),
        )
    )
    return int(total or 0)


async def record_usage(db: AsyncSession, workspace_id: uuid.UUID, metric: str, quantity: int,
                       reference_id: uuid.UUID | None = None) -> None:
    if quantity <= 0:
        return
    db.add(UsageRecord(workspace_id=workspace_id, metric=metric, quantity=quantity, period=current_period(),
                       reference_id=reference_id))
    await db.flush()


async def require_feature(db: AsyncSession, workspace_id: uuid.UUID, feature: str) -> Entitlements:
    ent = await get_entitlements(db, workspace_id)
    if not ent.has(feature):
        from app.services.plans import FEATURES

        raise PaymentRequired(
            f"{FEATURES.get(feature, feature)} is not included in the {ent.plan_name} plan. Upgrade to unlock it.",
            code="feature_not_in_plan", details={"feature": feature, "plan": ent.plan_code},
        )
    return ent


async def assert_project_quota(db: AsyncSession, workspace_id: uuid.UUID) -> None:
    ent = await get_entitlements(db, workspace_id)
    limit = ent.limits.get("max_projects")
    if limit is None:
        return
    count = await db.scalar(
        select(func.count()).select_from(Project).where(
            Project.workspace_id == workspace_id, Project.deleted_at.is_(None), Project.is_demo.is_(False)
        )
    )
    if (count or 0) >= limit:
        raise PaymentRequired(f"Your {ent.plan_name} plan allows {limit} projects. Upgrade to add more.",
                              details={"limit": limit, "metric": "projects"})


async def remaining_review_quota(db: AsyncSession, workspace_id: uuid.UUID) -> int | None:
    ent = await get_entitlements(db, workspace_id)
    limit = ent.limits.get("max_reviews_per_month")
    if limit is None:
        return None
    return max(0, limit - await usage_for_period(db, workspace_id, "reviews_analyzed"))


async def assert_report_quota(db: AsyncSession, workspace_id: uuid.UUID) -> None:
    ent = await get_entitlements(db, workspace_id)
    limit = ent.limits.get("max_reports_per_month")
    if limit is None:
        return
    used = await usage_for_period(db, workspace_id, "reports_generated")
    if used >= limit:
        raise PaymentRequired(
            f"You've generated {used} of {limit} AI reports this month on the {ent.plan_name} plan.",
            details={"limit": limit, "used": used, "metric": "reports"},
        )


async def assert_member_quota(db: AsyncSession, workspace_id: uuid.UUID, pending_invites: int = 0) -> None:
    ent = await get_entitlements(db, workspace_id)
    limit = ent.limits.get("max_members")
    if limit is None:
        return
    members = await db.scalar(
        select(func.count()).select_from(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id)
    )
    if (members or 0) + pending_invites >= limit:
        raise PaymentRequired(f"Your {ent.plan_name} plan allows {limit} team member(s). Upgrade to invite more.",
                              details={"limit": limit, "metric": "members"})


async def assert_workspace_quota(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Workspace limit uses the most generous plan among workspaces the user owns."""
    owned = (await db.scalars(
        select(Workspace.id).where(Workspace.owner_id == user_id, Workspace.deleted_at.is_(None),
                                   Workspace.is_demo.is_(False))
    )).all()
    if not owned:
        return
    best: int | None = 0
    for ws_id in owned:
        lim = (await get_entitlements(db, ws_id)).limits.get("max_workspaces")
        if lim is None:
            best = None
            break
        best = max(best or 0, lim)
    if best is not None and len(owned) >= best:
        raise PaymentRequired(f"Your plan allows {best} workspace(s). Upgrade to create more.",
                              details={"limit": best, "metric": "workspaces"})
