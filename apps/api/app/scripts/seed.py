"""Seed reference data and (optionally) a demo user with a fully analyzed DEMO workspace.

    python -m app.scripts.seed            # reference data only (plans, categories, templates, flags, settings)
    python -m app.scripts.seed --demo     # + demo@customersignal.local with DEMO workspace

Demo user password: DEMO_USER_PASSWORD env var, or a random one printed once.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import secrets

from sqlalchemy import select

from app.core.database import session_scope
from app.core.security import hash_password, utcnow
from app.models import User, UserProfile
from app.services.auth_service import default_notification_prefs
from app.services.demo_service import create_demo_workspace
from app.services.seed_reference import seed_reference_data
from app.services.workspace_service import create_workspace

DEMO_EMAIL = "demo@customersignal.local"


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true")
    args = parser.parse_args()
    async with session_scope() as db:
        await seed_reference_data(db)
        print("Reference data seeded.")
        if not args.demo:
            return
        user = await db.scalar(select(User).where(User.email == DEMO_EMAIL))
        password = os.environ.get("DEMO_USER_PASSWORD") or secrets.token_urlsafe(10) + "7a"
        if not user:
            user = User(email=DEMO_EMAIL, password_hash=hash_password(password), email_verified_at=utcnow())
            db.add(user)
            await db.flush()
            db.add(UserProfile(user_id=user.id, full_name="Demo User", company_name="Demo Co", terms_accepted_at=utcnow(),
                               onboarding_completed_at=utcnow(), onboarding_step=7,
                               notification_preferences=default_notification_prefs()))
            await db.flush()
            await db.refresh(user, ["profile"])
            await create_workspace(db, user, "Demo Co")
            print(f"Demo user created: {DEMO_EMAIL} / {password}")
        else:
            print(f"Demo user exists: {DEMO_EMAIL} (password unchanged)")
        ws = await create_demo_workspace(db, user)
        print(f"Demo workspace ready: {ws.name} ({ws.id})")


if __name__ == "__main__":
    asyncio.run(main())
