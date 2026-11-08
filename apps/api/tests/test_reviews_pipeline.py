"""CSV/Excel ingestion, the analysis pipeline with the mock provider, anti-fabrication and provider fallback."""

from __future__ import annotations

import csv
import io
import uuid

from openpyxl import Workbook
from sqlalchemy import func, select

from app.ai.providers.mock_provider import MockProvider
from app.ai.registry import set_provider_override
from app.core.database import session_scope
from app.models import (
    AIUsageLog,
    AnalysisJob,
    ComplaintCluster,
    ProductOpportunity,
    Review,
    ReviewSentiment,
    ReviewSource,
    ReviewTopic,
)
from app.services.analysis_service import _excerpt_ok
from tests.conftest import SAMPLE_CSV, create_project, upload_reviews


async def _db_counts(project_id: str) -> dict:
    pid = uuid.UUID(project_id)
    async with session_scope() as db:
        reviews = await db.scalar(select(func.count()).select_from(Review).where(Review.project_id == pid))
        sentiments = dict((await db.execute(
            select(ReviewSentiment.sentiment, func.count()).join(Review, Review.id == ReviewSentiment.review_id)
            .where(Review.project_id == pid).group_by(ReviewSentiment.sentiment))).all())
        topics = await db.scalar(select(func.count()).select_from(ReviewTopic).where(ReviewTopic.project_id == pid))
        clusters = await db.scalar(select(func.count()).select_from(ComplaintCluster)
                                   .where(ComplaintCluster.project_id == pid))
        opps = await db.scalar(select(func.count()).select_from(ProductOpportunity)
                               .where(ProductOpportunity.project_id == pid))
    return {"reviews": reviews, "sentiments": sentiments, "topics": topics, "clusters": clusters, "opps": opps}


async def test_csv_import_stores_valid_rows_skips_duplicates_reports_invalid(account_factory, jobs):
    a = await account_factory()
    project = await create_project(a)
    up = await upload_reviews(a, project["id"], SAMPLE_CSV)
    assert up["job"]["job_type"] == "import_reviews" and up["job"]["status"] == "pending"
    assert jobs.ids == [up["job"]["id"]]
    results = await jobs.drain()
    assert results[up["job"]["id"]] == "completed"

    job = (await a.client.get(f"/api/v1/analysis/jobs/{up['job']['id']}")).json()
    summary = job["result_summary"]
    assert summary["rows"] == 7
    assert summary["imported"] == 4
    assert summary["duplicates"] == 1
    assert summary["invalid"] == 2
    assert "analysis_job_id" not in summary  # auto_analyze=false

    sources = (await a.client.get("/api/v1/reviews/sources", params={"project_id": project["id"]})).json()
    src = sources[0]
    assert src["status"] == "completed" and src["rows_imported"] == 4 and src["rows_invalid"] == 2
    assert {e["row"] for e in src["errors"]} == {7, 8}
    assert any("rating" in e["error"].lower() for e in src["errors"])

    listing = (await a.client.get("/api/v1/reviews", params={"project_id": project["id"]})).json()
    assert listing["total"] == 4
    assert all(r["analysis_status"] == "pending" for r in listing["items"])
    assert {r["reviewer_name"] for r in listing["items"]} == {"Alice", "Bob", "Carl", "Dana"}

    # Re-uploading the same file inserts nothing new.
    up2 = await upload_reviews(a, project["id"], SAMPLE_CSV)
    await jobs.drain()
    s2 = (await a.client.get(f"/api/v1/analysis/jobs/{up2['job']['id']}")).json()["result_summary"]
    assert s2["imported"] == 0 and s2["duplicates"] == 5
    assert (await _db_counts(project["id"]))["reviews"] == 4


async def test_import_rejects_bad_files(account_factory):
    a = await account_factory()
    project = await create_project(a)
    c = a.client
    r = await c.post("/api/v1/reviews/import", files={"file": ("evil.exe", b"MZ...", "application/octet-stream")},
                     data={"project_id": project["id"]})
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_file_type"
    r = await c.post("/api/v1/reviews/import", files={"file": ("empty.csv", b"", "text/csv")},
                     data={"project_id": project["id"]})
    assert r.status_code == 400 and r.json()["error"]["code"] == "empty_file"
    r = await c.post("/api/v1/reviews/import", files={"file": ("fake.xlsx", b"not a zip", "application/x")},
                     data={"project_id": project["id"]})
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_file"


async def test_import_without_text_column_fails_job(account_factory, jobs):
    a = await account_factory()
    project = await create_project(a)
    up = await upload_reviews(a, project["id"], b"stars,when\n5,2026-01-01\n")
    assert (await jobs.drain())[up["job"]["id"]] == "failed"
    job = (await a.client.get(f"/api/v1/analysis/jobs/{up['job']['id']}")).json()
    assert job["status"] == "failed" and "review text column" in job["error"]
    assert job["dead_lettered"] is False  # user error, not a system failure
    async with session_scope() as db:
        src = await db.get(ReviewSource, uuid.UUID(up["source_id"]))
        assert src.status == "failed"


async def test_full_pipeline_with_mock_provider_and_dashboard(account_factory, jobs):
    a = await account_factory()
    project = await create_project(a)
    up = await upload_reviews(a, project["id"], SAMPLE_CSV, auto_analyze=True)
    results = await jobs.drain()
    assert list(results.values()) == ["completed", "completed"]
    import_summary = (await a.client.get(f"/api/v1/analysis/jobs/{up['job']['id']}")).json()["result_summary"]
    analysis_job_id = import_summary["analysis_job_id"]
    analysis = (await a.client.get(f"/api/v1/analysis/jobs/{analysis_job_id}")).json()
    assert analysis["status"] == "completed" and analysis["progress"] == 100
    s = analysis["result_summary"]
    assert s["analyzed"] == 4 and s["provider"] == "mock" and s["warnings"] == []
    assert s["clusters"] >= 1 and s["opportunities"] >= 1

    counts = await _db_counts(project["id"])
    assert counts["reviews"] == 4 and sum(counts["sentiments"].values()) == 4
    assert counts["topics"] > 0 and counts["clusters"] == s["clusters"] and counts["opps"] >= 1
    assert counts["sentiments"].get("negative", 0) >= 2 and counts["sentiments"].get("positive", 0) >= 1

    async with session_scope() as db:
        pid = uuid.UUID(project["id"])
        reviews = {r.id: r for r in (await db.scalars(select(Review).where(Review.project_id == pid))).all()}
        assert all(r.analysis_status == "analyzed" and r.embedding is not None for r in reviews.values())
        # Every stored excerpt is a verbatim quote from its review.
        topics = (await db.scalars(select(ReviewTopic).where(ReviewTopic.project_id == pid,
                                                             ReviewTopic.excerpt.is_not(None)))).all()
        assert topics and all(t.excerpt in reviews[t.review_id].text for t in topics)
        # Opportunities are grounded in real reviews of this project.
        for o in (await db.scalars(select(ProductOpportunity).where(ProductOpportunity.project_id == pid))).all():
            assert o.evidence_review_ids and set(o.evidence_review_ids) <= set(reviews)
        usage = (await db.scalars(select(AIUsageLog).where(AIUsageLog.job_id == uuid.UUID(analysis_job_id)))).all()
        assert usage and {u.status for u in usage} == {"success"}
        assert "classify_reviews" in {u.operation for u in usage}

    dash = await a.client.get("/api/v1/analysis/dashboard", params={"project_id": project["id"]})
    assert dash.status_code == 200, dash.text
    k = dash.json()["kpis"]
    assert k["total_reviews"] == 4 and k["analyzed_reviews"] == 4
    for label in ("positive", "neutral", "negative"):
        assert k[label] == counts["sentiments"].get(label, 0)
    assert round(k["positive_pct"] + k["neutral_pct"] + k["negative_pct"]) == 100
    assert k["avg_rating"] == round((1 + 5 + 2 + 2) / 4, 2)
    assert dash.json()["ai_provider"]["name"] == "mock"

    opps = (await a.client.get("/api/v1/opportunities", params={"project_id": project["id"]})).json()
    assert len(opps) == counts["opps"]
    detail = (await a.client.get(f"/api/v1/opportunities/{opps[0]['id']}")).json()
    assert detail["evidence"] and all(e["review_id"] for e in detail["evidence"])

    # Nothing left to analyze; a re-run is refused.
    r = await a.client.post("/api/v1/analysis/run", json={"project_id": project["id"]})
    assert r.status_code == 400 and r.json()["error"]["code"] == "nothing_to_analyze"
    r = await a.client.post("/api/v1/analysis/run", json={"project_id": project["id"], "reanalyze": True})
    assert r.status_code == 202
    r2 = await a.client.post("/api/v1/analysis/run", json={"project_id": project["id"], "reanalyze": True})
    assert r2.status_code == 409 and r2.json()["error"]["code"] == "analysis_running"


class FabricatingProvider(MockProvider):
    """Returns excerpts that do not occur in the reviews (simulates a hallucinating LLM)."""

    async def complete_json(self, **kwargs):
        result = await super().complete_json(**kwargs)
        if kwargs["operation"] == "classify_reviews":
            for item in result.data.items:
                for sig in [*item.complaints, *item.praises]:
                    sig.excerpt = "This sentence was invented by the model and never written by a customer"
                for fr in item.feature_requests:
                    fr.excerpt = "Invented feature request quote"
        return result


async def test_fabricated_excerpts_are_discarded(account_factory, jobs):
    set_provider_override(FabricatingProvider())
    a = await account_factory()
    project = await create_project(a)
    await upload_reviews(a, project["id"], SAMPLE_CSV, auto_analyze=True)
    assert set((await jobs.drain()).values()) == {"completed"}
    async with session_scope() as db:
        signals = (await db.scalars(select(ReviewTopic).where(
            ReviewTopic.project_id == uuid.UUID(project["id"]),
            ReviewTopic.kind.in_(("complaint", "praise", "feature_request"))))).all()
    assert signals, "the provider should still have produced complaint/praise signals"
    assert all(t.excerpt is None for t in signals)


def test_excerpt_ok_unit():
    text = 'The staff were rude.\nWe  waited over an hour for our food!'
    assert _excerpt_ok("The staff were rude.", text) == "The staff were rude."
    assert _excerpt_ok('"The staff were rude."', text) == "The staff were rude."  # surrounding quotes stripped
    assert _excerpt_ok("we waited over AN hour", text) == "we waited over AN hour"  # whitespace/case-insensitive
    assert _excerpt_ok("The staff were wonderful.", text) is None
    assert _excerpt_ok("ok", text) is None
    assert _excerpt_ok("", text) is None and _excerpt_ok(None, text) is None


async def test_failing_provider_falls_back_to_heuristics(account_factory, jobs):
    set_provider_override(MockProvider(fail_operations={"classify_reviews"}))
    a = await account_factory()
    project = await create_project(a)
    up = await upload_reviews(a, project["id"], SAMPLE_CSV, auto_analyze=True)
    assert set((await jobs.drain()).values()) == {"completed"}
    imp = (await a.client.get(f"/api/v1/analysis/jobs/{up['job']['id']}")).json()["result_summary"]
    s = (await a.client.get(f"/api/v1/analysis/jobs/{imp['analysis_job_id']}")).json()["result_summary"]
    assert s["analyzed"] == 4
    assert any("classify reviews" in w for w in s["warnings"])
    assert s["provider"] == "mock+heuristic"
    async with session_scope() as db:
        errors = (await db.scalars(select(AIUsageLog).where(AIUsageLog.status == "error"))).all()
        assert errors and {e.operation for e in errors} == {"classify_reviews"}
        assert all("mock failure" in (e.error or "") for e in errors)
        providers = set((await db.scalars(select(ReviewSentiment.provider).where(
            ReviewSentiment.workspace_id == uuid.UUID(a.workspace_id)))).all())
        assert providers == {"heuristic"}


async def test_excel_import(account_factory, jobs):
    a = await account_factory()
    project = await create_project(a)
    wb = Workbook()
    ws = wb.active
    ws.append(["Review", "Stars", "Date", "Author", "Platform"])
    ws.append(["Delivery arrived two days late and the box was damaged.", 2, "2026-09-01", "Omar", "Google"])
    ws.append(["Excellent quality, would buy again.", "5 stars", "2026-09-02", "Lina", "Google"])
    ws.append(["Average experience overall.", "6/10", "2026-09-03", "Sam", "Trustpilot"])
    buf = io.BytesIO()
    wb.save(buf)
    up = await upload_reviews(a, project["id"], buf.getvalue(), filename="reviews.xlsx")
    assert (await jobs.drain())[up["job"]["id"]] == "completed"
    items = (await a.client.get("/api/v1/reviews", params={"project_id": project["id"], "sort": "date_asc"})).json()
    assert items["total"] == 3
    assert [r["rating"] for r in items["items"]] == [2.0, 5.0, 3.0]
    assert [r["platform"] for r in items["items"]] == ["Google", "Google", "Trustpilot"]
    async with session_scope() as db:
        src = await db.get(ReviewSource, uuid.UUID(up["source_id"]))
        assert src.source_type == "excel"


async def test_export_csv_neutralizes_formula_injection(account_factory):
    a = await account_factory()
    project = await create_project(a)
    payloads = ["=cmd|' /C calc'!A0 terrible service", "+SUM(1,2) bad", "@import evil", "Normal review text"]
    for text in payloads:
        r = await a.client.post("/api/v1/reviews", json={"project_id": project["id"], "text": text, "rating": 2,
                                                         "analyze": False})
        assert r.status_code == 201, r.text
    dup = await a.client.post("/api/v1/reviews", json={"project_id": project["id"], "text": "Normal review text",
                                                       "rating": 2, "analyze": False})
    assert dup.status_code == 400 and dup.json()["error"]["code"] == "duplicate_review"

    r = await a.client.get("/api/v1/reviews/export", params={"project_id": project["id"]})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers["content-disposition"]
    rows = list(csv.DictReader(io.StringIO(r.text)))
    texts = {row["text"] for row in rows}
    assert texts == {"'=cmd|' /C calc'!A0 terrible service", "'+SUM(1,2) bad", "'@import evil", "Normal review text"}


async def test_cancelled_job_is_not_run(account_factory, jobs):
    a = await account_factory()
    project = await create_project(a)
    r = await a.client.post("/api/v1/reviews", json={"project_id": project["id"], "text": "Slow service today.",
                                                     "rating": 2})
    job_id = r.json()["job"]["id"]
    c = await a.client.post(f"/api/v1/analysis/jobs/{job_id}/cancel")
    assert c.status_code == 200 and c.json()["status"] == "cancelled"
    assert (await jobs.drain())[job_id] == "skipped"
    async with session_scope() as db:
        assert (await db.get(AnalysisJob, uuid.UUID(job_id))).status == "cancelled"
        assert await db.scalar(select(func.count()).select_from(ReviewSentiment)) == 0
