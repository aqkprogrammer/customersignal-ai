"""Fan-out of in-app + email notifications respecting each member's preferences."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import User, UserProfile, WorkspaceMember
from app.services import email_service
from app.services.activity import notify
from app.services.workspace_service import ROLE_RANK


async def notify_workspace(db: AsyncSession, workspace_id: uuid.UUID, notification_type: str, title: str,
                           body: str = "", link: str | None = None, *, email_template: str | None = None,
                           email_vars: dict | None = None, min_role: str = "viewer") -> int:
    rows = (await db.execute(
        select(User, WorkspaceMember.role, UserProfile.notification_preferences)
        .join(WorkspaceMember, WorkspaceMember.user_id == User.id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(WorkspaceMember.workspace_id == workspace_id, User.deleted_at.is_(None), User.status == "active")
    )).all()
    sent = 0
    for user, role, prefs in rows:
        if ROLE_RANK.get(role, 0) < ROLE_RANK[min_role]:
            continue
        pref = (prefs or {}).get(notification_type, {"in_app": True, "email": False})
        if pref.get("in_app", True):
            await notify(db, user.id, workspace_id, notification_type, title, body, link)
            sent += 1
        if email_template and pref.get("email", False):
            vars_ = {"title": title, "message": body, "link": f"{settings.app_url}{link or '/app'}", **(email_vars or {})}
            await email_service.send_template(db, user.email, email_template, vars_)
    return sent
