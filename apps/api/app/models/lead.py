from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDelete, Timestamps, UUIDPk

LEAD_STATUSES = ("new", "researched", "contacted", "replied", "meeting_booked", "converted", "not_interested")


class Lead(UUIDPk, Timestamps, SoftDelete, Base):
    """A prospect discovered by the 1-Star Review Cold Pitch (Opportunity Finder) workflow."""

    __tablename__ = "leads"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    business_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="SET NULL"))
    business_name: Mapped[str] = mapped_column(String(200), nullable=False)
    website: Mapped[str | None] = mapped_column(String(500))
    country: Mapped[str | None] = mapped_column(String(80))
    city: Mapped[str | None] = mapped_column(String(120))
    industry: Mapped[str | None] = mapped_column(String(120))
    competitor_names: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(200))
    contact_email: Mapped[str | None] = mapped_column(String(320))
    contact_linkedin: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="new", nullable=False, index=True)
    # Outreach pack (editable). Generated from the business's actual review dataset.
    executive_summary: Mapped[str | None] = mapped_column(Text)
    cold_email_subject: Mapped[str | None] = mapped_column(String(300))
    cold_email: Mapped[str | None] = mapped_column(Text)
    linkedin_message: Mapped[str | None] = mapped_column(Text)
    follow_up_email: Mapped[str | None] = mapped_column(Text)
    issues: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)  # ranked issues with evidence ids
    opportunities: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    analysis_result_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_analysis_results.id", ondelete="SET NULL")
    )
    report_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("reports.id", ondelete="SET NULL"))
    pitch_status: Mapped[str] = mapped_column(String(20), default="none", nullable=False)  # none|generating|ready|failed
    notes: Mapped[str | None] = mapped_column(Text)
    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class LeadActivity(UUIDPk, Timestamps, Base):
    __tablename__ = "lead_activities"

    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    activity_type: Mapped[str] = mapped_column(String(30), nullable=False)  # status_change|note|pitch_generated|edited|exported
    message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str | None] = mapped_column(String(20))
