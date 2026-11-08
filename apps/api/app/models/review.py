from __future__ import annotations

import uuid
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDelete, Timestamps, UUIDPk

EMBEDDING_DIM = 512


class ReviewSource(UUIDPk, Timestamps, Base):
    """An import batch / origin of reviews: an uploaded file, manual entry, API or integration sync."""

    __tablename__ = "review_sources"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # csv | excel | manual | api | integration | demo
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    platform: Mapped[str | None] = mapped_column(String(80))  # e.g. "Google", "Amazon" as stated by the uploader
    file_key: Mapped[str | None] = mapped_column(String(500))
    integration_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("integrations.id", ondelete="SET NULL")
    )
    rows_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_imported: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_duplicate: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_invalid: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    errors: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    # pending | processing | completed | failed
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Review(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "reviews"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    business_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="SET NULL"), index=True
    )
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("review_sources.id", ondelete="SET NULL"), index=True
    )
    external_id: Mapped[str | None] = mapped_column(String(200))
    platform: Mapped[str | None] = mapped_column(String(80))
    product_name: Mapped[str | None] = mapped_column(String(300))
    reviewer_name: Mapped[str | None] = mapped_column(String(200))
    rating: Mapped[float | None] = mapped_column(Float)
    title: Mapped[str | None] = mapped_column(String(500))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    review_date: Mapped[date | None] = mapped_column(Date, index=True)
    location: Mapped[str | None] = mapped_column(String(200))
    verified: Mapped[bool | None] = mapped_column(Boolean)
    language: Mapped[str | None] = mapped_column(String(12))
    translated_text: Mapped[str | None] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    # pending | analyzed | failed
    analysis_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    sentiment: Mapped[ReviewSentiment | None] = relationship(uselist=False, lazy="selectin", viewonly=True)
    topics: Mapped[list[ReviewTopic]] = relationship(lazy="selectin", viewonly=True)

    __table_args__ = (
        UniqueConstraint("project_id", "content_hash", name="uq_reviews_project_hash"),
        Index("ix_reviews_project_date", "project_id", "review_date"),
    )


class ReviewSentiment(UUIDPk, Timestamps, Base):
    __tablename__ = "review_sentiments"

    review_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reviews.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sentiment: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # positive|neutral|negative
    score: Mapped[float] = mapped_column(Float, nullable=False)  # -1..1
    emotion: Mapped[str | None] = mapped_column(String(30))
    confidence: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text)
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    model: Mapped[str | None] = mapped_column(String(80))
    prompt_version: Mapped[str | None] = mapped_column(String(20))


class ReviewCategory(UUIDPk, Timestamps, Base):
    """Category catalog. workspace_id NULL = built-in system category; otherwise a custom category."""

    __tablename__ = "review_categories"

    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    slug: Mapped[str] = mapped_column(String(60), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    keywords: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (UniqueConstraint("workspace_id", "slug", name="uq_review_categories_ws_slug"),)


class ReviewTopic(UUIDPk, Timestamps, Base):
    """An extracted signal from a review: complaint, praise, feature request or neutral topic."""

    __tablename__ = "review_topics"

    review_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # complaint|praise|feature_request|topic
    category_slug: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(300), nullable=False)
    excerpt: Mapped[str | None] = mapped_column(Text)  # verbatim substring of the review text
    severity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)  # 1..5
    cluster_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("complaint_clusters.id", ondelete="SET NULL"), index=True
    )
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))


class ComplaintCluster(UUIDPk, Timestamps, Base):
    __tablename__ = "complaint_clusters"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    business_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20), default="complaint", nullable=False)  # complaint|praise|feature_request
    category_slug: Mapped[str] = mapped_column(String(60), nullable=False)
    label: Mapped[str] = mapped_column(String(300), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_rating: Mapped[float | None] = mapped_column(Float)
    severity_score: Mapped[float] = mapped_column(Float, default=0, nullable=False)  # 0..100
    trend: Mapped[str] = mapped_column(String(20), default="stable", nullable=False)  # rising|stable|declining|new
    recent_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    previous_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    first_seen: Mapped[date | None] = mapped_column(Date)
    last_seen: Mapped[date | None] = mapped_column(Date)
    representative_review_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("analysis_jobs.id", ondelete="SET NULL"))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ProductOpportunity(UUIDPk, Timestamps, Base):
    __tablename__ = "product_opportunities"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    business_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="SET NULL"))
    cluster_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("complaint_clusters.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str | None] = mapped_column(Text)
    # fix_complaint | new_feature | positioning | pricing | service | competitor_gap
    opportunity_type: Mapped[str] = mapped_column(String(30), nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0, nullable=False)  # 0..100
    impact: Mapped[str] = mapped_column(String(10), default="medium", nullable=False)
    effort: Mapped[str] = mapped_column(String(10), default="medium", nullable=False)
    evidence_review_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    # new | planned | in_progress | done | dismissed
    status: Mapped[str] = mapped_column(String(20), default="new", nullable=False)
    source: Mapped[str] = mapped_column(String(30), default="analysis", nullable=False)
    provider: Mapped[str | None] = mapped_column(String(30))
    job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("analysis_jobs.id", ondelete="SET NULL"))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
