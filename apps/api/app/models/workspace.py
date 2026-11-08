from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDelete, Timestamps, UUIDPk

WORKSPACE_ROLES = ("owner", "admin", "analyst", "viewer")


class Workspace(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    business_type: Mapped[str | None] = mapped_column(String(64))
    industry: Mapped[str | None] = mapped_column(String(120))
    country: Mapped[str | None] = mapped_column(String(80))
    city: Mapped[str | None] = mapped_column(String(120))
    website: Mapped[str | None] = mapped_column(String(500))
    company_size: Mapped[str | None] = mapped_column(String(40))
    goals: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    preferred_sources: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    branding: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # logo_url, primary_color
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # active | suspended
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False, index=True)
    status_reason: Mapped[str | None] = mapped_column(Text)
    data_retention_days: Mapped[int | None] = mapped_column()


class WorkspaceMember(UUIDPk, Timestamps, Base):
    __tablename__ = "workspace_members"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="viewer")
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_members_ws_user"),)


class WorkspaceInvitation(UUIDPk, Timestamps, Base):
    __tablename__ = "workspace_invitations"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    # pending | accepted | revoked | expired
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    invited_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("uq_invite_pending_email", "workspace_id", "email", unique=True,
              postgresql_where="status = 'pending'"),
    )


class ActivityLog(UUIDPk, Timestamps, Base):
    """Workspace-scoped activity feed (project history, member activity)."""

    __tablename__ = "activity_logs"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    summary: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    meta: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)


class ApiKey(UUIDPk, Timestamps, Base):
    """Workspace API keys for the inbound Reviews API integration."""

    __tablename__ = "api_keys"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
