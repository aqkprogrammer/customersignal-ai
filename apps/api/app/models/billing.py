from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPk

SUBSCRIPTION_STATUSES = ("trialing", "active", "past_due", "canceled", "incomplete", "unpaid")


class SubscriptionPlan(UUIDPk, Timestamps, Base):
    """Plan catalog. Prices and limits are editable from the admin panel; limits are enforced server-side."""

    __tablename__ = "subscription_plans"

    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)  # free|starter|pro|business|enterprise
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    price_monthly_cents: Mapped[int | None] = mapped_column(Integer)  # None = custom pricing
    currency: Mapped[str] = mapped_column(String(3), default="usd", nullable=False)
    stripe_price_id_monthly: Mapped[str | None] = mapped_column(String(120))
    stripe_product_id: Mapped[str | None] = mapped_column(String(120))
    # Limits; NULL means unlimited / custom.
    max_workspaces: Mapped[int | None] = mapped_column(Integer)
    max_projects: Mapped[int | None] = mapped_column(Integer)
    max_reviews_per_month: Mapped[int | None] = mapped_column(Integer)
    max_reports_per_month: Mapped[int | None] = mapped_column(Integer)
    max_members: Mapped[int | None] = mapped_column(Integer)
    features: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)  # entitlement keys
    marketing_features: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    trial_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    highlighted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Subscription(UUIDPk, Timestamps, Base):
    __tablename__ = "subscriptions"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscription_plans.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False, index=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(120), index=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(120), unique=True)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Admin-applied overrides, e.g. {"max_reviews_per_month": 5000}; audit-logged.
    limit_overrides: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    mrr_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Invoice(UUIDPk, Timestamps, Base):
    __tablename__ = "invoices"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stripe_invoice_id: Mapped[str | None] = mapped_column(String(120), unique=True)
    number: Mapped[str | None] = mapped_column(String(80))
    amount_due_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    amount_paid_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="usd", nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # draft|open|paid|void|uncollectible
    hosted_invoice_url: Mapped[str | None] = mapped_column(String(1000))
    invoice_pdf_url: Mapped[str | None] = mapped_column(String(1000))
    plan_code: Mapped[str | None] = mapped_column(String(40))
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Payment(UUIDPk, Timestamps, Base):
    __tablename__ = "payments"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="SET NULL"))
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(120), unique=True)
    stripe_charge_id: Mapped[str | None] = mapped_column(String(120))
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    refunded_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="usd", nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # succeeded|failed|refunded|partially_refunded
    failure_reason: Mapped[str | None] = mapped_column(Text)
    plan_code: Mapped[str | None] = mapped_column(String(40))


class UsageRecord(UUIDPk, Timestamps, Base):
    """Metered usage. Aggregated per workspace per billing month (period = 'YYYY-MM')."""

    __tablename__ = "usage_records"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    metric: Mapped[str] = mapped_column(String(40), nullable=False)  # reviews_analyzed|reports_generated|ai_tokens
    quantity: Mapped[int] = mapped_column(BigInteger, nullable=False)
    period: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))


class StripeEvent(Base):
    """Processed webhook events, for idempotency."""

    __tablename__ = "stripe_events"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload_summary: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

