"""Idempotent reference data: plans, system review categories, email templates, feature flags, settings."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EmailTemplate, FeatureFlag, ReviewCategory, SubscriptionPlan, SystemSetting
from app.services.email_defaults import DEFAULT_TEMPLATES
from app.services.plans import DEFAULT_PLANS
from app.services.settings_service import DEFAULT_SETTINGS

SYSTEM_CATEGORIES: list[dict] = [
    {"slug": "pricing", "name": "Pricing", "keywords": ["price", "expensive", "overpriced", "cost", "pricey", "fee",
                                                         "charge", "value for money", "cheap", "bill", "hidden"]},
    {"slug": "customer_service", "name": "Customer service",
     "keywords": ["service", "support", "help", "rude", "manager", "complaint", "refund", "respond", "ignored"]},
    {"slug": "waiting_time", "name": "Waiting time",
     "keywords": ["wait", "waiting", "waited", "slow", "late", "delay", "queue", "hour", "forever", "minutes"]},
    {"slug": "product_quality", "name": "Product quality",
     "keywords": ["quality", "broke", "broken", "defect", "cheap", "taste", "cold", "stale", "fake", "durable",
                  "material", "flimsy", "fresh"]},
    {"slug": "delivery", "name": "Delivery", "keywords": ["delivery", "shipping", "arrived", "package", "courier",
                                                          "shipped", "tracking", "damaged"]},
    {"slug": "appointment_management", "name": "Appointment management",
     "keywords": ["appointment", "booking", "book", "reschedule", "cancelled", "slot", "reservation", "schedule"]},
    {"slug": "staff_behavior", "name": "Staff behavior",
     "keywords": ["staff", "rude", "friendly", "attitude", "unprofessional", "waiter", "receptionist", "doctor",
                  "therapist", "employee"]},
    {"slug": "usability", "name": "Usability", "keywords": ["app", "website", "confusing", "easy to use", "interface",
                                                            "setup", "instructions", "difficult"]},
    {"slug": "communication", "name": "Communication",
     "keywords": ["call", "email", "message", "reply", "communication", "informed", "update", "whatsapp",
                  "answer", "callback"]},
    {"slug": "reliability", "name": "Reliability", "keywords": ["reliable", "inconsistent", "stopped working",
                                                                "battery", "crash", "failed", "unreliable"]},
    {"slug": "cleanliness", "name": "Cleanliness", "keywords": ["clean", "dirty", "hygiene", "smell", "messy"]},
    {"slug": "other", "name": "Other", "keywords": []},
]


async def seed_reference_data(db: AsyncSession) -> None:
    existing_plans = {p.code for p in (await db.scalars(select(SubscriptionPlan))).all()}
    for plan in DEFAULT_PLANS:
        if plan["code"] not in existing_plans:
            db.add(SubscriptionPlan(**plan))

    existing_cats = {
        c.slug for c in (await db.scalars(select(ReviewCategory).where(ReviewCategory.workspace_id.is_(None)))).all()
    }
    for cat in SYSTEM_CATEGORIES:
        if cat["slug"] not in existing_cats:
            db.add(ReviewCategory(workspace_id=None, is_custom=False, **cat))

    existing_tpl = {t.key for t in (await db.scalars(select(EmailTemplate))).all()}
    for tpl in DEFAULT_TEMPLATES:
        if tpl["key"] not in existing_tpl:
            db.add(EmailTemplate(**tpl))

    existing_flags = {f.key for f in (await db.scalars(select(FeatureFlag))).all()}
    for key, desc, enabled in [
        ("opportunity_finder", "1-Star Review Cold Pitch workflow", True),
        ("gap_finder", "Amazon 3-Star Gap Finder", True),
        ("hubspot_integration", "HubSpot CRM lead sync", True),
        ("product_tour", "Interactive product tour for new users", True),
        ("beta_semantic_search", "Semantic review search (pgvector)", True),
    ]:
        if key not in existing_flags:
            db.add(FeatureFlag(key=key, description=desc, enabled=enabled))

    existing_settings = {s.key for s in (await db.scalars(select(SystemSetting))).all()}
    for key, value in DEFAULT_SETTINGS.items():
        if key not in existing_settings:
            db.add(SystemSetting(key=key, value=value))
    await db.flush()
