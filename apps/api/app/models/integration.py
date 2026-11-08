from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPk


class Integration(UUIDPk, Timestamps, Base):
    __tablename__ = "integrations"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    # connected | disconnected | error | pending_approval
    status: Mapped[str] = mapped_column(String(20), default="disconnected", nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # non-secret settings only
    credentials_encrypted: Mapped[str | None] = mapped_column(Text)  # Fernet-encrypted JSON
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    connected_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (UniqueConstraint("workspace_id", "provider", name="uq_integrations_ws_provider"),)


class IntegrationSyncLog(UUIDPk, Timestamps, Base):
    __tablename__ = "integration_sync_logs"

    integration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(40), nullable=False)  # connect|disconnect|sync|test|deliver
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # success|error
    message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    items_processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    details: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
