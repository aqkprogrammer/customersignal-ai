from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_workspace_context, require_role
from app.api.v1.routes.public import plan_out
from app.api.v1.serializers import iso
from app.core.config import settings
from app.core.database import get_db
from app.models import Invoice, Payment, Subscription, SubscriptionPlan
from app.services import analytics, billing_service

router = APIRouter(prefix="/billing", tags=["billing"])


class CheckoutIn(BaseModel):
    plan_code: str


@router.get("")
async def overview(ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> dict:
    sub = await db.scalar(select(Subscription).where(Subscription.workspace_id == ctx.workspace_id))
    plan = await db.get(SubscriptionPlan, sub.plan_id) if sub else None
    plans = (await db.scalars(select(SubscriptionPlan).where(SubscriptionPlan.is_active.is_(True),
                                                             SubscriptionPlan.is_public.is_(True))
                              .order_by(SubscriptionPlan.sort_order))).all()
    return {
        "stripe_enabled": settings.stripe_enabled,
        "subscription": {
            "plan": plan_out(plan) if plan else None, "status": sub.status if sub else "active",
            "current_period_end": iso(sub.current_period_end) if sub else None,
            "cancel_at_period_end": sub.cancel_at_period_end if sub else False,
            "trial_ends_at": iso(sub.trial_ends_at) if sub else None,
            "has_stripe_customer": bool(sub and sub.stripe_customer_id),
            "has_paid_subscription": bool(sub and sub.stripe_subscription_id),
            "manual_overrides": sub.limit_overrides if sub else {},
        },
        "usage": await analytics.usage_summary(db, ctx.workspace_id),
        "plans": [plan_out(p) for p in plans],
        "can_manage": ctx.role in ("owner", "admin"),
    }


@router.post("/checkout")
async def checkout(body: CheckoutIn, ctx: WorkspaceContext = Depends(require_role("owner")),
                   db: AsyncSession = Depends(get_db)) -> dict:
    return await billing_service.start_checkout(db, ctx.workspace, ctx.user, body.plan_code)


@router.post("/portal")
async def portal(ctx: WorkspaceContext = Depends(require_role("owner")), db: AsyncSession = Depends(get_db)) -> dict:
    return {"url": await billing_service.portal(db, ctx.workspace, ctx.user)}


@router.post("/cancel")
async def cancel(ctx: WorkspaceContext = Depends(require_role("owner")), db: AsyncSession = Depends(get_db)) -> dict:
    sub = await billing_service.set_cancel_at_period_end(db, ctx.workspace, True)
    return {"cancel_at_period_end": sub.cancel_at_period_end, "current_period_end": iso(sub.current_period_end)}


@router.post("/resume")
async def resume(ctx: WorkspaceContext = Depends(require_role("owner")), db: AsyncSession = Depends(get_db)) -> dict:
    sub = await billing_service.set_cancel_at_period_end(db, ctx.workspace, False)
    return {"cancel_at_period_end": sub.cancel_at_period_end}


@router.get("/invoices")
async def invoices(ctx: WorkspaceContext = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.scalars(select(Invoice).where(Invoice.workspace_id == ctx.workspace_id)
                             .order_by(Invoice.created_at.desc()).limit(100))).all()
    return [{"id": str(i.id), "number": i.number, "amount_due_cents": i.amount_due_cents,
             "amount_paid_cents": i.amount_paid_cents, "currency": i.currency, "status": i.status,
             "plan_code": i.plan_code, "hosted_invoice_url": i.hosted_invoice_url, "invoice_pdf_url": i.invoice_pdf_url,
             "period_start": iso(i.period_start), "period_end": iso(i.period_end), "created_at": iso(i.created_at)}
            for i in rows]


@router.get("/payments")
async def payments(ctx: WorkspaceContext = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.scalars(select(Payment).where(Payment.workspace_id == ctx.workspace_id)
                             .order_by(Payment.created_at.desc()).limit(100))).all()
    return [{"id": str(p.id), "amount_cents": p.amount_cents, "refunded_cents": p.refunded_cents, "currency": p.currency,
             "status": p.status, "failure_reason": p.failure_reason, "created_at": iso(p.created_at)} for p in rows]


@router.post("/webhook", include_in_schema=False)
async def webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    payload = await request.body()
    return await billing_service.handle_webhook(db, payload, request.headers.get("stripe-signature"))
