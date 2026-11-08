"""Super-admin APIs. Every route checks an admin permission server-side; every mutation is audit-logged."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Date, String, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.pricing import PRICES
from app.ai.registry import provider_status
from app.api.deps import ADMIN_PERMISSIONS, AdminContext, require_admin
from app.api.v1.admin.auth import admin_out
from app.api.v1.routes.public import plan_out
from app.api.v1.serializers import iso, job_out, project_out, report_out, workspace_out
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AppError, Conflict, Forbidden, NotFound
from app.core.security import hash_password, password_strength_errors, utcnow
from app.models import (
    ActivityLog,
    AdminAuditLog,
    AdminUser,
    AIUsageLog,
    AnalysisJob,
    Announcement,
    EmailLog,
    EmailTemplate,
    FeatureFlag,
    Integration,
    IntegrationSyncLog,
    Invoice,
    Notification,
    Payment,
    Project,
    Report,
    Review,
    ReviewSentiment,
    Subscription,
    SubscriptionPlan,
    SupportMessage,
    SupportTicket,
    UsageRecord,
    User,
    UserProfile,
    UserSession,
    Workspace,
    WorkspaceMember,
)
from app.schemas.common import Pagination, page
from app.services import email_service, settings_service
from app.services.activity import audit, notify
from app.services.auth_service import revoke_all_sessions
from app.services.email_service import render
from app.services.entitlements import LIMIT_FIELDS, get_entitlements, usage_for_period
from app.services.integrations_service import CATALOG
from app.services.plans import FEATURES
from app.workers.jobs import enqueue

router = APIRouter(prefix="/admin", tags=["admin"])
PAID = and_(SubscriptionPlan.code != "free", Subscription.status.in_(("active", "trialing", "past_due")))


def _since(days: int) -> datetime:
    return utcnow() - timedelta(days=days)


async def _audit(db: AsyncSession, ctx: AdminContext, action: str, target_type: str | None = None,
                 target_id: Any = None, **meta: Any) -> None:
    await audit(db, admin_id=ctx.admin.id, admin_email=ctx.admin.email, action=action, target_type=target_type,
                target_id=target_id, ip=ctx.ip, user_agent=ctx.user_agent, **meta)


async def _mrr_cents(db: AsyncSession) -> int:
    rows = (await db.execute(select(Subscription.mrr_cents, SubscriptionPlan.price_monthly_cents, Subscription.status,
                                    Subscription.stripe_subscription_id)
                             .join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id)
                             .join(Workspace, Workspace.id == Subscription.workspace_id)
                             .where(PAID, Workspace.is_demo.is_(False)))).all()
    total = 0
    for mrr, price, status, stripe_id in rows:
        if status == "trialing":
            continue
        total += mrr if stripe_id else (price or 0)
    return total


# ------------------------------------------------------------------------------------------- dashboard
@router.get("/dashboard")
async def dashboard(ctx: AdminContext = Depends(require_admin("dashboard.read")), db: AsyncSession = Depends(get_db)) -> dict:
    total_users = await db.scalar(select(func.count()).select_from(User).where(User.deleted_at.is_(None)))
    active_users = await db.scalar(select(func.count()).select_from(User).where(User.deleted_at.is_(None),
                                                                                User.last_active_at > _since(30)))
    new_users = await db.scalar(select(func.count()).select_from(User).where(User.created_at > _since(30)))
    total_ws = await db.scalar(select(func.count()).select_from(Workspace).where(Workspace.deleted_at.is_(None),
                                                                                 Workspace.is_demo.is_(False)))
    active_subs = await db.scalar(select(func.count()).select_from(Subscription)
                                  .join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id).where(PAID))
    mrr = await _mrr_cents(db)
    canceled_30 = await db.scalar(select(func.count()).select_from(Subscription).where(Subscription.canceled_at > _since(30)))
    churn = round(100 * (canceled_30 or 0) / ((active_subs or 0) + (canceled_30 or 0)), 1) if (active_subs or canceled_30) else 0.0
    trials = await db.scalar(select(func.count()).select_from(Subscription).where(Subscription.trial_ends_at.is_not(None)))
    converted = await db.scalar(select(func.count()).select_from(Subscription)
                                .join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id)
                                .where(Subscription.trial_ends_at.is_not(None), Subscription.trial_ends_at < utcnow(), PAID,
                                       Subscription.status == "active"))
    ai_tokens, ai_cost = (await db.execute(select(func.coalesce(func.sum(AIUsageLog.input_tokens + AIUsageLog.output_tokens), 0),
                                                  func.coalesce(func.sum(AIUsageLog.cost_usd), 0))
                                           .where(AIUsageLog.created_at > _since(30)))).one()
    reviews_total = await db.scalar(select(func.count()).select_from(ReviewSentiment))
    failed_jobs = await db.scalar(select(func.count()).select_from(AnalysisJob).where(
        AnalysisJob.status == "failed", AnalysisJob.created_at > _since(7)))

    month = func.date_trunc("month", User.created_at)
    growth = (await db.execute(select(month, func.count()).where(User.created_at > _since(365)).group_by(month).order_by(month))).all()
    base = await db.scalar(select(func.count()).select_from(User).where(User.created_at <= _since(365))) or 0
    user_growth, running = [], base
    for m, n in growth:
        running += n
        user_growth.append({"month": m.date().isoformat()[:7], "signups": n, "total": running})
    pmonth = func.date_trunc("month", Payment.created_at)
    revenue = [{"month": m.date().isoformat()[:7], "revenue_cents": int(v or 0)} for m, v in (await db.execute(
        select(pmonth, func.sum(Payment.amount_cents - Payment.refunded_cents)).where(
            Payment.status.in_(("succeeded", "partially_refunded")), Payment.created_at > _since(365))
        .group_by(pmonth).order_by(pmonth))).all()]
    sub_dist = [{"status": s, "count": n} for s, n in (await db.execute(
        select(Subscription.status, func.count()).group_by(Subscription.status))).all()]
    plan_dist = [{"plan": c, "count": n} for c, n in (await db.execute(
        select(SubscriptionPlan.code, func.count()).join(Subscription, Subscription.plan_id == SubscriptionPlan.id)
        .join(Workspace, Workspace.id == Subscription.workspace_id).where(Workspace.is_demo.is_(False))
        .group_by(SubscriptionPlan.code, SubscriptionPlan.sort_order).order_by(SubscriptionPlan.sort_order))).all()]
    day = cast(AIUsageLog.created_at, Date)
    ai_usage = [{"date": d.isoformat(), "tokens": int(t or 0), "cost_usd": float(c or 0), "requests": int(r)}
                for d, t, c, r in (await db.execute(
                    select(day, func.sum(AIUsageLog.input_tokens + AIUsageLog.output_tokens), func.sum(AIUsageLog.cost_usd),
                           func.count()).where(AIUsageLog.created_at > _since(30)).group_by(day).order_by(day))).all()]
    rday = cast(UsageRecord.created_at, Date)
    review_volume = [{"date": d.isoformat(), "reviews": int(n or 0)} for d, n in (await db.execute(
        select(rday, func.sum(UsageRecord.quantity)).where(UsageRecord.metric == "reviews_analyzed",
                                                           UsageRecord.created_at > _since(30))
        .group_by(rday).order_by(rday))).all()]
    cmonth = func.date_trunc("month", Subscription.canceled_at)
    churn_series = [{"month": m.date().isoformat()[:7], "cancellations": n} for m, n in (await db.execute(
        select(cmonth, func.count()).where(Subscription.canceled_at > _since(365)).group_by(cmonth).order_by(cmonth))).all()]
    umonth = func.date_trunc("month", User.created_at)
    funnel = [{"month": m.date().isoformat()[:7], "signups": s, "onboarded": o} for m, s, o in (await db.execute(
        select(umonth, func.count(User.id), func.count(UserProfile.onboarding_completed_at))
        .outerjoin(UserProfile, UserProfile.user_id == User.id).where(User.created_at > _since(180))
        .group_by(umonth).order_by(umonth))).all()]
    recent = (await db.scalars(select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(8))).all()
    signups = (await db.execute(select(User, UserProfile.full_name).outerjoin(UserProfile, UserProfile.user_id == User.id)
                                .order_by(User.created_at.desc()).limit(6))).all()
    return {
        "metrics": {"total_users": total_users, "active_users": active_users, "new_registrations": new_users,
                    "total_workspaces": total_ws, "active_subscriptions": active_subs, "mrr_cents": mrr,
                    "arr_cents": mrr * 12, "churn_rate": churn,
                    "trial_conversion_rate": round(100 * (converted or 0) / trials, 1) if trials else 0.0,
                    "ai_tokens_30d": int(ai_tokens), "ai_cost_30d": round(float(ai_cost), 4),
                    "reviews_processed": reviews_total, "failed_jobs_7d": failed_jobs},
        "charts": {"user_growth": user_growth, "revenue": revenue, "subscription_status": sub_dist,
                   "plan_distribution": plan_dist, "ai_usage": ai_usage, "review_volume": review_volume,
                   "churn": churn_series, "signup_conversion": funnel},
        "recent_admin_activity": [{"action": a.action, "admin_email": a.admin_email, "target_type": a.target_type,
                                   "target_id": a.target_id, "created_at": iso(a.created_at)} for a in recent],
        "recent_signups": [{"id": str(u.id), "email": u.email, "full_name": n, "created_at": iso(u.created_at)}
                           for u, n in signups],
    }


# --------------------------------------------------------------------------------------------- users
class UserActionIn(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)


class NotifyIn(BaseModel):
    title: str = Field(min_length=2, max_length=300)
    body: str = Field(default="", max_length=5000)
    send_email: bool = False


@router.get("/users")
async def users(q: str | None = None, status: str | None = None, plan: str | None = None, verified: bool | None = None,
                sort: Literal["created_desc", "created_asc", "last_active"] = "created_desc", p: Pagination = Depends(),
                ctx: AdminContext = Depends(require_admin("users.read")), db: AsyncSession = Depends(get_db)) -> dict:
    stmt = select(User, UserProfile).outerjoin(UserProfile, UserProfile.user_id == User.id).where(User.deleted_at.is_(None))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.email.ilike(like), UserProfile.full_name.ilike(like), UserProfile.company_name.ilike(like)))
    if status:
        stmt = stmt.where(User.status == status)
    if verified is not None:
        stmt = stmt.where(User.email_verified_at.is_not(None) if verified else User.email_verified_at.is_(None))
    if plan:
        stmt = stmt.where(User.default_workspace_id.in_(
            select(Subscription.workspace_id).join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id)
            .where(SubscriptionPlan.code == plan)))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    order = {"created_desc": User.created_at.desc(), "created_asc": User.created_at.asc(),
             "last_active": User.last_active_at.desc().nullslast()}[sort]
    rows = (await db.execute(stmt.order_by(order).offset(p.offset).limit(p.page_size))).all()
    plans = dict((await db.execute(select(Subscription.workspace_id, SubscriptionPlan.code)
                                   .join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id)
                                   .where(Subscription.workspace_id.in_([u.default_workspace_id for u, _ in rows
                                                                         if u.default_workspace_id])))).all()) if rows else {}
    return page([{"id": str(u.id), "email": u.email, "full_name": pr.full_name if pr else "",
                  "company_name": pr.company_name if pr else None, "status": u.status,
                  "email_verified": u.email_verified_at is not None, "google": u.google_sub is not None,
                  "plan": plans.get(u.default_workspace_id, "free"), "last_active_at": iso(u.last_active_at),
                  "last_login_at": iso(u.last_login_at), "created_at": iso(u.created_at)} for u, pr in rows],
                int(total or 0), p)


async def _user(db: AsyncSession, user_id: uuid.UUID) -> User:
    u = await db.get(User, user_id)
    if not u:
        raise NotFound("User not found.")
    return u


@router.get("/users/{user_id}")
async def user_detail(user_id: uuid.UUID, ctx: AdminContext = Depends(require_admin("users.read")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    u = await _user(db, user_id)
    await _audit(db, ctx, "user.viewed", "user", u.id)  # sensitive data access is audit-logged
    memberships = (await db.execute(select(Workspace, WorkspaceMember.role)
                                    .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
                                    .where(WorkspaceMember.user_id == u.id))).all()
    ws_out = []
    for ws, role in memberships:
        ent = await get_entitlements(db, ws.id)
        ws_out.append({**workspace_out(ws, role), "plan": ent.plan_code,
                       "reviews_this_month": await usage_for_period(db, ws.id, "reviews_analyzed")})
    activity = (await db.scalars(select(ActivityLog).where(ActivityLog.actor_id == u.id)
                                 .order_by(ActivityLog.created_at.desc()).limit(25))).all()
    sessions = (await db.scalars(select(UserSession).where(UserSession.user_id == u.id)
                                 .order_by(UserSession.created_at.desc()).limit(10))).all()
    ai = (await db.execute(select(func.coalesce(func.sum(AIUsageLog.input_tokens + AIUsageLog.output_tokens), 0),
                                  func.coalesce(func.sum(AIUsageLog.cost_usd), 0)).where(AIUsageLog.user_id == u.id))).one()
    return {
        "id": str(u.id), "email": u.email, "status": u.status, "status_reason": u.status_reason,
        "full_name": u.profile.full_name if u.profile else "", "company_name": u.profile.company_name if u.profile else None,
        "email_verified": u.email_verified_at is not None, "google_linked": u.google_sub is not None,
        "onboarding_completed": bool(u.profile and u.profile.onboarding_completed_at),
        "created_at": iso(u.created_at), "last_login_at": iso(u.last_login_at), "last_active_at": iso(u.last_active_at),
        "deleted_at": iso(u.deleted_at), "workspaces": ws_out,
        "usage": {"ai_tokens": int(ai[0]), "ai_cost_usd": round(float(ai[1]), 4)},
        "activity": [{"action": a.action, "summary": a.summary, "created_at": iso(a.created_at)} for a in activity],
        "sessions": [{"ip_address": s.ip_address, "user_agent": s.user_agent, "created_at": iso(s.created_at),
                      "revoked": s.revoked_at is not None} for s in sessions],
    }


@router.post("/users/{user_id}/{action}")
async def user_action(user_id: uuid.UUID, action: Literal["suspend", "reactivate", "ban", "revoke-sessions"],
                      body: UserActionIn, ctx: AdminContext = Depends(require_admin("users.manage")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    if action == "ban" and ctx.admin.role != "super_admin":
        raise Forbidden("Only super-admins can ban users.")
    u = await _user(db, user_id)
    if u.deleted_at:
        raise AppError("This user has been deleted.", code="user_deleted")
    if action == "suspend":
        u.status, u.status_reason = "suspended", body.reason
        await revoke_all_sessions(db, u.id)
    elif action == "ban":
        u.status, u.status_reason = "banned", body.reason
        await revoke_all_sessions(db, u.id)
    elif action == "reactivate":
        u.status, u.status_reason = "active", None
    else:
        await revoke_all_sessions(db, u.id)
    await _audit(db, ctx, f"user.{action}", "user", u.id, reason=body.reason)
    return {"id": str(u.id), "status": u.status}


@router.delete("/users/{user_id}")
async def delete_user(user_id: uuid.UUID, body: UserActionIn, ctx: AdminContext = Depends(require_admin("users.delete")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    """Soft-delete + anonymize (records needed for billing/audit retention are kept)."""
    u = await _user(db, user_id)
    if u.deleted_at:
        raise AppError("User already deleted.")
    original = u.email
    u.deleted_at = utcnow()
    u.status = "banned"
    u.email = f"deleted+{u.id}@deleted.invalid"
    u.google_sub = None
    u.password_hash = None
    if u.profile:
        u.profile.full_name, u.profile.avatar_url = "Deleted user", None
    await revoke_all_sessions(db, u.id)
    await _audit(db, ctx, "user.deleted", "user", u.id, reason=body.reason, original_email_domain=original.split("@")[-1])
    return {"message": "User deleted and anonymized."}


@router.post("/users/{user_id}/notify")
async def notify_user(user_id: uuid.UUID, body: NotifyIn, ctx: AdminContext = Depends(require_admin("users.notify")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    u = await _user(db, user_id)
    await notify(db, u.id, None, "system", body.title, body.body)
    if body.send_email:
        await email_service.send_template(db, u.email, "account_notice", {"subject": body.title, "message": body.body})
    await _audit(db, ctx, "user.notified", "user", u.id, title=body.title, email=body.send_email)
    return {"message": "Notification sent."}


# ---------------------------------------------------------------------------------------- workspaces
@router.get("/workspaces")
async def workspaces(q: str | None = None, status: str | None = None, plan: str | None = None, include_demo: bool = False,
                     p: Pagination = Depends(), ctx: AdminContext = Depends(require_admin("workspaces.read")),
                     db: AsyncSession = Depends(get_db)) -> dict:
    stmt = (select(Workspace, User.email, SubscriptionPlan.code, Subscription.status)
            .join(User, User.id == Workspace.owner_id)
            .outerjoin(Subscription, Subscription.workspace_id == Workspace.id)
            .outerjoin(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id)
            .where(Workspace.deleted_at.is_(None)))
    if not include_demo:
        stmt = stmt.where(Workspace.is_demo.is_(False))
    if q:
        stmt = stmt.where(or_(Workspace.name.ilike(f"%{q}%"), User.email.ilike(f"%{q}%")))
    if status:
        stmt = stmt.where(Workspace.status == status)
    if plan:
        stmt = stmt.where(SubscriptionPlan.code == plan)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.execute(stmt.order_by(Workspace.created_at.desc()).offset(p.offset).limit(p.page_size))).all()
    ids = [w.id for w, *_ in rows]
    projects = dict((await db.execute(select(Project.workspace_id, func.count()).where(
        Project.workspace_id.in_(ids), Project.deleted_at.is_(None)).group_by(Project.workspace_id))).all()) if ids else {}
    members = dict((await db.execute(select(WorkspaceMember.workspace_id, func.count()).where(
        WorkspaceMember.workspace_id.in_(ids)).group_by(WorkspaceMember.workspace_id))).all()) if ids else {}
    reviews = dict((await db.execute(select(Review.workspace_id, func.count()).where(
        Review.workspace_id.in_(ids), Review.deleted_at.is_(None)).group_by(Review.workspace_id))).all()) if ids else {}
    return page([{**workspace_out(w), "owner_email": e, "plan": c or "free", "subscription_status": s,
                  "projects": int(projects.get(w.id, 0)), "members": int(members.get(w.id, 0)),
                  "reviews": int(reviews.get(w.id, 0))} for w, e, c, s in rows], int(total or 0), p)


@router.get("/workspaces/{workspace_id}")
async def workspace_detail(workspace_id: uuid.UUID, ctx: AdminContext = Depends(require_admin("workspaces.read")),
                           db: AsyncSession = Depends(get_db)) -> dict:
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise NotFound("Workspace not found.")
    owner = await db.get(User, ws.owner_id)
    ent = await get_entitlements(db, ws.id)
    sub = await db.scalar(select(Subscription).where(Subscription.workspace_id == ws.id))
    projects = (await db.scalars(select(Project).where(Project.workspace_id == ws.id, Project.deleted_at.is_(None)))).all()
    members = (await db.execute(select(User.email, WorkspaceMember.role).join(WorkspaceMember, WorkspaceMember.user_id == User.id)
                                .where(WorkspaceMember.workspace_id == ws.id))).all()
    return {**workspace_out(ws), "owner": {"id": str(owner.id), "email": owner.email} if owner else None,
            "entitlements": ent.to_dict(),
            "subscription": {"status": sub.status, "stripe_customer_id": sub.stripe_customer_id,
                             "current_period_end": iso(sub.current_period_end), "limit_overrides": sub.limit_overrides,
                             "cancel_at_period_end": sub.cancel_at_period_end, "trial_ends_at": iso(sub.trial_ends_at)} if sub else None,
            "usage": {m: await usage_for_period(db, ws.id, m) for m in ("reviews_analyzed", "reports_generated", "ai_tokens")},
            "projects": [project_out(p) for p in projects],
            "members": [{"email": e, "role": r} for e, r in members]}


@router.post("/workspaces/{workspace_id}/{action}")
async def workspace_action(workspace_id: uuid.UUID, action: Literal["suspend", "restore"], body: UserActionIn,
                           ctx: AdminContext = Depends(require_admin("workspaces.manage")),
                           db: AsyncSession = Depends(get_db)) -> dict:
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise NotFound("Workspace not found.")
    ws.status, ws.status_reason = ("suspended", body.reason) if action == "suspend" else ("active", None)
    await _audit(db, ctx, f"workspace.{action}", "workspace", ws.id, reason=body.reason)
    return {"id": str(ws.id), "status": ws.status}


# ------------------------------------------------------------------------------------- subscriptions
class AdjustIn(BaseModel):
    plan_code: str | None = None
    status: Literal["active", "trialing", "past_due", "canceled"] | None = None
    limit_overrides: dict[str, int | None] | None = None
    extend_trial_days: int | None = Field(default=None, ge=1, le=90)
    reason: str = Field(min_length=3, max_length=1000)


@router.get("/subscriptions")
async def subscriptions(plan: str | None = None, status: str | None = None, q: str | None = None, p: Pagination = Depends(),
                        ctx: AdminContext = Depends(require_admin("subscriptions.read")), db: AsyncSession = Depends(get_db)) -> dict:
    stmt = (select(Subscription, SubscriptionPlan, Workspace).join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id)
            .join(Workspace, Workspace.id == Subscription.workspace_id).where(Workspace.is_demo.is_(False)))
    if plan:
        stmt = stmt.where(SubscriptionPlan.code == plan)
    if status:
        stmt = stmt.where(Subscription.status == status)
    if q:
        stmt = stmt.where(Workspace.name.ilike(f"%{q}%"))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.execute(stmt.order_by(Subscription.updated_at.desc()).offset(p.offset).limit(p.page_size))).all()
    return page([{"id": str(s.id), "workspace_id": str(w.id), "workspace_name": w.name, "plan": pl.code,
                  "plan_name": pl.name, "status": s.status, "mrr_cents": s.mrr_cents if s.stripe_subscription_id else (pl.price_monthly_cents or 0),
                  "current_period_end": iso(s.current_period_end), "cancel_at_period_end": s.cancel_at_period_end,
                  "canceled_at": iso(s.canceled_at), "trial_ends_at": iso(s.trial_ends_at),
                  "stripe_subscription_id": s.stripe_subscription_id, "limit_overrides": s.limit_overrides,
                  "manual": not s.stripe_subscription_id and pl.code != "free"} for s, pl, w in rows], int(total or 0), p)


@router.post("/subscriptions/{subscription_id}/adjust")
async def adjust(subscription_id: uuid.UUID, body: AdjustIn, ctx: AdminContext = Depends(require_admin("subscriptions.manage")),
                 db: AsyncSession = Depends(get_db)) -> dict:
    s = await db.get(Subscription, subscription_id)
    if not s:
        raise NotFound("Subscription not found.")
    before = {"plan_id": str(s.plan_id), "status": s.status, "limit_overrides": s.limit_overrides,
              "trial_ends_at": iso(s.trial_ends_at)}
    if body.plan_code:
        plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == body.plan_code))
        if not plan:
            raise NotFound("Plan not found.")
        if s.stripe_subscription_id:
            raise Conflict("This workspace is billed through Stripe — change the plan in Stripe or via the customer portal.")
        s.plan_id = plan.id
    if body.status:
        s.status = body.status
        if body.status == "canceled":
            s.canceled_at = utcnow()
    if body.limit_overrides is not None:
        bad = [k for k in body.limit_overrides if k not in LIMIT_FIELDS]
        if bad:
            raise AppError(f"Unknown limit(s): {', '.join(bad)}")
        s.limit_overrides = {k: v for k, v in body.limit_overrides.items()}
    if body.extend_trial_days:
        s.trial_ends_at = max(s.trial_ends_at or utcnow(), utcnow()) + timedelta(days=body.extend_trial_days)
        s.status = "trialing" if not s.stripe_subscription_id else s.status
    await _audit(db, ctx, "subscription.adjusted", "subscription", s.id, reason=body.reason, before=before,
                 changes=body.model_dump(exclude={"reason"}, exclude_none=True))
    return {"message": "Subscription updated."}


@router.get("/payments")
async def payments(status: str | None = None, p: Pagination = Depends(), ctx: AdminContext = Depends(require_admin("payments.read")),
                   db: AsyncSession = Depends(get_db)) -> dict:
    stmt = select(Payment, Workspace.name).join(Workspace, Workspace.id == Payment.workspace_id)
    if status:
        stmt = stmt.where(Payment.status == status)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.execute(stmt.order_by(Payment.created_at.desc()).offset(p.offset).limit(p.page_size))).all()
    return page([{"id": str(x.id), "workspace_name": n, "amount_cents": x.amount_cents, "refunded_cents": x.refunded_cents,
                  "currency": x.currency, "status": x.status, "failure_reason": x.failure_reason, "plan_code": x.plan_code,
                  "created_at": iso(x.created_at)} for x, n in rows], int(total or 0), p)


@router.get("/invoices")
async def invoices(p: Pagination = Depends(), ctx: AdminContext = Depends(require_admin("payments.read")),
                   db: AsyncSession = Depends(get_db)) -> dict:
    stmt = select(Invoice, Workspace.name).join(Workspace, Workspace.id == Invoice.workspace_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.execute(stmt.order_by(Invoice.created_at.desc()).offset(p.offset).limit(p.page_size))).all()
    return page([{"id": str(i.id), "workspace_name": n, "number": i.number, "amount_paid_cents": i.amount_paid_cents,
                  "amount_due_cents": i.amount_due_cents, "status": i.status, "plan_code": i.plan_code,
                  "hosted_invoice_url": i.hosted_invoice_url, "created_at": iso(i.created_at)} for i, n in rows],
                int(total or 0), p)


@router.get("/revenue")
async def revenue(ctx: AdminContext = Depends(require_admin("revenue.read")), db: AsyncSession = Depends(get_db)) -> dict:
    mrr = await _mrr_cents(db)
    gross = await db.scalar(select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(
        Payment.status.in_(("succeeded", "refunded", "partially_refunded"))))
    refunds = await db.scalar(select(func.coalesce(func.sum(Payment.refunded_cents), 0)))
    failed = await db.scalar(select(func.count()).select_from(Payment).where(Payment.status == "failed"))
    failed_amount = await db.scalar(select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(Payment.status == "failed"))
    by_plan = [{"plan": c, "revenue_cents": int(v or 0)} for c, v in (await db.execute(
        select(Payment.plan_code, func.sum(Payment.amount_cents - Payment.refunded_cents)).where(
            Payment.status.in_(("succeeded", "partially_refunded"))).group_by(Payment.plan_code))).all()]
    mrr_by_plan = []
    for code, price, count in (await db.execute(
            select(SubscriptionPlan.code, SubscriptionPlan.price_monthly_cents, func.count())
            .join(Subscription, Subscription.plan_id == SubscriptionPlan.id)
            .join(Workspace, Workspace.id == Subscription.workspace_id)
            .where(PAID, Subscription.status != "trialing", Workspace.is_demo.is_(False))
            .group_by(SubscriptionPlan.code, SubscriptionPlan.price_monthly_cents))).all():
        mrr_by_plan.append({"plan": code, "subscribers": count, "mrr_cents": (price or 0) * count})
    month = func.date_trunc("month", Payment.created_at)
    trend = [{"month": m.date().isoformat()[:7], "gross_cents": int(g or 0), "refunds_cents": int(r or 0),
              "net_cents": int((g or 0) - (r or 0))} for m, g, r in (await db.execute(
        select(month, func.sum(Payment.amount_cents), func.sum(Payment.refunded_cents))
        .where(Payment.status.in_(("succeeded", "refunded", "partially_refunded")), Payment.created_at > _since(365))
        .group_by(month).order_by(month))).all()]
    return {"mrr_cents": mrr, "arr_cents": mrr * 12, "gross_revenue_cents": int(gross or 0),
            "refunds_cents": int(refunds or 0), "net_revenue_cents": int((gross or 0) - (refunds or 0)),
            "failed_payments": int(failed or 0), "failed_amount_cents": int(failed_amount or 0),
            "revenue_by_plan": by_plan, "mrr_by_plan": mrr_by_plan, "trend": trend,
            "stripe_enabled": settings.stripe_enabled}


# ------------------------------------------------------------------------------------------ plans
class PlanIn(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    description: str | None = Field(default=None, max_length=1000)
    price_monthly_cents: int | None = Field(default=None, ge=0)
    stripe_price_id_monthly: str | None = Field(default=None, max_length=120)
    max_workspaces: int | None = Field(default=None, ge=0)
    max_projects: int | None = Field(default=None, ge=0)
    max_reviews_per_month: int | None = Field(default=None, ge=0)
    max_reports_per_month: int | None = Field(default=None, ge=0)
    max_members: int | None = Field(default=None, ge=0)
    features: list[str] | None = None
    marketing_features: list[str] | None = None
    is_active: bool | None = None
    is_public: bool | None = None
    trial_days: int | None = Field(default=None, ge=0, le=90)
    highlighted: bool | None = None


@router.get("/plans")
async def plans(ctx: AdminContext = Depends(require_admin("plans.read")), db: AsyncSession = Depends(get_db)) -> dict:
    rows = (await db.scalars(select(SubscriptionPlan).order_by(SubscriptionPlan.sort_order))).all()
    counts = dict((await db.execute(select(Subscription.plan_id, func.count()).group_by(Subscription.plan_id))).all())
    return {"plans": [{**plan_out(p), "id": str(p.id), "stripe_price_id_monthly": p.stripe_price_id_monthly,
                       "is_active": p.is_active, "is_public": p.is_public, "subscribers": int(counts.get(p.id, 0))}
                      for p in rows], "features": FEATURES}


@router.patch("/plans/{code}")
async def update_plan(code: str, body: PlanIn, ctx: AdminContext = Depends(require_admin("plans.manage")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == code))
    if not plan:
        raise NotFound("Plan not found.")
    data = body.model_dump(exclude_unset=True)
    if "features" in data:
        unknown = [f for f in data["features"] if f not in FEATURES]
        if unknown:
            raise AppError(f"Unknown features: {', '.join(unknown)}")
    if "price_monthly_cents" in data and data["price_monthly_cents"] != plan.price_monthly_cents and "stripe_price_id_monthly" not in data:
        data["stripe_price_id_monthly"] = None  # a new Stripe price is created on next checkout
    before = {k: getattr(plan, k) for k in data}
    for k, v in data.items():
        setattr(plan, k, v)
    await _audit(db, ctx, "plan.updated", "plan", plan.code, before=before, after=data)
    return {**plan_out(plan), "stripe_price_id_monthly": plan.stripe_price_id_monthly}


# ----------------------------------------------------------------------------------------- AI usage
class AISettingsIn(BaseModel):
    ai_provider: Literal["auto", "anthropic", "openai", "heuristic"] | None = None
    ai_model_anthropic: str | None = Field(default=None, max_length=80)
    ai_model_openai: str | None = Field(default=None, max_length=80)
    ai_monthly_token_limit_per_workspace: int | None = Field(default=None, ge=0)


@router.get("/ai-usage")
async def ai_usage(provider: str | None = None, status: str | None = None, workspace_id: uuid.UUID | None = None,
                   p: Pagination = Depends(), ctx: AdminContext = Depends(require_admin("ai_usage.read")),
                   db: AsyncSession = Depends(get_db)) -> dict:
    stmt = (select(AIUsageLog, Workspace.name, User.email).outerjoin(Workspace, Workspace.id == AIUsageLog.workspace_id)
            .outerjoin(User, User.id == AIUsageLog.user_id))
    if provider:
        stmt = stmt.where(AIUsageLog.provider == provider)
    if status:
        stmt = stmt.where(AIUsageLog.status == status)
    if workspace_id:
        stmt = stmt.where(AIUsageLog.workspace_id == workspace_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.execute(stmt.order_by(AIUsageLog.created_at.desc()).offset(p.offset).limit(p.page_size))).all()
    agg = [{"provider": pr, "model": m, "requests": int(n), "input_tokens": int(i or 0), "output_tokens": int(o or 0),
            "cost_usd": round(float(c or 0), 4), "errors": int(e or 0), "avg_duration_ms": int(d or 0)}
           for pr, m, n, i, o, c, e, d in (await db.execute(
               select(AIUsageLog.provider, AIUsageLog.model, func.count(), func.sum(AIUsageLog.input_tokens),
                      func.sum(AIUsageLog.output_tokens), func.sum(AIUsageLog.cost_usd),
                      func.count().filter(AIUsageLog.status == "error"), func.avg(AIUsageLog.duration_ms))
               .where(AIUsageLog.created_at > _since(30)).group_by(AIUsageLog.provider, AIUsageLog.model))).all()]
    top_ws = [{"workspace": n or "—", "tokens": int(t or 0), "cost_usd": round(float(c or 0), 4)} for n, t, c in (await db.execute(
        select(Workspace.name, func.sum(AIUsageLog.input_tokens + AIUsageLog.output_tokens), func.sum(AIUsageLog.cost_usd))
        .outerjoin(Workspace, Workspace.id == AIUsageLog.workspace_id).where(AIUsageLog.created_at > _since(30))
        .group_by(Workspace.name).order_by(func.sum(AIUsageLog.cost_usd).desc()).limit(10))).all()]
    s = await settings_service.get_all(db, fresh=True)
    return {**page([{"id": str(x.id), "provider": x.provider, "model": x.model, "operation": x.operation,
                     "workspace": wn, "user": ue, "input_tokens": x.input_tokens, "output_tokens": x.output_tokens,
                     "cost_usd": float(x.cost_usd), "duration_ms": x.duration_ms, "status": x.status, "error": x.error,
                     "prompt_version": x.prompt_version, "created_at": iso(x.created_at)} for x, wn, ue in rows],
                   int(total or 0), p),
            "aggregates_30d": agg, "top_workspaces_30d": top_ws, "providers": provider_status(),
            "settings": {k: s[k] for k in ("ai_provider", "ai_model_anthropic", "ai_model_openai",
                                           "ai_monthly_token_limit_per_workspace")},
            "pricing": {m: {"input_per_mtok": a, "output_per_mtok": b} for m, (a, b) in PRICES.items()}}


@router.put("/ai-usage/settings")
async def ai_settings(body: AISettingsIn, ctx: AdminContext = Depends(require_admin("settings.manage")),
                      db: AsyncSession = Depends(get_db)) -> dict:
    return await _save_settings(db, ctx, body.model_dump(exclude_none=True))


# -------------------------------------------------------------------------------- review analytics etc.
@router.get("/review-analytics")
async def review_analytics(ctx: AdminContext = Depends(require_admin("analytics.read")), db: AsyncSession = Depends(get_db)) -> dict:
    total = await db.scalar(select(func.count()).select_from(Review).where(Review.deleted_at.is_(None)))
    demo = await db.scalar(select(func.count()).select_from(Review).where(Review.is_demo.is_(True)))
    sent = dict((await db.execute(select(ReviewSentiment.sentiment, func.count()).group_by(ReviewSentiment.sentiment))).all())
    by_provider = dict((await db.execute(select(ReviewSentiment.provider, func.count()).group_by(ReviewSentiment.provider))).all())
    day = cast(Review.created_at, Date)
    ingested = [{"date": d.isoformat(), "reviews": n} for d, n in (await db.execute(
        select(day, func.count()).where(Review.created_at > _since(30)).group_by(day).order_by(day))).all()]
    by_platform = [{"platform": pl or "unspecified", "count": n} for pl, n in (await db.execute(
        select(Review.platform, func.count()).group_by(Review.platform).order_by(func.count().desc()).limit(10))).all()]
    by_lang = [{"language": lang or "unknown", "count": n} for lang, n in (await db.execute(
        select(Review.language, func.count()).group_by(Review.language).order_by(func.count().desc()).limit(10))).all()]
    return {"total_reviews": total, "demo_reviews": demo, "sentiment": sent, "by_provider": by_provider,
            "ingested_30d": ingested, "by_platform": by_platform, "by_language": by_lang}


@router.get("/projects")
async def admin_projects(q: str | None = None, p: Pagination = Depends(), ctx: AdminContext = Depends(require_admin("projects.read")),
                         db: AsyncSession = Depends(get_db)) -> dict:
    stmt = select(Project, Workspace.name).join(Workspace, Workspace.id == Project.workspace_id).where(Project.deleted_at.is_(None))
    if q:
        stmt = stmt.where(or_(Project.name.ilike(f"%{q}%"), Workspace.name.ilike(f"%{q}%")))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.execute(stmt.order_by(Project.created_at.desc()).offset(p.offset).limit(p.page_size))).all()
    counts = dict((await db.execute(select(Review.project_id, func.count()).where(
        Review.project_id.in_([x.id for x, _ in rows])).group_by(Review.project_id))).all()) if rows else {}
    return page([{**project_out(x, {"total": int(counts.get(x.id, 0))}), "workspace_name": n} for x, n in rows],
                int(total or 0), p)


@router.get("/reports")
async def admin_reports(p: Pagination = Depends(), ctx: AdminContext = Depends(require_admin("reports.read")),
                        db: AsyncSession = Depends(get_db)) -> dict:
    stmt = select(Report, Workspace.name).join(Workspace, Workspace.id == Report.workspace_id).where(Report.deleted_at.is_(None))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.execute(stmt.order_by(Report.created_at.desc()).offset(p.offset).limit(p.page_size))).all()
    return page([{**report_out(r), "workspace_name": n} for r, n in rows], int(total or 0), p)


# ----------------------------------------------------------------------------------------- integrations
class IntegrationToggleIn(BaseModel):
    provider: str
    enabled: bool


@router.get("/integrations")
async def admin_integrations(ctx: AdminContext = Depends(require_admin("integrations.read")),
                             db: AsyncSession = Depends(get_db)) -> dict:
    counts = {(pr, st): n for pr, st, n in (await db.execute(
        select(Integration.provider, Integration.status, func.count()).group_by(Integration.provider, Integration.status))).all()}
    disabled = set(await settings_service.get(db, "disabled_integrations") or [])
    errors = (await db.execute(select(IntegrationSyncLog, Integration.provider, Workspace.name)
                               .join(Integration, Integration.id == IntegrationSyncLog.integration_id)
                               .join(Workspace, Workspace.id == IntegrationSyncLog.workspace_id)
                               .where(IntegrationSyncLog.status == "error")
                               .order_by(IntegrationSyncLog.created_at.desc()).limit(25))).all()
    activity = (await db.execute(select(IntegrationSyncLog, Integration.provider, Workspace.name)
                                 .join(Integration, Integration.id == IntegrationSyncLog.integration_id)
                                 .join(Workspace, Workspace.id == IntegrationSyncLog.workspace_id)
                                 .order_by(IntegrationSyncLog.created_at.desc()).limit(25))).all()

    def log_row(log, provider, ws):  # noqa: ANN001
        return {"provider": provider, "workspace": ws, "action": log.action, "status": log.status, "message": log.message,
                "created_at": iso(log.created_at)}

    return {
        "providers": [{"provider": c["provider"], "name": c["name"], "category": c["category"],
                       "availability": c["availability"], "enabled": c["provider"] not in disabled,
                       "connected": counts.get((c["provider"], "connected"), 0),
                       "errored": counts.get((c["provider"], "error"), 0)} for c in CATALOG],
        "credentials": {"google_oauth": settings.google_oauth_enabled, "stripe": settings.stripe_enabled,
                        "resend": bool(settings.resend_api_key), "anthropic": bool(settings.anthropic_api_key),
                        "openai": bool(settings.openai_api_key), "s3": settings.s3_enabled},
        "errors": [log_row(*e) for e in errors], "activity": [log_row(*a) for a in activity],
    }


@router.put("/integrations/toggle")
async def toggle_integration(body: IntegrationToggleIn, ctx: AdminContext = Depends(require_admin("settings.manage")),
                             db: AsyncSession = Depends(get_db)) -> dict:
    if body.provider not in {c["provider"] for c in CATALOG}:
        raise NotFound("Unknown integration provider.")
    disabled = set(await settings_service.get(db, "disabled_integrations") or [])
    if body.enabled:
        disabled.discard(body.provider)
    else:
        disabled.add(body.provider)
    return await _save_settings(db, ctx, {"disabled_integrations": sorted(disabled)})


# ------------------------------------------------------------------------------------------------ jobs
@router.get("/jobs")
async def admin_jobs(status: str | None = None, job_type: str | None = None, dead_letter: bool = False,
                     p: Pagination = Depends(), ctx: AdminContext = Depends(require_admin("jobs.read")),
                     db: AsyncSession = Depends(get_db)) -> dict:
    stmt = select(AnalysisJob, Workspace.name).outerjoin(Workspace, Workspace.id == AnalysisJob.workspace_id)
    if status:
        stmt = stmt.where(AnalysisJob.status == status)
    if job_type:
        stmt = stmt.where(AnalysisJob.job_type == job_type)
    if dead_letter:
        stmt = stmt.where(AnalysisJob.dead_lettered_at.is_not(None))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.execute(stmt.order_by(AnalysisJob.created_at.desc()).offset(p.offset).limit(p.page_size))).all()
    counts = dict((await db.execute(select(AnalysisJob.status, func.count()).where(
        AnalysisJob.created_at > _since(7)).group_by(AnalysisJob.status))).all())
    return {**page([{**job_out(j), "workspace_name": n} for j, n in rows], int(total or 0), p), "counts_7d": counts}


@router.post("/jobs/{job_id}/{action}")
async def job_action(job_id: uuid.UUID, action: Literal["retry", "cancel"], ctx: AdminContext = Depends(require_admin("jobs.manage")),
                     db: AsyncSession = Depends(get_db)) -> dict:
    job = await db.get(AnalysisJob, job_id)
    if not job:
        raise NotFound("Job not found.")
    if action == "retry":
        if job.status not in ("failed", "cancelled"):
            raise AppError("Only failed or cancelled jobs can be retried.")
        job.status, job.error, job.dead_lettered_at, job.attempts, job.stage = "pending", None, None, 0, "Queued (admin retry)"
        await _audit(db, ctx, "job.retried", "job", job.id)
        await db.commit()
        await enqueue(job.id)
    else:
        if job.status not in ("pending", "processing"):
            raise AppError("Only pending or running jobs can be cancelled.")
        job.status, job.stage, job.completed_at = "cancelled", "Cancelled by admin", utcnow()
        await _audit(db, ctx, "job.cancelled", "job", job.id)
    return job_out(job)


# --------------------------------------------------------------------------------------------- support
class TicketUpdateIn(BaseModel):
    status: Literal["open", "in_progress", "waiting_on_customer", "resolved", "closed"] | None = None
    priority: Literal["low", "normal", "high", "urgent"] | None = None
    assigned_admin_id: uuid.UUID | None = None
    unassign: bool = False


class TicketMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=10000)
    internal: bool = False


@router.get("/support")
async def tickets(status: str | None = None, assigned_to_me: bool = False, q: str | None = None, p: Pagination = Depends(),
                  ctx: AdminContext = Depends(require_admin("support.read")), db: AsyncSession = Depends(get_db)) -> dict:
    stmt = select(SupportTicket, AdminUser.email).outerjoin(AdminUser, AdminUser.id == SupportTicket.assigned_admin_id)
    if status:
        stmt = stmt.where(SupportTicket.status == status)
    if assigned_to_me:
        stmt = stmt.where(SupportTicket.assigned_admin_id == ctx.admin.id)
    if q:
        stmt = stmt.where(or_(SupportTicket.subject.ilike(f"%{q}%"), SupportTicket.email.ilike(f"%{q}%")))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.execute(stmt.order_by(SupportTicket.updated_at.desc()).offset(p.offset).limit(p.page_size))).all()
    resolved = (await db.execute(select(func.avg(func.extract("epoch", SupportTicket.resolved_at - SupportTicket.created_at)),
                                        func.avg(func.extract("epoch", SupportTicket.first_response_at - SupportTicket.created_at)))
                                 .where(SupportTicket.created_at > _since(90)))).one()
    counts = dict((await db.execute(select(SupportTicket.status, func.count()).group_by(SupportTicket.status))).all())
    return {**page([{"id": str(t.id), "subject": t.subject, "email": t.email, "status": t.status, "priority": t.priority,
                     "category": t.category, "source": t.source, "assigned_to": a, "created_at": iso(t.created_at),
                     "updated_at": iso(t.updated_at)} for t, a in rows], int(total or 0), p),
            "avg_resolution_hours": round(float(resolved[0]) / 3600, 1) if resolved[0] else None,
            "avg_first_response_hours": round(float(resolved[1]) / 3600, 1) if resolved[1] else None,
            "counts": counts}


@router.get("/support/{ticket_id}")
async def ticket_detail(ticket_id: uuid.UUID, ctx: AdminContext = Depends(require_admin("support.read")),
                        db: AsyncSession = Depends(get_db)) -> dict:
    t = await db.get(SupportTicket, ticket_id)
    if not t:
        raise NotFound("Ticket not found.")
    msgs = (await db.execute(select(SupportMessage, AdminUser.email).outerjoin(AdminUser, AdminUser.id == SupportMessage.author_admin_id)
                             .where(SupportMessage.ticket_id == t.id).order_by(SupportMessage.created_at))).all()
    admins = (await db.scalars(select(AdminUser).where(AdminUser.is_active.is_(True)))).all()
    return {"id": str(t.id), "subject": t.subject, "email": t.email, "status": t.status, "priority": t.priority,
            "category": t.category, "source": t.source, "workspace_id": str(t.workspace_id) if t.workspace_id else None,
            "user_id": str(t.user_id) if t.user_id else None,
            "assigned_admin_id": str(t.assigned_admin_id) if t.assigned_admin_id else None,
            "created_at": iso(t.created_at), "first_response_at": iso(t.first_response_at), "resolved_at": iso(t.resolved_at),
            "messages": [{"id": str(m.id), "author_type": m.author_type, "admin_email": a, "body": m.body,
                          "internal": m.is_internal, "created_at": iso(m.created_at)} for m, a in msgs],
            "admins": [{"id": str(a.id), "email": a.email} for a in admins]}


@router.patch("/support/{ticket_id}")
async def update_ticket(ticket_id: uuid.UUID, body: TicketUpdateIn, ctx: AdminContext = Depends(require_admin("support.manage")),
                        db: AsyncSession = Depends(get_db)) -> dict:
    t = await db.get(SupportTicket, ticket_id)
    if not t:
        raise NotFound("Ticket not found.")
    if body.status:
        t.status = body.status
        if body.status in ("resolved", "closed") and not t.resolved_at:
            t.resolved_at = utcnow()
    if body.priority:
        t.priority = body.priority
    if body.unassign:
        t.assigned_admin_id = None
    elif body.assigned_admin_id:
        assignee = await db.get(AdminUser, body.assigned_admin_id)
        if not assignee or not assignee.is_active:
            raise NotFound("Admin not found.")
        t.assigned_admin_id = body.assigned_admin_id
    await _audit(db, ctx, "ticket.updated", "ticket", t.id, **body.model_dump(exclude_none=True, mode="json"))
    return {"message": "Ticket updated."}


@router.post("/support/{ticket_id}/messages")
async def ticket_message(ticket_id: uuid.UUID, body: TicketMessageIn, ctx: AdminContext = Depends(require_admin("support.manage")),
                         db: AsyncSession = Depends(get_db)) -> dict:
    t = await db.get(SupportTicket, ticket_id)
    if not t:
        raise NotFound("Ticket not found.")
    db.add(SupportMessage(ticket_id=t.id, author_type="admin", author_admin_id=ctx.admin.id, body=body.body,
                          is_internal=body.internal))
    if not body.internal:
        t.first_response_at = t.first_response_at or utcnow()
        if t.status == "open":
            t.status = "waiting_on_customer"
        await email_service.send_template(db, t.email, "support_reply", {
            "subject": t.subject, "message": body.body, "link": f"{settings.app_url}/app/support"})
        if t.user_id:
            await notify(db, t.user_id, t.workspace_id, "system", f"Support replied: {t.subject}", body.body[:300], "/app/support")
    t.updated_at = utcnow()
    await _audit(db, ctx, "ticket.note" if body.internal else "ticket.replied", "ticket", t.id)
    return {"message": "Saved."}


# ---------------------------------------------------------------------------------------- announcements
class AnnouncementIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=2, max_length=5000)
    level: Literal["info", "success", "warning", "critical"] = "info"
    audience: Literal["all", "free", "paid"] = "all"
    is_active: bool = True
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    send_email: bool = False


@router.get("/announcements")
async def list_announcements(ctx: AdminContext = Depends(require_admin("dashboard.read")),
                             db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.scalars(select(Announcement).order_by(Announcement.created_at.desc()))).all()
    return [{"id": str(a.id), "title": a.title, "body": a.body, "level": a.level, "audience": a.audience,
             "is_active": a.is_active, "starts_at": iso(a.starts_at), "ends_at": iso(a.ends_at),
             "send_email": a.send_email, "created_at": iso(a.created_at)} for a in rows]


async def _broadcast(db: AsyncSession, a: Announcement) -> int:
    stmt = select(User).where(User.deleted_at.is_(None), User.status == "active")
    if a.audience != "all":
        paid_ws = select(Subscription.workspace_id).join(SubscriptionPlan, SubscriptionPlan.id == Subscription.plan_id) \
            .where(SubscriptionPlan.code != "free")
        stmt = stmt.where(User.default_workspace_id.in_(paid_ws) if a.audience == "paid"
                          else or_(User.default_workspace_id.is_(None), User.default_workspace_id.not_in(paid_ws)))
    users_ = (await db.scalars(stmt.limit(5000))).all()
    for u in users_:
        db.add(Notification(user_id=u.id, notification_type="announcement", title=a.title, body=a.body))
        if a.send_email:
            await email_service.send_template(db, u.email, "announcement",
                                              {"title": a.title, "body": a.body, "app_url": f"{settings.app_url}/app"})
    return len(users_)


@router.post("/announcements", status_code=201)
async def create_announcement(body: AnnouncementIn, ctx: AdminContext = Depends(require_admin("announcements.manage")),
                              db: AsyncSession = Depends(get_db)) -> dict:
    a = Announcement(**body.model_dump(), created_by_admin_id=ctx.admin.id)
    db.add(a)
    await db.flush()
    starts_now = a.starts_at is None or a.starts_at <= utcnow()
    sent = await _broadcast(db, a) if a.is_active and starts_now else 0
    await _audit(db, ctx, "announcement.created", "announcement", a.id, title=a.title, recipients=sent)
    return {"id": str(a.id), "recipients": sent}


@router.patch("/announcements/{announcement_id}")
async def update_announcement(announcement_id: uuid.UUID, body: AnnouncementIn,
                              ctx: AdminContext = Depends(require_admin("announcements.manage")),
                              db: AsyncSession = Depends(get_db)) -> dict:
    a = await db.get(Announcement, announcement_id)
    if not a:
        raise NotFound("Announcement not found.")
    for k, v in body.model_dump().items():
        setattr(a, k, v)
    await _audit(db, ctx, "announcement.updated", "announcement", a.id)
    return {"id": str(a.id)}


@router.delete("/announcements/{announcement_id}")
async def delete_announcement(announcement_id: uuid.UUID, ctx: AdminContext = Depends(require_admin("announcements.manage")),
                              db: AsyncSession = Depends(get_db)) -> dict:
    a = await db.get(Announcement, announcement_id)
    if not a:
        raise NotFound("Announcement not found.")
    await db.delete(a)
    await _audit(db, ctx, "announcement.deleted", "announcement", announcement_id)
    return {"message": "Deleted."}


# -------------------------------------------------------------------------------------- notifications
class BroadcastIn(BaseModel):
    title: str = Field(min_length=2, max_length=300)
    body: str = Field(default="", max_length=5000)
    audience: Literal["all", "free", "paid", "user"] = "all"
    user_email: EmailStr | None = None
    send_email: bool = False


@router.get("/notifications")
async def notification_log(p: Pagination = Depends(), ctx: AdminContext = Depends(require_admin("notifications.manage")),
                           db: AsyncSession = Depends(get_db)) -> dict:
    stmt = select(EmailLog)
    total = await db.scalar(select(func.count()).select_from(EmailLog))
    rows = (await db.scalars(stmt.order_by(EmailLog.created_at.desc()).offset(p.offset).limit(p.page_size))).all()
    return page([{"id": str(e.id), "to": e.to_email, "template": e.template_key, "subject": e.subject, "status": e.status,
                  "error": e.error, "created_at": iso(e.created_at)} for e in rows], int(total or 0), p)


@router.post("/notifications/send")
async def send_notification(body: BroadcastIn, ctx: AdminContext = Depends(require_admin("notifications.manage")),
                            db: AsyncSession = Depends(get_db)) -> dict:
    if body.audience == "user":
        u = await db.scalar(select(User).where(User.email == (body.user_email or "").lower(), User.deleted_at.is_(None)))
        if not u:
            raise NotFound("No user with that email.")
        await notify(db, u.id, None, "system", body.title, body.body)
        if body.send_email:
            await email_service.send_template(db, u.email, "account_notice", {"subject": body.title, "message": body.body})
        sent = 1
    else:
        a = Announcement(title=body.title, body=body.body, audience=body.audience, is_active=False, send_email=body.send_email)
        sent = await _broadcast(db, a)
    await _audit(db, ctx, "notification.sent", "notification", None, audience=body.audience, recipients=sent, title=body.title)
    return {"recipients": sent}


# --------------------------------------------------------------------------------------- email templates
class TemplateIn(BaseModel):
    subject: str = Field(min_length=1, max_length=300)
    html_body: str = Field(min_length=1, max_length=100_000)
    text_body: str = Field(min_length=1, max_length=50_000)


class TestEmailIn(BaseModel):
    to: EmailStr


@router.get("/email-templates")
async def templates(ctx: AdminContext = Depends(require_admin("email_templates.read")), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.scalars(select(EmailTemplate).order_by(EmailTemplate.name))).all()
    return [{"id": str(t.id), "key": t.key, "name": t.name, "subject": t.subject, "html_body": t.html_body,
             "text_body": t.text_body, "variables": t.variables, "updated_at": iso(t.updated_at)} for t in rows]


@router.put("/email-templates/{key}")
async def update_template(key: str, body: TemplateIn, ctx: AdminContext = Depends(require_admin("email_templates.manage")),
                          db: AsyncSession = Depends(get_db)) -> dict:
    t = await db.scalar(select(EmailTemplate).where(EmailTemplate.key == key))
    if not t:
        raise NotFound("Template not found.")
    t.subject, t.html_body, t.text_body, t.updated_by_admin_id = body.subject, body.html_body, body.text_body, ctx.admin.id
    await _audit(db, ctx, "email_template.updated", "email_template", key)
    return {"message": "Template saved."}


@router.post("/email-templates/{key}/preview")
async def preview_template(key: str, body: TemplateIn, ctx: AdminContext = Depends(require_admin("email_templates.read")),
                           db: AsyncSession = Depends(get_db)) -> dict:
    t = await db.scalar(select(EmailTemplate).where(EmailTemplate.key == key))
    sample = {v: f"[{v}]" for v in (t.variables if t else [])}
    return {"subject": render(body.subject, sample, escape=False), "html": render(body.html_body, sample, escape=True)}


@router.post("/email-templates/{key}/test")
async def test_template(key: str, body: TestEmailIn, ctx: AdminContext = Depends(require_admin("email_templates.manage")),
                        db: AsyncSession = Depends(get_db)) -> dict:
    t = await db.scalar(select(EmailTemplate).where(EmailTemplate.key == key))
    if not t:
        raise NotFound("Template not found.")
    log = await email_service.send_template(db, body.to, key, {v: f"[{v}]" for v in t.variables})
    await _audit(db, ctx, "email_template.test_sent", "email_template", key, to=body.to)
    return {"status": log.status, "error": log.error}


# --------------------------------------------------------------------------------------------- audit
@router.get("/audit-logs")
async def audit_logs(action: str | None = None, admin_email: str | None = None, target_type: str | None = None,
                     p: Pagination = Depends(), ctx: AdminContext = Depends(require_admin("audit.read")),
                     db: AsyncSession = Depends(get_db)) -> dict:
    stmt = select(AdminAuditLog)
    if action:
        stmt = stmt.where(AdminAuditLog.action.ilike(f"%{action}%"))
    if admin_email:
        stmt = stmt.where(AdminAuditLog.admin_email.ilike(f"%{admin_email}%"))
    if target_type:
        stmt = stmt.where(AdminAuditLog.target_type == target_type)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.scalars(stmt.order_by(AdminAuditLog.created_at.desc()).offset(p.offset).limit(p.page_size))).all()
    return page([{"id": str(a.id), "admin_id": str(a.admin_id) if a.admin_id else None, "admin_email": a.admin_email,
                  "action": a.action, "target_type": a.target_type, "target_id": a.target_id, "ip_address": a.ip_address,
                  "user_agent": a.user_agent, "metadata": a.meta, "created_at": iso(a.created_at)} for a in rows],
                int(total or 0), p)


# ------------------------------------------------------------------------------------------ feature flags
class FlagIn(BaseModel):
    key: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9_\.]+$")
    description: str = Field(default="", max_length=1000)
    enabled: bool = False
    plan_codes: list[str] = []
    workspace_ids: list[str] = []


@router.get("/feature-flags")
async def flags(ctx: AdminContext = Depends(require_admin("flags.read")), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.scalars(select(FeatureFlag).order_by(FeatureFlag.key))).all()
    return [{"id": str(f.id), "key": f.key, "description": f.description, "enabled": f.enabled, "plan_codes": f.plan_codes,
             "workspace_ids": f.workspace_ids, "updated_at": iso(f.updated_at)} for f in rows]


@router.put("/feature-flags")
async def upsert_flag(body: FlagIn, ctx: AdminContext = Depends(require_admin("flags.manage")), db: AsyncSession = Depends(get_db)) -> dict:
    f = await db.scalar(select(FeatureFlag).where(FeatureFlag.key == body.key))
    if not f:
        f = FeatureFlag(key=body.key)
        db.add(f)
    f.description, f.enabled, f.plan_codes, f.workspace_ids = body.description, body.enabled, body.plan_codes, body.workspace_ids
    await _audit(db, ctx, "feature_flag.updated", "feature_flag", body.key, enabled=body.enabled)
    return {"key": f.key, "enabled": f.enabled}


@router.delete("/feature-flags/{key}")
async def delete_flag(key: str, ctx: AdminContext = Depends(require_admin("flags.manage")), db: AsyncSession = Depends(get_db)) -> dict:
    f = await db.scalar(select(FeatureFlag).where(FeatureFlag.key == key))
    if not f:
        raise NotFound("Flag not found.")
    await db.delete(f)
    await _audit(db, ctx, "feature_flag.deleted", "feature_flag", key)
    return {"message": "Deleted."}


# ------------------------------------------------------------------------------------------------ settings
async def _save_settings(db: AsyncSession, ctx: AdminContext, values: dict[str, Any]) -> dict:
    from app.models import SystemSetting

    current = await settings_service.get_all(db, fresh=True)
    changed = {}
    for key, value in values.items():
        try:
            settings_service.validate(key, value)
        except ValueError as exc:
            raise AppError(str(exc), code="validation_error")
        row = await db.get(SystemSetting, key)
        if row is None:
            row = SystemSetting(key=key)
            db.add(row)
        if current.get(key) != value:
            changed[key] = {"from": current.get(key), "to": value}
        row.value, row.updated_at, row.updated_by_admin_id = value, utcnow(), ctx.admin.id
    settings_service.invalidate()
    if changed:
        await _audit(db, ctx, "settings.updated", "settings", None, changes=changed)
    return await settings_service.get_all(db, fresh=True)


@router.get("/settings")
async def get_settings(ctx: AdminContext = Depends(require_admin("settings.read")), db: AsyncSession = Depends(get_db)) -> dict:
    return {"settings": await settings_service.get_all(db, fresh=True),
            "environment": {"environment": settings.environment, "storage": "s3" if settings.s3_enabled else "local",
                            "email": "resend" if settings.resend_api_key else "log-only",
                            "jobs": "inline" if settings.jobs_inline else "redis/arq"}}


@router.put("/settings")
async def put_settings(values: dict[str, Any], ctx: AdminContext = Depends(require_admin("settings.manage")),
                       db: AsyncSession = Depends(get_db)) -> dict:
    return {"settings": await _save_settings(db, ctx, values)}


# ------------------------------------------------------------------------------------------------ admins
class AdminCreateIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    role: Literal["super_admin", "support_admin", "billing_admin", "read_only"]
    password: str = Field(min_length=12, max_length=200)


class AdminUpdateIn(BaseModel):
    role: Literal["super_admin", "support_admin", "billing_admin", "read_only"] | None = None
    is_active: bool | None = None


@router.get("/admins")
async def admins(ctx: AdminContext = Depends(require_admin("admins.manage")), db: AsyncSession = Depends(get_db)) -> dict:
    rows = (await db.scalars(select(AdminUser).order_by(AdminUser.created_at))).all()
    return {"admins": [admin_out(a) for a in rows], "roles": {k: sorted(v) for k, v in ADMIN_PERMISSIONS.items()}}


@router.post("/admins", status_code=201)
async def create_admin(body: AdminCreateIn, ctx: AdminContext = Depends(require_admin("admins.manage")),
                       db: AsyncSession = Depends(get_db)) -> dict:
    if await db.scalar(select(AdminUser.id).where(AdminUser.email == body.email.lower())):
        raise Conflict("An admin with this email already exists.")
    errors = password_strength_errors(body.password)
    if errors:
        raise AppError(errors[0])
    a = AdminUser(email=body.email.lower(), full_name=body.full_name, role=body.role,
                  password_hash=hash_password(body.password), created_by_admin_id=ctx.admin.id)
    db.add(a)
    await db.flush()
    await _audit(db, ctx, "admin.created", "admin", a.id, role=body.role, email=a.email)
    return admin_out(a)


@router.patch("/admins/{admin_id}")
async def update_admin(admin_id: uuid.UUID, body: AdminUpdateIn, ctx: AdminContext = Depends(require_admin("admins.manage")),
                       db: AsyncSession = Depends(get_db)) -> dict:
    a = await db.get(AdminUser, admin_id)
    if not a:
        raise NotFound("Admin not found.")
    if a.id == ctx.admin.id:
        raise AppError("You can't change your own role or status.")
    if a.role == "super_admin" and (body.role not in (None, "super_admin") or body.is_active is False):
        supers = await db.scalar(select(func.count()).select_from(AdminUser).where(
            AdminUser.role == "super_admin", AdminUser.is_active.is_(True)))
        if (supers or 0) <= 1:
            raise AppError("There must be at least one active super-admin.")
    before = {"role": a.role, "is_active": a.is_active}
    if body.role:
        a.role = body.role
    if body.is_active is not None:
        a.is_active = body.is_active
    await _audit(db, ctx, "admin.updated", "admin", a.id, before=before, after=body.model_dump(exclude_none=True))
    return admin_out(a)


_ = String
