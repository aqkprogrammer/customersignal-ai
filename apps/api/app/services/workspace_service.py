from __future__ import annotations

import re
import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Subscription, User, Workspace, WorkspaceMember
from app.services.entitlements import get_free_plan

ROLE_RANK = {"viewer": 0, "analyst": 1, "admin": 2, "owner": 3}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:60] or "workspace"


async def unique_slug(db: AsyncSession, name: str) -> str:
    base = slugify(name)
    slug = base
    while await db.scalar(select(Workspace.id).where(Workspace.slug == slug)):
        slug = f"{base}-{secrets.token_hex(3)}"
    return slug


async def create_workspace(db: AsyncSession, owner: User, name: str, *, is_demo: bool = False,
                           **fields: object) -> Workspace:
    ws = Workspace(name=name.strip()[:200] or "My Workspace", slug=await unique_slug(db, name), owner_id=owner.id,
                   is_demo=is_demo, **fields)
    db.add(ws)
    await db.flush()
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=owner.id, role="owner"))
    free = await get_free_plan(db)
    db.add(Subscription(workspace_id=ws.id, plan_id=free.id, status="active"))
    if owner.default_workspace_id is None and not is_demo:
        owner.default_workspace_id = ws.id
    await db.flush()
    return ws


async def user_workspaces(db: AsyncSession, user_id: uuid.UUID) -> list[tuple[Workspace, str]]:
    rows = await db.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user_id, Workspace.deleted_at.is_(None))
        .order_by(Workspace.is_demo, Workspace.created_at)
    )
    return [(ws, role) for ws, role in rows.all()]
