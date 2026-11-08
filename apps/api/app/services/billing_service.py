"""Stripe subscriptions: Checkout, Customer Portal, plan changes, cancellation and webhook-driven lifecycle sync."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError, ServiceUnavailable
from app.core.security import utcnow
from app.models import (
    Invoice,
    Payment,
    StripeEvent,
    Subscription,
    SubscriptionPlan,
    User,
    Workspace,
    WorkspaceMember,
)
from app.services import email_service
from app.services.activity import notify

log = logging.getLogger(__name__)


def client() -> stripe.StripeClient:
    if not settings.stripe_enabled:
        raise ServiceUnavailable("Billing is not configured. Set STRIPE_SECRET_KEY to enable paid plans.",
                                 code="stripe_not_configured")
    return stripe.StripeClient(settings.stripe_secret_key)


def _d(obj: Any) -> dict:
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    return obj.to_dict() if hasattr(obj, "to_dict") else dict(obj)


def _ts(value: int | None) -> datetime | None:
    return datetime.fromtimestamp(value, UTC) if value else None


async def _subscription(db: AsyncSession, workspace_id: uuid.UUID) -> Subscription:
    sub = await db.scalar(select(Subscription).where(Subscription.workspace_id == workspace_id))
    if sub is None:
        from app.services.entitlements import get_free_plan

        sub = Subscription(workspace_id=workspace_id, plan_id=(await get_free_plan(db)).id, status="active")
        db.add(sub)
        await db.flush()
    return sub


async def ensure_price(db: AsyncSession, plan: SubscriptionPlan) -> str:
    """Use the configured Stripe price, or create the product/price in Stripe from the plan's admin-set price."""
    if plan.stripe_price_id_monthly:
        return plan.stripe_price_id_monthly
    if not plan.price_monthly_cents:
        raise AppError(f"The {plan.name} plan has no self-serve price. Contact sales.", code="custom_pricing")
    sc = client()
    if not plan.stripe_product_id:
        product = await sc.v1.products.create_async(params={"name": f"CustomerSignal AI {plan.name}",
                                                             "metadata": {"plan_code": plan.code}})
        plan.stripe_product_id = product.id
    price = await sc.v1.prices.create_async(params={
        "product": plan.stripe_product_id, "unit_amount": plan.price_monthly_cents, "currency": plan.currency,
        "recurring": {"interval": "month"}, "metadata": {"plan_code": plan.code},
    })
    plan.stripe_price_id_monthly = price.id
    await db.flush()
    return price.id


async def ensure_customer(db: AsyncSession, ws: Workspace, user: User) -> str:
    sub = await _subscription(db, ws.id)
    if sub.stripe_customer_id:
        return sub.stripe_customer_id
    customer = await client().v1.customers.create_async(params={
        "email": user.email, "name": ws.name, "metadata": {"workspace_id": str(ws.id)},
    })
    sub.stripe_customer_id = customer.id
    await db.flush()
    return customer.id


async def start_checkout(db: AsyncSession, ws: Workspace, user: User, plan_code: str) -> dict:
    plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == plan_code,
                                                          SubscriptionPlan.is_active.is_(True)))
    if not plan or plan.code == "free":
        raise AppError("Choose a paid plan.", code="invalid_plan")
    if plan.price_monthly_cents is None:
        raise AppError("Enterprise pricing is custom — contact sales.", code="custom_pricing")
    sub = await _subscription(db, ws.id)
    price_id = await ensure_price(db, plan)
    sc = client()
    if sub.stripe_subscription_id and sub.status in ("active", "trialing", "past_due"):
        # Upgrade / downgrade in place with proration.
        stripe_sub = _d(await sc.v1.subscriptions.retrieve_async(sub.stripe_subscription_id))
        item_id = stripe_sub["items"]["data"][0]["id"]
        updated = await sc.v1.subscriptions.update_async(sub.stripe_subscription_id, params={
            "items": [{"id": item_id, "price": price_id}], "proration_behavior": "create_prorations",
            "cancel_at_period_end": False, "metadata": {"workspace_id": str(ws.id), "plan_code": plan.code},
        })
        await sync_subscription(db, _d(updated))
        return {"mode": "updated", "url": f"{settings.app_url}/app/billing?changed={plan.code}"}
    customer_id = await ensure_customer(db, ws, user)
    trial_days = plan.trial_days if sub.trial_ends_at is None and not sub.stripe_subscription_id else 0
    params: dict[str, Any] = {
        "mode": "subscription", "customer": customer_id, "client_reference_id": str(ws.id),
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": f"{settings.app_url}/app/billing?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{settings.app_url}/app/billing?checkout=cancelled",
        "allow_promotion_codes": True,
        "subscription_data": {"metadata": {"workspace_id": str(ws.id), "plan_code": plan.code}},
        "metadata": {"workspace_id": str(ws.id), "plan_code": plan.code},
    }
    if trial_days:
        params["subscription_data"]["trial_period_days"] = trial_days
    session = await sc.v1.checkout.sessions.create_async(params=params)
    return {"mode": "checkout", "url": session.url}


async def portal(db: AsyncSession, ws: Workspace, user: User) -> str:
    customer_id = await ensure_customer(db, ws, user)
    session = await client().v1.billing_portal.sessions.create_async(params={
        "customer": customer_id, "return_url": f"{settings.app_url}/app/billing"})
    return session.url


async def set_cancel_at_period_end(db: AsyncSession, ws: Workspace, cancel: bool) -> Subscription:
    sub = await _subscription(db, ws.id)
    if not sub.stripe_subscription_id:
        raise AppError("This workspace has no paid subscription.", code="no_subscription")
    updated = await client().v1.subscriptions.update_async(sub.stripe_subscription_id,
                                                           params={"cancel_at_period_end": cancel})
    await sync_subscription(db, _d(updated))
    return sub


async def _plan_for_price(db: AsyncSession, price_id: str | None, plan_code: str | None) -> SubscriptionPlan | None:
    if price_id:
        plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.stripe_price_id_monthly == price_id))
        if plan:
            return plan
    if plan_code:
        return await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == plan_code))
    return None


async def _workspace_for(db: AsyncSession, metadata: dict, customer_id: str | None) -> uuid.UUID | None:
    if metadata.get("workspace_id"):
        try:
            return uuid.UUID(metadata["workspace_id"])
        except ValueError:
            pass
    if customer_id:
        return await db.scalar(select(Subscription.workspace_id).where(Subscription.stripe_customer_id == customer_id))
    return None


async def sync_subscription(db: AsyncSession, s: dict) -> Subscription | None:
    ws_id = await _workspace_for(db, s.get("metadata") or {}, s.get("customer"))
    if not ws_id:
        log.warning("Stripe subscription %s has no matching workspace", s.get("id"))
        return None
    sub = await _subscription(db, ws_id)
    items = (s.get("items") or {}).get("data") or [{}]
    item = items[0]
    price = item.get("price") or {}
    plan = await _plan_for_price(db, price.get("id"), (s.get("metadata") or {}).get("plan_code"))
    status = s.get("status", "active")
    if status in ("incomplete_expired",):
        status = "canceled"
    if plan:
        sub.plan_id = plan.id
    sub.status = status if status in ("trialing", "active", "past_due", "canceled", "incomplete", "unpaid") else "active"
    sub.stripe_subscription_id = s.get("id")
    sub.stripe_customer_id = s.get("customer") or sub.stripe_customer_id
    sub.current_period_start = _ts(s.get("current_period_start") or item.get("current_period_start"))
    sub.current_period_end = _ts(s.get("current_period_end") or item.get("current_period_end"))
    sub.cancel_at_period_end = bool(s.get("cancel_at_period_end"))
    sub.canceled_at = _ts(s.get("canceled_at"))
    sub.trial_ends_at = _ts(s.get("trial_end")) or sub.trial_ends_at
    sub.mrr_cents = int(price.get("unit_amount") or 0) * int(item.get("quantity") or 1) if sub.status in (
        "active", "past_due") else 0
    if sub.status == "canceled":
        from app.services.entitlements import get_free_plan

        sub.plan_id = (await get_free_plan(db)).id
        sub.stripe_subscription_id = None
        sub.mrr_cents = 0
        sub.status = "active"  # back on Free
    await db.flush()
    return sub


async def _owners(db: AsyncSession, ws_id: uuid.UUID) -> list[User]:
    return list((await db.scalars(
        select(User).join(WorkspaceMember, WorkspaceMember.user_id == User.id)
        .where(WorkspaceMember.workspace_id == ws_id, WorkspaceMember.role.in_(("owner", "admin")))
    )).all())


async def _upsert_invoice(db: AsyncSession, inv: dict) -> tuple[Invoice | None, uuid.UUID | None]:
    ws_id = await _workspace_for(db, (inv.get("subscription_details") or {}).get("metadata")
                                 or ((inv.get("parent") or {}).get("subscription_details") or {}).get("metadata") or {},
                                 inv.get("customer"))
    if not ws_id:
        return None, None
    row = await db.scalar(select(Invoice).where(Invoice.stripe_invoice_id == inv["id"]))
    if row is None:
        row = Invoice(workspace_id=ws_id, stripe_invoice_id=inv["id"], status=inv.get("status") or "open")
        db.add(row)
    lines = (inv.get("lines") or {}).get("data") or [{}]
    period = lines[0].get("period") or {}
    price_id = ((lines[0].get("price") or {}).get("id")) or \
        (((lines[0].get("pricing") or {}).get("price_details") or {}).get("price"))
    plan = await _plan_for_price(db, price_id, None)
    row.number = inv.get("number")
    row.amount_due_cents = inv.get("amount_due") or 0
    row.amount_paid_cents = inv.get("amount_paid") or 0
    row.currency = inv.get("currency") or "usd"
    row.status = inv.get("status") or row.status
    row.hosted_invoice_url = inv.get("hosted_invoice_url")
    row.invoice_pdf_url = inv.get("invoice_pdf")
    row.period_start = _ts(period.get("start"))
    row.period_end = _ts(period.get("end"))
    row.plan_code = plan.code if plan else row.plan_code
    await db.flush()
    return row, ws_id


async def handle_webhook(db: AsyncSession, payload: bytes, signature: str | None) -> dict:
    if not settings.stripe_webhook_secret:
        raise ServiceUnavailable("STRIPE_WEBHOOK_SECRET is not configured.", code="stripe_not_configured")
    try:
        event = stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError):
        raise AppError("Invalid Stripe signature.", code="invalid_signature", status_code=400)
    evt = _d(event)
    if await db.get(StripeEvent, evt["id"]):
        return {"status": "duplicate"}
    obj = evt["data"]["object"]
    etype = evt["type"]
    if etype == "checkout.session.completed" and obj.get("subscription"):
        stripe_sub = _d(await client().v1.subscriptions.retrieve_async(obj["subscription"]))
        if not (stripe_sub.get("metadata") or {}).get("workspace_id") and obj.get("client_reference_id"):
            stripe_sub.setdefault("metadata", {})["workspace_id"] = obj["client_reference_id"]
        sub = await sync_subscription(db, stripe_sub)
        if sub:
            ws = await db.get(Workspace, sub.workspace_id)
            plan = await db.get(SubscriptionPlan, sub.plan_id)
            for u in await _owners(db, sub.workspace_id):
                await notify(db, u.id, sub.workspace_id, "billing", f"You're on the {plan.name} plan",
                             "Your subscription is active.", "/app/billing")
                await email_service.send_template(db, u.email, "subscription_confirmed", {
                    "workspace": ws.name if ws else "", "plan": plan.name if plan else "",
                    "billing_url": f"{settings.app_url}/app/billing"})
    elif etype in ("customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"):
        if etype == "customer.subscription.deleted":
            obj = {**obj, "status": "canceled"}
        await sync_subscription(db, obj)
    elif etype in ("invoice.paid", "invoice.payment_succeeded"):
        inv, ws_id = await _upsert_invoice(db, obj)
        if inv and ws_id:
            pi = obj.get("payment_intent") or obj["id"]
            if not await db.scalar(select(Payment).where(Payment.stripe_payment_intent_id == pi)):
                db.add(Payment(workspace_id=ws_id, invoice_id=inv.id, stripe_payment_intent_id=pi,
                               stripe_charge_id=obj.get("charge"), amount_cents=obj.get("amount_paid") or 0,
                               currency=obj.get("currency") or "usd", status="succeeded", plan_code=inv.plan_code))
    elif etype == "invoice.payment_failed":
        inv, ws_id = await _upsert_invoice(db, obj)
        if inv and ws_id:
            db.add(Payment(workspace_id=ws_id, invoice_id=inv.id,
                           stripe_payment_intent_id=f"{obj.get('payment_intent') or obj['id']}:{evt['id']}",
                           amount_cents=obj.get("amount_due") or 0, currency=obj.get("currency") or "usd",
                           status="failed", failure_reason=((obj.get("last_finalization_error") or {}).get("message")
                                                            or "Card payment failed"), plan_code=inv.plan_code))
            ws = await db.get(Workspace, ws_id)
            for u in await _owners(db, ws_id):
                await notify(db, u.id, ws_id, "billing", "Payment failed", "Update your payment method to keep your plan.",
                             "/app/billing")
                await email_service.send_template(db, u.email, "payment_failed", {
                    "workspace": ws.name if ws else "", "billing_url": f"{settings.app_url}/app/billing"})
    elif etype == "charge.refunded":
        pi = obj.get("payment_intent")
        payment = await db.scalar(select(Payment).where(Payment.stripe_payment_intent_id == pi)) if pi else None
        if payment:
            payment.refunded_cents = obj.get("amount_refunded") or 0
            payment.status = "refunded" if payment.refunded_cents >= payment.amount_cents else "partially_refunded"
    db.add(StripeEvent(id=evt["id"], event_type=etype, processed_at=utcnow(),
                       payload_summary={"object_id": obj.get("id")}))
    await db.flush()
    return {"status": "processed", "type": etype}
