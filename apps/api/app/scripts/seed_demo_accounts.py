"""Create (or update) shareable demo accounts that share one fully analyzed DEMO workspace.

    DEMO_ACCOUNTS="owner@example.com|Passw0rd...|owner;analyst@example.com|...|analyst;viewer@example.com|...|viewer" \
        python -m app.scripts.seed_demo_accounts

- The first entry must have role ``owner``; it owns the DEMO workspace (synthetic sample data, labelled DEMO).
- Other entries join that workspace with their role (admin | analyst | viewer).
- The workspace is put on the Business plan so every feature can be explored.
- Idempotent: re-running keeps data, re-applies passwords/roles. Passwords come only from the environment.
"""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import select

from app.core.database import session_scope
from app.core.security import hash_password, password_strength_errors, utcnow
from app.models import Subscription, SubscriptionPlan, User, UserProfile, WorkspaceMember
from app.services.auth_service import default_notification_prefs, normalize_email
from app.services.demo_service import create_demo_workspace
from app.services.seed_reference import seed_reference_data

ROLES = {"owner", "admin", "analyst", "viewer"}
NAMES = {"owner": "Demo Owner", "admin": "Demo Admin", "analyst": "Demo Analyst", "viewer": "Demo Viewer"}


def parse(raw: str) -> list[tuple[str, str, str]]:
    accounts = []
    for chunk in filter(None, (c.strip() for c in raw.split(";"))):
        email, password, role = (p.strip() for p in chunk.split("|"))
        if role not in ROLES:
            raise ValueError(f"Unknown role '{role}' for {email}")
        if password_strength_errors(password):
            raise ValueError(f"Password for {email} is too weak (min 10 chars, letters and numbers)")
        accounts.append((normalize_email(email), password, role))
    if not accounts or accounts[0][2] != "owner":
        raise ValueError("The first DEMO_ACCOUNTS entry must be the owner")
    return accounts


async def upsert_user(db, email: str, password: str, full_name: str) -> User:
    user = await db.scalar(select(User).where(User.email == email, User.deleted_at.is_(None)))
    if user is None:
        user = User(email=email)
        db.add(user)
        await db.flush()
        db.add(UserProfile(user_id=user.id, full_name=full_name, company_name="CustomerSignal Demo",
                           terms_accepted_at=utcnow(), onboarding_step=7, onboarding_completed_at=utcnow(),
                           notification_preferences=default_notification_prefs()))
        await db.flush()
        await db.refresh(user, ["profile"])
    user.password_hash = hash_password(password)
    user.email_verified_at = user.email_verified_at or utcnow()
    user.status = "active"
    if user.profile and not user.profile.onboarding_completed_at:
        user.profile.onboarding_completed_at = utcnow()
    return user


async def main() -> int:
    raw = os.environ.get("DEMO_ACCOUNTS", "")
    if not raw:
        print("DEMO_ACCOUNTS not set; nothing to do.")
        return 0
    accounts = parse(raw)
    async with session_scope() as db:
        await seed_reference_data(db)
        owner_email, owner_pw, _ = accounts[0]
        owner = await upsert_user(db, owner_email, owner_pw, NAMES["owner"])
        ws = await create_demo_workspace(db, owner)
        owner.default_workspace_id = ws.id

        business = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == "business"))
        sub = await db.scalar(select(Subscription).where(Subscription.workspace_id == ws.id))
        if business and sub:
            sub.plan_id, sub.status = business.id, "active"

        for email, password, role in accounts[1:]:
            user = await upsert_user(db, email, password, NAMES[role])
            member = await db.scalar(select(WorkspaceMember).where(WorkspaceMember.workspace_id == ws.id,
                                                                   WorkspaceMember.user_id == user.id))
            if member is None:
                db.add(WorkspaceMember(workspace_id=ws.id, user_id=user.id, role=role))
            else:
                member.role = role
            user.default_workspace_id = ws.id
        print(f"Demo accounts ready: {', '.join(f'{e} ({r})' for e, _, r in accounts)} → workspace {ws.name}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except ValueError as exc:
        print(f"DEMO_ACCOUNTS invalid: {exc}", file=sys.stderr)
        sys.exit(1)
