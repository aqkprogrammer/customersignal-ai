"""Stripe webhook: signature verification, subscription sync, idempotency and cancellation fallback."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid

from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import session_scope
from app.models import StripeEvent, Subscription, SubscriptionPlan

WEBHOOK = "/api/v1/billing/webhook"


def sign(payload: str, secret: str | None = None, ts: int | None = None) -> str:
    ts = ts or int(time.time())
    secret = secret or settings.stripe_webhook_secret
    sig = hmac.new(secret.encode(), f"{ts}.{payload}".encode(), hashlib.sha256).hexdigest()
    return f"t={ts},v1={sig}"


def subscription_event(workspace_id: str, event_type: str = "customer.subscription.updated", *,
                       plan_code: str = "pro", status: str = "active", event_id: str | None = None,
                       price_id: str = "price_test_pro") -> str:
    now = int(time.time())
    return json.dumps({
        "id": event_id or f"evt_{uuid.uuid4().hex[:16]}", "object": "event", "type": event_type,
        "data": {"object": {
            "id": "sub_test_123", "object": "subscription", "customer": "cus_test_123", "status": status,
            "cancel_at_period_end": False, "metadata": {"workspace_id": workspace_id, "plan_code": plan_code},
            "items": {"object": "list", "data": [{
                "id": "si_1", "quantity": 1, "current_period_start": now, "current_period_end": now + 30 * 86400,
                "price": {"id": price_id, "unit_amount": 9900, "currency": "usd"}}]},
        }},
    })


async def _plan_code(workspace_id: str) -> tuple[str, Subscription]:
    async with session_scope() as db:
        sub = await db.scalar(select(Subscription).where(Subscription.workspace_id == uuid.UUID(workspace_id)))
        plan = await db.get(SubscriptionPlan, sub.plan_id)
        return plan.code, sub


async def test_webhook_rejects_bad_signature(new_client, account_factory):
    a = await account_factory()
    c = new_client()
    payload = subscription_event(a.workspace_id)
    for header in (None, "garbage", sign(payload, secret="whsec_wrong"), sign(payload, ts=int(time.time()) - 3600)):
        headers = {"stripe-signature": header} if header else {}
        r = await c.post(WEBHOOK, content=payload, headers={"content-type": "application/json", **headers})
        assert r.status_code == 400, header
        assert r.json()["error"]["code"] == "invalid_signature"
    # Tampered body with a signature for the original body.
    sig = sign(payload)
    r = await c.post(WEBHOOK, content=payload.replace("pro", "enterprise"), headers={"stripe-signature": sig})
    assert r.status_code == 400
    assert (await _plan_code(a.workspace_id))[0] == "free"


async def test_webhook_without_secret_is_503(new_client, monkeypatch):
    monkeypatch.setattr(settings, "stripe_webhook_secret", "")
    r = await new_client().post(WEBHOOK, content="{}", headers={"stripe-signature": "t=1,v1=00"})
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "stripe_not_configured"


async def test_subscription_updated_syncs_plan_and_is_idempotent(new_client, account_factory):
    a = await account_factory()
    c = new_client()
    payload = subscription_event(a.workspace_id, event_id="evt_fixed_1")
    r = await c.post(WEBHOOK, content=payload, headers={"stripe-signature": sign(payload)})
    assert r.status_code == 200, r.text
    assert r.json() == {"status": "processed", "type": "customer.subscription.updated"}
    code, sub = await _plan_code(a.workspace_id)
    assert code == "pro"
    assert sub.status == "active" and sub.stripe_subscription_id == "sub_test_123"
    assert sub.stripe_customer_id == "cus_test_123" and sub.mrr_cents == 9900
    assert sub.current_period_end is not None

    # Pro features unlock immediately.
    assert (await a.client.post("/api/v1/leads", json={"business_name": "Paid Lead"})).status_code == 201

    replay = await c.post(WEBHOOK, content=payload, headers={"stripe-signature": sign(payload)})
    assert replay.status_code == 200 and replay.json() == {"status": "duplicate"}
    async with session_scope() as db:
        assert await db.scalar(select(func.count()).select_from(StripeEvent)) == 1


async def test_subscription_deleted_returns_workspace_to_free(new_client, account_factory):
    a = await account_factory()
    c = new_client()
    up = subscription_event(a.workspace_id)
    assert (await c.post(WEBHOOK, content=up, headers={"stripe-signature": sign(up)})).status_code == 200
    assert (await _plan_code(a.workspace_id))[0] == "pro"

    gone = subscription_event(a.workspace_id, "customer.subscription.deleted", status="canceled")
    r = await c.post(WEBHOOK, content=gone, headers={"stripe-signature": sign(gone)})
    assert r.status_code == 200, r.text
    code, sub = await _plan_code(a.workspace_id)
    assert code == "free"
    assert sub.status == "active" and sub.stripe_subscription_id is None and sub.mrr_cents == 0
    r = await a.client.post("/api/v1/leads", json={"business_name": "No longer paid"})
    assert r.status_code == 402


async def test_webhook_matches_plan_by_stripe_price_id(new_client, account_factory):
    a = await account_factory()
    async with session_scope() as db:
        biz = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == "business"))
        biz.stripe_price_id_monthly = "price_business_monthly"
    payload = subscription_event(a.workspace_id, plan_code="starter", price_id="price_business_monthly")
    r = await new_client().post(WEBHOOK, content=payload, headers={"stripe-signature": sign(payload)})
    assert r.status_code == 200
    assert (await _plan_code(a.workspace_id))[0] == "business"  # price id wins over metadata


async def test_webhook_is_csrf_exempt_even_with_cookies(account_factory):
    a = await account_factory()
    a.client.csrf_enabled = False
    payload = subscription_event(a.workspace_id)
    r = await a.client.post(WEBHOOK, content=payload, headers={"stripe-signature": sign(payload)})
    assert r.status_code == 200
