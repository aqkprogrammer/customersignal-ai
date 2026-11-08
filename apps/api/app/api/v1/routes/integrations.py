from __future__ import annotations

import secrets
import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import WorkspaceContext, get_workspace_context, require_role
from app.api.v1.serializers import iso
from app.core.database import get_db
from app.core.errors import AppError, NotFound
from app.core.security import generate_token, hash_token, utcnow
from app.models import ApiKey, Integration, IntegrationSyncLog
from app.services import settings_service
from app.services.activity import log_activity
from app.services.integrations_service import (
    CATALOG,
    catalog_entry,
    deliver_webhook_event,
    log_sync,
    set_credentials,
    test_hubspot,
)

router = APIRouter(prefix="/integrations", tags=["integrations"])


class ConnectIn(BaseModel):
    config: dict[str, Any] = Field(default_factory=dict)


async def _disabled(db: AsyncSession) -> set[str]:
    return set(await settings_service.get(db, "disabled_integrations") or [])


@router.get("")
async def marketplace(ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = {i.provider: i for i in (await db.scalars(select(Integration).where(Integration.workspace_id == ctx.workspace_id))).all()}
    disabled = await _disabled(db)
    out = []
    for entry in CATALOG:
        integ = rows.get(entry["provider"])
        status = "connected" if entry["availability"] == "builtin" else (integ.status if integ else "disconnected")
        if entry["availability"] == "requires_approval" and status != "connected":
            status = "requires_approval"
        out.append({**{k: v for k, v in entry.items()}, "status": status,
                    "enabled": entry["provider"] not in disabled,
                    "id": str(integ.id) if integ else None,
                    "config": {k: v for k, v in (integ.config if integ else {}).items() if k != "secret"},
                    "last_sync_at": iso(integ.last_sync_at) if integ else None,
                    "last_error": integ.last_error if integ else None,
                    "connected_at": iso(integ.connected_at) if integ else None})
    return out


@router.post("/{provider}/connect")
async def connect(provider: str, body: ConnectIn, ctx: WorkspaceContext = Depends(require_role("admin")),
                  db: AsyncSession = Depends(get_db)) -> dict:
    entry = catalog_entry(provider)
    if provider in await _disabled(db):
        raise AppError("This integration is disabled by the platform administrator.", code="integration_disabled")
    if entry["availability"] == "builtin":
        raise AppError("This integration is always available — no connection needed.")
    if entry["availability"] == "requires_approval":
        raise AppError("This integration requires platform API approval and isn't available yet. Use CSV upload "
                       "in the meantime.", code="requires_approval")
    integ = await db.scalar(select(Integration).where(Integration.workspace_id == ctx.workspace_id,
                                                      Integration.provider == provider))
    if not integ:
        integ = Integration(workspace_id=ctx.workspace_id, provider=provider)
        db.add(integ)
        await db.flush()
    result: dict[str, Any] = {}
    if provider == "hubspot":
        token = str(body.config.get("access_token") or "").strip()
        if not token:
            raise AppError("Enter your HubSpot private app token.", code="validation_error")
        await test_hubspot(token)
        set_credentials(integ, {"access_token": token})
        integ.config = {"token_hint": f"…{token[-4:]}"}
    elif provider == "webhooks":
        url = str(body.config.get("url") or "").strip()
        if not url.startswith("https://") and not url.startswith("http://localhost"):
            raise AppError("Webhook URL must use HTTPS.", code="validation_error")
        secret = "whsec_" + secrets.token_urlsafe(24)
        set_credentials(integ, {"signing_secret": secret})
        events = body.config.get("events") or catalog_entry("webhooks")["capabilities"]
        integ.config = {"url": url[:500], "events": [e for e in events if e in catalog_entry("webhooks")["capabilities"]]}
        result["signing_secret"] = secret  # shown once
    elif provider == "reviews_api":
        raw = "csk_" + generate_token(30)
        key = ApiKey(workspace_id=ctx.workspace_id, name=str(body.config.get("key_name") or "Reviews API key")[:120],
                     prefix=raw[:10], key_hash=hash_token(raw), created_by_id=ctx.user.id)
        db.add(key)
        integ.config = {"keys": int(integ.config.get("keys", 0)) + 1}
        result["api_key"] = raw  # shown once
    integ.status = "connected"
    integ.connected_at = utcnow()
    integ.connected_by_id = ctx.user.id
    integ.last_error = None
    await log_sync(db, integ, "connect", "success", f"Connected {entry['name']}")
    await log_activity(db, ctx.workspace_id, ctx.user.id, "integration.connected", "integration", integ.id, entry["name"])
    return {"status": "connected", **result}


@router.post("/{provider}/disconnect")
async def disconnect(provider: str, ctx: WorkspaceContext = Depends(require_role("admin")),
                     db: AsyncSession = Depends(get_db)) -> dict:
    entry = catalog_entry(provider)
    integ = await db.scalar(select(Integration).where(Integration.workspace_id == ctx.workspace_id,
                                                      Integration.provider == provider))
    if not integ:
        raise NotFound("Integration is not connected.")
    integ.status = "disconnected"
    integ.credentials_encrypted = None
    if provider == "reviews_api":
        for k in (await db.scalars(select(ApiKey).where(ApiKey.workspace_id == ctx.workspace_id,
                                                        ApiKey.revoked_at.is_(None)))).all():
            k.revoked_at = utcnow()
    await log_sync(db, integ, "disconnect", "success", f"Disconnected {entry['name']}")
    return {"status": "disconnected"}


@router.post("/{provider}/test")
async def test(provider: str, ctx: WorkspaceContext = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)) -> dict:
    integ = await db.scalar(select(Integration).where(Integration.workspace_id == ctx.workspace_id,
                                                      Integration.provider == provider, Integration.status == "connected"))
    if not integ:
        raise NotFound("Integration is not connected.")
    if provider == "webhooks":
        await deliver_webhook_event(db, ctx.workspace_id, "analysis.completed", {"test": True})
    elif provider == "hubspot":
        from app.services.integrations_service import get_credentials

        await test_hubspot(get_credentials(integ).get("access_token", ""))
        await log_sync(db, integ, "test", "success", "Connection OK")
    await db.refresh(integ)
    return {"ok": integ.last_error is None, "last_error": integ.last_error}


@router.get("/{provider}/logs")
async def logs(provider: str, ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db)) -> list[dict]:
    integ = await db.scalar(select(Integration).where(Integration.workspace_id == ctx.workspace_id,
                                                      Integration.provider == provider))
    if not integ:
        return []
    rows = (await db.scalars(select(IntegrationSyncLog).where(IntegrationSyncLog.integration_id == integ.id)
                             .order_by(IntegrationSyncLog.created_at.desc()).limit(50))).all()
    return [{"id": str(r.id), "action": r.action, "status": r.status, "message": r.message,
             "items_processed": r.items_processed, "created_at": iso(r.created_at)} for r in rows]


@router.get("/api-keys/list")
async def api_keys(ctx: WorkspaceContext = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.scalars(select(ApiKey).where(ApiKey.workspace_id == ctx.workspace_id).order_by(ApiKey.created_at.desc()))).all()
    return [{"id": str(k.id), "name": k.name, "prefix": k.prefix, "last_used_at": iso(k.last_used_at),
             "revoked": k.revoked_at is not None, "created_at": iso(k.created_at)} for k in rows]


@router.delete("/api-keys/{key_id}")
async def revoke_key(key_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("admin")),
                     db: AsyncSession = Depends(get_db)) -> dict:
    k = await db.get(ApiKey, key_id)
    if not k or k.workspace_id != ctx.workspace_id:
        raise NotFound("API key not found.")
    k.revoked_at = utcnow()
    return {"message": "API key revoked."}
