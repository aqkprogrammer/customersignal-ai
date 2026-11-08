"""PDF reports with public share links, and the 1-star Opportunity Finder (lead pitches grounded in evidence)."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.core.database import session_scope
from app.models import ComplaintCluster, Review
from tests.conftest import SAMPLE_CSV, create_project, set_plan, upload_reviews

LEAD_CSV = (
    b"review_text,rating,date,reviewer\n"
    b"\"We waited over an hour for our appointment, terrible.\",1,2026-10-01,A\n"
    b"\"Waited 50 minutes past my booking time. So slow.\",1,2026-10-03,B\n"
    b"\"The wait was ridiculous, almost an hour in the queue.\",2,2026-10-05,C\n"
    b"\"Way too expensive and the bill had hidden fees.\",1,2026-10-06,D\n"
    b"\"Hidden charges on the final bill, overpriced.\",2,2026-10-07,E\n"
    b"\"Lovely staff, very friendly.\",5,2026-10-08,F\n"
)


async def test_report_lifecycle_pdf_download_and_share_links(account_factory, new_client, jobs):
    a = await account_factory()
    project = await create_project(a)
    await upload_reviews(a, project["id"], SAMPLE_CSV, auto_analyze=True)
    await jobs.drain()

    r = await a.client.post("/api/v1/reports", json={"report_type": "customer_sentiment", "project_id": project["id"]})
    assert r.status_code == 202, r.text
    report_id, job_id = r.json()["report"]["id"], r.json()["job"]["id"]
    assert r.json()["report"]["status"] == "pending"
    early = await a.client.get(f"/api/v1/reports/{report_id}/download")
    assert early.status_code == 400 and early.json()["error"]["code"] == "report_not_ready"
    assert (await a.client.post(f"/api/v1/reports/{report_id}/shares", json={})).status_code == 400

    assert (await jobs.drain())[job_id] == "completed"
    rep = (await a.client.get(f"/api/v1/reports/{report_id}")).json()
    assert rep["status"] == "ready" and rep["has_pdf"] and rep["file_size"] > 0
    assert rep["content"]

    dl = await a.client.get(f"/api/v1/reports/{report_id}/download")
    assert dl.status_code == 200
    assert dl.headers["content-type"] == "application/pdf"
    assert dl.content.startswith(b"%PDF")
    assert len(dl.content) == rep["file_size"]

    share = await a.client.post(f"/api/v1/reports/{report_id}/shares", json={"expires_in_days": 7})
    assert share.status_code == 201, share.text
    token = share.json()["url"].rsplit("/", 1)[-1]
    anon = new_client()
    pub = await anon.get(f"/api/v1/public/reports/{token}")
    assert pub.status_code == 200
    assert pub.json()["id"] == report_id and "project_id" not in pub.json()
    pdf = await anon.get(f"/api/v1/public/reports/{token}/pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert (await anon.get("/api/v1/public/reports/not-a-real-token")).status_code == 404

    detail = (await a.client.get(f"/api/v1/reports/{report_id}")).json()
    assert detail["shares"][0]["view_count"] == 1
    assert detail["shares"][0]["token_prefix"] == token[:8]

    rv = await a.client.delete(f"/api/v1/reports/{report_id}/shares/{share.json()['id']}")
    assert rv.status_code == 200
    assert (await anon.get(f"/api/v1/public/reports/{token}")).status_code == 404
    assert (await anon.get(f"/api/v1/public/reports/{token}/pdf")).status_code == 404


async def test_report_quota_on_free_plan(account_factory, jobs):
    a = await account_factory()
    # A report over an empty scope fails (and is not counted against the quota).
    empty = await a.client.post("/api/v1/reports", json={"report_type": "executive_summary"})
    assert (await jobs.drain())[empty.json()["job"]["id"]] == "failed"
    failed = (await a.client.get(f"/api/v1/reports/{empty.json()['report']['id']}")).json()
    assert failed["status"] == "failed" and "no reviews" in failed["error"].lower()

    project = await create_project(a)
    await upload_reviews(a, project["id"], SAMPLE_CSV, auto_analyze=True)
    await jobs.drain()
    for _ in range(2):
        r = await a.client.post("/api/v1/reports", json={"report_type": "executive_summary",
                                                         "project_id": project["id"]})
        assert r.status_code == 202, r.text
        assert set((await jobs.drain()).values()) == {"completed"}
    r = await a.client.post("/api/v1/reports", json={"report_type": "executive_summary", "project_id": project["id"]})
    assert r.status_code == 402
    assert r.json()["error"]["details"]["metric"] == "reports"


async def test_opportunity_finder_generates_evidence_backed_pitch(account_factory, jobs):
    a = await account_factory()
    await set_plan(a.workspace_id, "pro")
    r = await a.client.post("/api/v1/leads", json={"business_name": "Glow Spa", "city": "Dubai",
                                                   "industry": "Beauty", "competitors": ["Shine Spa"]})
    assert r.status_code == 201, r.text
    lead = r.json()
    assert {b["name"] for b in lead["businesses"]} == {"Glow Spa", "Shine Spa"}

    none = await a.client.post(f"/api/v1/leads/{lead['id']}/generate")
    assert none.status_code == 400 and none.json()["error"]["code"] == "no_reviews"
    early = await a.client.post(f"/api/v1/leads/{lead['id']}/report")
    assert early.status_code == 400 and early.json()["error"]["code"] == "pitch_not_ready"

    up = await upload_reviews(a, lead["project_id"], LEAD_CSV)
    assert (await jobs.drain())[up["job"]["id"]] == "completed"
    gen = await a.client.post(f"/api/v1/leads/{lead['id']}/generate")
    assert gen.status_code == 202, gen.text
    assert (await jobs.drain())[gen.json()["id"]] == "completed"

    detail = (await a.client.get(f"/api/v1/leads/{lead['id']}")).json()
    assert detail["pitch_status"] == "ready"
    assert detail["status"] == "researched"
    assert detail["review_count"] == 6
    assert detail["cold_email"] and detail["cold_email_subject"] and detail["executive_summary"]
    issues = detail["issues"]
    assert issues, "expected recurring complaint issues"

    async with session_scope() as db:
        pid = uuid.UUID(lead["project_id"])
        clusters = {str(c.id): c for c in (await db.scalars(
            select(ComplaintCluster).where(ComplaintCluster.project_id == pid))).all()}
        review_texts = {str(r.id): r.text for r in (await db.scalars(select(Review).where(Review.project_id == pid))).all()}
    for issue in issues:
        assert issue["cluster_id"] in clusters, "issue must reference a real cluster"
        assert clusters[issue["cluster_id"]].kind == "complaint"
        assert issue["evidence"], "issue must carry evidence"
        for ev in issue["evidence"]:
            assert ev["review_id"] in review_texts
            assert ev["excerpt"].rstrip("…") in review_texts[ev["review_id"]] or \
                review_texts[ev["review_id"]].startswith(ev["excerpt"].rstrip("…"))
    assert any(a_["type"] == "pitch_generated" for a_ in detail["activities"])

    # Report from the pitch.
    rep = await a.client.post(f"/api/v1/leads/{lead['id']}/report")
    assert rep.status_code == 202
    assert set((await jobs.drain()).values()) == {"completed"}
    assert (await a.client.get(f"/api/v1/reports/{rep.json()['report']['id']}")).json()["status"] == "ready"


async def test_lead_pipeline_status_changes(account_factory):
    a = await account_factory()
    await set_plan(a.workspace_id, "pro")
    lead = (await a.client.post("/api/v1/leads", json={"business_name": "Corner Cafe"})).json()
    r = await a.client.patch(f"/api/v1/leads/{lead['id']}", json={"status": "contacted", "contact_email": "o@x.com"})
    assert r.status_code == 200 and r.json()["status"] == "contacted"
    assert r.json()["last_contacted_at"]
    bad = await a.client.patch(f"/api/v1/leads/{lead['id']}", json={"status": "hacked"})
    assert bad.status_code == 422
    listing = (await a.client.get("/api/v1/leads")).json()
    assert listing["pipeline"]["contacted"] == 1


async def test_gap_finder_requires_reviews_then_runs(account_factory, jobs):
    a = await account_factory()
    await set_plan(a.workspace_id, "pro")
    gp = await a.client.post("/api/v1/gap-finder", json={"product_name": "Blendr 3000",
                                                         "competitor_product": "MixMaster"})
    assert gp.status_code == 201, gp.text
    pid = gp.json()["id"]
    r = await a.client.post(f"/api/v1/gap-finder/{pid}/run")
    assert r.status_code == 400 and r.json()["error"]["code"] == "no_reviews"
    csv_bytes = (
        b"review_text,rating,date\n"
        b"\"Works fine but it is loud and I wish it had a pulse mode.\",3,2026-10-01\n"
        b"\"Decent blender, the lid leaks sometimes.\",3,2026-10-02\n"
        b"\"Okay value for money, motor gets hot.\",3,2026-10-03\n"
    )
    await upload_reviews(a, pid, csv_bytes)
    await jobs.drain()
    run = await a.client.post(f"/api/v1/gap-finder/{pid}/run")
    assert run.status_code == 202, run.text
    assert (await jobs.drain())[run.json()["id"]] == "completed"
    report = (await a.client.get(f"/api/v1/gap-finder/{pid}/report")).json()
    assert report["report"] is not None
    assert 0 <= report["report"]["payload"]["opportunity_score"] <= 100
