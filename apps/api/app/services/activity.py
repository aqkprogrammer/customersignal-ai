from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActivityLog, AdminAuditLog, Notification


async def log_activity(db: AsyncSession, workspace_id: uuid.UUID, actor_id: uuid.UUID | None, action: str,
                       entity_type: str, entity_id: uuid.UUID | None, summary: str, **meta: object) -> None:
    db.add(ActivityLog(workspace_id=workspace_id, actor_id=actor_id, action=action, entity_type=entity_type,
                       entity_id=entity_id, summary=summary[:500], meta=meta))


async def audit(db: AsyncSession, *, admin_id: uuid.UUID | None, admin_email: str | None, action: str,
                target_type: str | None = None, target_id: object = None, ip: str | None = None,
                user_agent: str | None = None, **meta: object) -> None:
    db.add(AdminAuditLog(admin_id=admin_id, admin_email=admin_email, action=action, target_type=target_type,
                         target_id=str(target_id) if target_id is not None else None, ip_address=ip,
                         user_agent=(user_agent or "")[:500] or None, meta=meta))
    await db.flush()


async def notify(db: AsyncSession, user_id: uuid.UUID, workspace_id: uuid.UUID | None, notification_type: str,
                 title: str, body: str = "", link: str | None = None) -> Notification:
    n = Notification(user_id=user_id, workspace_id=workspace_id, notification_type=notification_type,
                     title=title[:300], body=body, link=link)
    db.add(n)
    await db.flush()
    return n
