"""Review Intelligence: list/search/filter, detail with AI explanation, manual entry, file import, export."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import Select, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embeddings import local_embedding
from app.ai.registry import get_embedding_provider
from app.api.deps import WorkspaceContext, get_workspace_context, require_role
from app.api.v1.routes.projects import get_project
from app.api.v1.serializers import iso, job_out, review_out
from app.core.database import get_db
from app.core.errors import AppError, NotFound
from app.core.rate_limit import hit
from app.core.security import utcnow
from app.core.storage import storage
from app.models import Business, ComplaintCluster, Review, ReviewSentiment, ReviewSource, ReviewTopic
from app.schemas.common import Pagination, page
from app.services import analytics, settings_service
from app.services.activity import log_activity
from app.services.analysis_service import project_stats
from app.services.ingestion import NormalizedReview, insert_reviews, normalize_text
from app.workers.jobs import create_job, enqueue

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ManualReviewIn(BaseModel):
    project_id: uuid.UUID
    business_id: uuid.UUID | None = None
    text: str = Field(min_length=3, max_length=10000)
    rating: float | None = Field(default=None, ge=0, le=5)
    review_date: date | None = None
    reviewer_name: str | None = Field(default=None, max_length=200)
    platform: str | None = Field(default=None, max_length=80)
    product_name: str | None = Field(default=None, max_length=300)
    location: str | None = Field(default=None, max_length=200)
    verified: bool | None = None
    analyze: bool = True


def _filtered(ctx: WorkspaceContext, project_id: uuid.UUID | None, business_id: uuid.UUID | None,
              sentiment: str | None, category: str | None, rating: int | None, platform: str | None,
              date_from: date | None, date_to: date | None, q: str | None, cluster_id: uuid.UUID | None,
              status: str | None) -> Select:
    f = analytics.Filters(ctx.workspace_id, project_id, business_id, date_from, date_to, platform)
    stmt = f.apply(select(Review))
    if sentiment:
        stmt = stmt.join(ReviewSentiment, ReviewSentiment.review_id == Review.id).where(ReviewSentiment.sentiment == sentiment)
    if category:
        stmt = stmt.where(exists().where(ReviewTopic.review_id == Review.id, ReviewTopic.category_slug == category,
                                         ReviewTopic.kind == "complaint"))
    if cluster_id:
        stmt = stmt.where(exists().where(ReviewTopic.review_id == Review.id, ReviewTopic.cluster_id == cluster_id))
    if rating:
        stmt = stmt.where(func.round(Review.rating) == rating)
    if status:
        stmt = stmt.where(Review.analysis_status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Review.text.ilike(like), Review.reviewer_name.ilike(like), Review.translated_text.ilike(like)))
    return stmt


@router.get("")
async def list_reviews(
    project_id: uuid.UUID | None = None, business_id: uuid.UUID | None = None,
    sentiment: Literal["positive", "neutral", "negative"] | None = None, category: str | None = None,
    rating: int | None = Query(None, ge=1, le=5), platform: str | None = None, date_from: date | None = None,
    date_to: date | None = None, q: str | None = None, cluster_id: uuid.UUID | None = None,
    status: Literal["pending", "analyzed", "failed"] | None = None,
    sort: Literal["date_desc", "date_asc", "rating_asc", "rating_desc", "created_desc"] = "date_desc",
    p: Pagination = Depends(), ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = _filtered(ctx, project_id, business_id, sentiment, category, rating, platform, date_from, date_to, q,
                     cluster_id, status)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    order = {"date_desc": Review.review_date.desc().nullslast(), "date_asc": Review.review_date.asc().nullsfirst(),
             "rating_asc": Review.rating.asc().nullslast(), "rating_desc": Review.rating.desc().nullslast(),
             "created_desc": Review.created_at.desc()}[sort]
    rows = (await db.scalars(stmt.order_by(order, Review.id).offset(p.offset).limit(p.page_size))).all()
    return page([review_out(r) for r in rows], int(total or 0), p)


@router.get("/semantic-search")
async def semantic_search(q: str = Query(min_length=3, max_length=500), project_id: uuid.UUID | None = None,
                          limit: int = Query(20, ge=1, le=50), ctx: WorkspaceContext = Depends(get_workspace_context),
                          db: AsyncSession = Depends(get_db)) -> list[dict]:
    """pgvector cosine search over review embeddings (same embedding method as the analysis pipeline)."""
    emb = get_embedding_provider()
    vec = None
    if emb:
        res = await emb.embed([q])
        vec = res[0][0] if res else None
    vec = vec or local_embedding(q)
    distance = Review.embedding.cosine_distance(vec)
    stmt = analytics.Filters(ctx.workspace_id, project_id).apply(select(Review, distance.label("d"))) \
        .where(Review.embedding.is_not(None)).order_by(distance).limit(limit)
    rows = (await db.execute(stmt)).all()
    return [{**review_out(r), "similarity": round(1 - float(d), 3)} for r, d in rows]


@router.get("/analytics")
async def review_analytics(
    project_id: uuid.UUID | None = None, business_id: uuid.UUID | None = None, date_from: date | None = None,
    date_to: date | None = None, platform: str | None = None,
    ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db),
) -> dict:
    f = analytics.Filters(ctx.workspace_id, project_id, business_id, date_from, date_to, platform)
    platforms = (await db.scalars(f.apply(select(Review.platform).distinct()).where(Review.platform.is_not(None)))).all()
    return {
        "kpis": await analytics.kpis(db, f), "over_time": await analytics.volume_over_time(db, f),
        "rating_distribution": await analytics.rating_distribution(db, f),
        "complaints": await analytics.category_breakdown(db, f, "complaint"),
        "praise": await analytics.category_breakdown(db, f, "praise"),
        "emotions": await analytics.emotion_breakdown(db, f), "keywords": await analytics.top_keywords(db, f, 25),
        "complaint_clusters": await analytics.clusters(db, f, "complaint", 20, "severity"),
        "praise_clusters": await analytics.clusters(db, f, "praise", 10, "count"),
        "feature_requests": await analytics.clusters(db, f, "feature_request", 10, "count"),
        "trending": await analytics.clusters(db, f, "complaint", 8, "trending"),
        "platforms": sorted(platforms),
    }


@router.get("/export")
async def export_reviews(
    project_id: uuid.UUID | None = None, business_id: uuid.UUID | None = None,
    sentiment: Literal["positive", "neutral", "negative"] | None = None, category: str | None = None,
    rating: int | None = Query(None, ge=1, le=5), platform: str | None = None, date_from: date | None = None,
    date_to: date | None = None, q: str | None = None, cluster_id: uuid.UUID | None = None,
    ctx: WorkspaceContext = Depends(get_workspace_context), db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    stmt = _filtered(ctx, project_id, business_id, sentiment, category, rating, platform, date_from, date_to, q,
                     cluster_id, None)
    rows = (await db.scalars(stmt.order_by(Review.review_date.desc().nullslast()).limit(100_000))).all()
    biz = {b.id: b.name for b in (await db.scalars(select(Business).where(Business.workspace_id == ctx.workspace_id))).all()}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["review_id", "business", "platform", "rating", "review_date", "reviewer_name", "text", "language",
                "translated_text", "sentiment", "sentiment_score", "emotion", "complaint_categories", "is_demo"])
    for r in rows:
        w.writerow([r.id, biz.get(r.business_id, ""), r.platform or "", r.rating if r.rating is not None else "",
                    iso(r.review_date) or "", r.reviewer_name or "", _csv_safe(r.text), r.language or "",
                    _csv_safe(r.translated_text or ""), r.sentiment.sentiment if r.sentiment else "",
                    r.sentiment.score if r.sentiment else "", r.sentiment.emotion if r.sentiment else "",
                    ";".join(sorted({t.category_slug for t in r.topics if t.kind == "complaint"})),
                    "yes" if r.is_demo else "no"])
    await log_activity(db, ctx.workspace_id, ctx.user.id, "reviews.exported", "project", project_id,
                       f"Exported {len(rows)} reviews")
    filename = f"customersignal-reviews-{date.today().isoformat()}.csv"
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"content-disposition": f'attachment; filename="{filename}"'})


def _csv_safe(value: str) -> str:
    """Prevent CSV/formula injection when opened in spreadsheet apps."""
    return "'" + value if value[:1] in ("=", "+", "-", "@") else value


@router.get("/sources")
async def sources(project_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                  db: AsyncSession = Depends(get_db)) -> list[dict]:
    await get_project(db, ctx, project_id)
    rows = (await db.scalars(select(ReviewSource).where(ReviewSource.project_id == project_id)
                             .order_by(ReviewSource.created_at.desc()))).all()
    return [{"id": str(s.id), "name": s.name, "source_type": s.source_type, "platform": s.platform, "status": s.status,
             "rows_total": s.rows_total, "rows_imported": s.rows_imported, "rows_duplicate": s.rows_duplicate,
             "rows_invalid": s.rows_invalid, "errors": s.errors[:20], "is_demo": s.is_demo,
             "created_at": iso(s.created_at)} for s in rows]


@router.get("/clusters/{cluster_id}")
async def cluster_detail(cluster_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                         db: AsyncSession = Depends(get_db)) -> dict:
    c = await db.get(ComplaintCluster, cluster_id)
    if not c or c.workspace_id != ctx.workspace_id:
        raise NotFound("Theme not found.")
    from app.services.intelligence import evidence_for

    return {**analytics.cluster_dict(c), "evidence": await evidence_for(db, list(c.representative_review_ids or []), c.id, 5)}


@router.get("/{review_id}")
async def get_review(review_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                     db: AsyncSession = Depends(get_db)) -> dict:
    r = await db.get(Review, review_id)
    if not r or r.workspace_id != ctx.workspace_id or r.deleted_at:
        raise NotFound("Review not found.")
    out = review_out(r, detail=True)
    if r.business_id:
        b = await db.get(Business, r.business_id)
        out["business_name"] = b.name if b else None
    if r.source_id:
        s = await db.get(ReviewSource, r.source_id)
        out["source"] = {"name": s.name, "source_type": s.source_type} if s else None
    return out


@router.delete("/{review_id}")
async def delete_review(review_id: uuid.UUID, ctx: WorkspaceContext = Depends(require_role("analyst")),
                        db: AsyncSession = Depends(get_db)) -> dict:
    r = await db.get(Review, review_id)
    if not r or r.workspace_id != ctx.workspace_id or r.deleted_at:
        raise NotFound("Review not found.")
    r.deleted_at = utcnow()
    return {"message": "Review deleted."}


@router.post("", status_code=201)
async def create_manual(body: ManualReviewIn, ctx: WorkspaceContext = Depends(require_role("analyst")),
                        db: AsyncSession = Depends(get_db)) -> dict:
    project = await get_project(db, ctx, body.project_id)
    if body.business_id:
        b = await db.get(Business, body.business_id)
        if not b or b.project_id != project.id:
            raise NotFound("Business not found in this project.")
    src = await db.scalar(select(ReviewSource).where(ReviewSource.project_id == project.id,
                                                     ReviewSource.source_type == "manual"))
    if not src:
        src = ReviewSource(workspace_id=ctx.workspace_id, project_id=project.id, source_type="manual",
                           name="Manual entries", status="completed", created_by_id=ctx.user.id)
        db.add(src)
        await db.flush()
    row = NormalizedReview(text=normalize_text(body.text), rating=body.rating, review_date=body.review_date or date.today(),
                           reviewer_name=body.reviewer_name, platform=body.platform, product_name=body.product_name,
                           location=body.location, verified=body.verified)
    inserted, dupes = await insert_reviews(db, project, [row], source_id=src.id, business_id=body.business_id)
    if not inserted:
        raise AppError("This review already exists in the project.", code="duplicate_review")
    src.rows_total += 1
    src.rows_imported += 1
    job = None
    if body.analyze:
        job = await create_job(db, job_type="analyze_reviews", workspace_id=ctx.workspace_id, project_id=project.id,
                               user_id=ctx.user.id)
    await db.commit()
    if job:
        await enqueue(job.id)
    return {"imported": inserted, "job": job_out(job) if job else None}


@router.post("/import", status_code=202)
async def import_file(
    project_id: uuid.UUID = Form(...), file: UploadFile = File(...), platform: str | None = Form(None),
    business_id: uuid.UUID | None = Form(None), auto_analyze: bool = Form(True),
    ctx: WorkspaceContext = Depends(require_role("analyst")), db: AsyncSession = Depends(get_db),
) -> dict:
    await hit(f"import:{ctx.workspace_id}", 30, 3600)
    project = await get_project(db, ctx, project_id)
    if business_id:
        b = await db.get(Business, business_id)
        if not b or b.project_id != project.id:
            raise NotFound("Business not found in this project.")
    name = (file.filename or "upload.csv").replace("/", "_")[:200]
    if not name.lower().endswith((".csv", ".tsv", ".txt", ".xlsx", ".xlsm")):
        raise AppError("Unsupported file type. Upload a .csv or .xlsx file.", code="invalid_file_type")
    max_mb = int(await settings_service.get(db, "max_upload_mb"))
    data = await file.read(max_mb * 1024 * 1024 + 1)
    if len(data) > max_mb * 1024 * 1024:
        raise AppError(f"File is larger than {max_mb} MB.", code="file_too_large", status_code=413)
    if not data:
        raise AppError("The file is empty.", code="empty_file")
    if name.lower().endswith((".xlsx", ".xlsm")) and not data.startswith(b"PK"):
        raise AppError("This doesn't look like a valid Excel file.", code="invalid_file")
    if b"\x00" in data[:2048] and not name.lower().endswith((".xlsx", ".xlsm")) and data[:2] not in (b"\xff\xfe", b"\xfe\xff"):
        raise AppError("This doesn't look like a text CSV file.", code="invalid_file")
    source = ReviewSource(workspace_id=ctx.workspace_id, project_id=project.id,
                          source_type="excel" if name.lower().endswith((".xlsx", ".xlsm")) else "csv", name=name,
                          platform=(platform or "").strip()[:80] or None, status="pending", created_by_id=ctx.user.id)
    db.add(source)
    await db.flush()
    source.file_key = await storage.put(f"uploads/{ctx.workspace_id}/{source.id}/{name}", data)
    job = await create_job(db, job_type="import_reviews", workspace_id=ctx.workspace_id, project_id=project.id,
                           user_id=ctx.user.id, params={"source_id": str(source.id), "auto_analyze": auto_analyze,
                                                        "business_id": str(business_id) if business_id else None},
                           max_attempts=1)
    await log_activity(db, ctx.workspace_id, ctx.user.id, "reviews.imported", "project", project.id,
                       f"Uploaded {name}")
    await db.commit()
    await enqueue(job.id)
    return {"source_id": str(source.id), "job": job_out(job)}


@router.get("/projects/{project_id}/summary")
async def project_summary(project_id: uuid.UUID, ctx: WorkspaceContext = Depends(get_workspace_context),
                          db: AsyncSession = Depends(get_db)) -> dict:
    await get_project(db, ctx, project_id)
    return await project_stats(db, project_id)
