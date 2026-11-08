"""Create the first super-admin from environment variables.

    ADMIN_BOOTSTRAP_EMAIL=you@company.com ADMIN_BOOTSTRAP_SECRET=... python -m app.scripts.bootstrap_admin

The password is read from ADMIN_BOOTSTRAP_PASSWORD or prompted interactively (never echoed, never logged).
Refuses to run if any admin already exists unless --force-additional is passed (then it creates another super-admin).
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import os
import sys

from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import session_scope
from app.core.security import hash_password, password_strength_errors
from app.models import AdminUser
from app.services.activity import audit


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force-additional", action="store_true")
    args = parser.parse_args()
    email = settings.admin_bootstrap_email.strip().lower()
    if not email or not settings.admin_bootstrap_secret:
        print("Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_SECRET first.", file=sys.stderr)
        return 1
    password = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD") or getpass.getpass("New super-admin password (min 12 chars): ")
    if len(password) < 12 or password_strength_errors(password):
        print("Password must be at least 12 characters and contain letters and numbers.", file=sys.stderr)
        return 1
    async with session_scope() as db:
        count = await db.scalar(select(func.count()).select_from(AdminUser))
        if count and not args.force_additional:
            print("An admin already exists. Use --force-additional to add another super-admin.", file=sys.stderr)
            return 1
        if await db.scalar(select(AdminUser.id).where(AdminUser.email == email)):
            print(f"Admin {email} already exists.", file=sys.stderr)
            return 1
        admin = AdminUser(email=email, full_name="Super Admin", password_hash=hash_password(password), role="super_admin")
        db.add(admin)
        await db.flush()
        await audit(db, admin_id=admin.id, admin_email=email, action="admin.bootstrap_cli")
    print(f"Super-admin {email} created. Sign in at {settings.app_url}/admin/login and enable MFA.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
