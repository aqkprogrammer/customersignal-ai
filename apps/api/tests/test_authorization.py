"""Tenant isolation, workspace roles and team privilege-escalation guards."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.core.database import session_scope
from app.models import AnalysisJob, Project, WorkspaceMember
from tests.conftest import add_member, create_project, set_plan, token_from


@pytest.fixture
async def tenant_a(account_factory, jobs):
    """User A with a project, a review, a report, a lead and a job."""
    a = await account_factory()
    await set_plan(a.workspace_id, "pro")
    project = await create_project(a, "Alpha Diner")
    r = await a.client.post("/api/v1/reviews", json={"project_id": project["id"], "text": "Cold food and rude staff.",
                                                     "rating": 1, "analyze": True})
    assert r.status_code == 201, r.text
    job_id = r.json()["job"]["id"]
    review_id = (await a.client.get("/api/v1/reviews", params={"project_id": project["id"]})).json()["items"][0]["id"]
    rep = await a.client.post("/api/v1/reports", json={"report_type": "customer_sentiment", "project_id": project["id"]})
    assert rep.status_code == 202, rep.text
    lead = await a.client.post("/api/v1/leads", json={"business_name": "Target Bistro"})
    assert lead.status_code == 201, lead.text
    jobs.ids.clear()
    return {"acct": a, "project_id": project["id"], "review_id": review_id, "report_id": rep.json()["report"]["id"],
            "lead_id": lead.json()["id"], "job_id": job_id}


async def test_foreign_workspace_header_is_forbidden(tenant_a, account_factory):
    b = await account_factory()
    hdr = b.headers(tenant_a["acct"].workspace_id)
    for path in ("/api/v1/projects", f"/api/v1/projects/{tenant_a['project_id']}", "/api/v1/reviews",
                 "/api/v1/reports", "/api/v1/leads", "/api/v1/analysis/jobs"):
        r = await b.client.get(path, headers=hdr)
        assert r.status_code == 403, path
        assert r.json()["error"]["code"] == "workspace_forbidden"
    # Non-existent workspace looks identical (no enumeration).
    r = await b.client.get("/api/v1/projects", headers=b.headers(str(uuid.uuid4())))
    assert r.status_code == 403 and r.json()["error"]["code"] == "workspace_forbidden"
    r = await b.client.delete(f"/api/v1/projects/{tenant_a['project_id']}", headers=hdr)
    assert r.status_code == 403


async def test_foreign_object_ids_return_404_in_own_workspace(tenant_a, account_factory):
    b = await account_factory()
    await set_plan(b.workspace_id, "pro")
    t = tenant_a
    c = b.client
    checks = [
        ("GET", f"/api/v1/projects/{t['project_id']}", None),
        ("PATCH", f"/api/v1/projects/{t['project_id']}", {"name": "pwned"}),
        ("DELETE", f"/api/v1/projects/{t['project_id']}", None),
        ("POST", f"/api/v1/projects/{t['project_id']}/archive", None),
        ("GET", f"/api/v1/reviews/{t['review_id']}", None),
        ("DELETE", f"/api/v1/reviews/{t['review_id']}", None),
        ("GET", f"/api/v1/reviews/projects/{t['project_id']}/summary", None),
        ("GET", f"/api/v1/reports/{t['report_id']}", None),
        ("GET", f"/api/v1/reports/{t['report_id']}/download", None),
        ("DELETE", f"/api/v1/reports/{t['report_id']}", None),
        ("GET", f"/api/v1/leads/{t['lead_id']}", None),
        ("PATCH", f"/api/v1/leads/{t['lead_id']}", {"notes": "pwned"}),
        ("DELETE", f"/api/v1/leads/{t['lead_id']}", None),
        ("POST", f"/api/v1/leads/{t['lead_id']}/generate", None),
        ("GET", f"/api/v1/analysis/jobs/{t['job_id']}", None),
        ("POST", f"/api/v1/analysis/jobs/{t['job_id']}/cancel", None),
        ("POST", "/api/v1/analysis/run", {"project_id": t["project_id"]}),
    ]
    for method, path, body in checks:
        r = await c.request(method, path, json=body)
        assert r.status_code == 404, f"{method} {path} -> {r.status_code} {r.text}"

    # Uploading into someone else's project is also rejected.
    r = await c.post("/api/v1/reviews/import", files={"file": ("x.csv", b"review_text\nhello there", "text/csv")},
                     data={"project_id": t["project_id"]})
    assert r.status_code == 404
    # Listing with a foreign project filter leaks nothing.
    r = await c.get("/api/v1/reviews", params={"project_id": t["project_id"]})
    assert r.status_code == 200 and r.json()["total"] == 0
    r = await c.get("/api/v1/analysis/jobs")
    assert r.json()["total"] == 0

    # Nothing was modified.
    async with session_scope() as db:
        p = await db.get(Project, uuid.UUID(t["project_id"]))
        assert p.name == "Alpha Diner" and p.deleted_at is None and p.status != "archived"
        j = await db.get(AnalysisJob, uuid.UUID(t["job_id"]))
        assert j.status == "pending"
    a = t["acct"]
    lead = await a.client.get(f"/api/v1/leads/{t['lead_id']}")
    assert lead.status_code == 200 and lead.json()["business_name"] == "Target Bistro"
    assert lead.json()["pitch_status"] == "none" and lead.json()["notes"] is None
    assert (await a.client.get(f"/api/v1/reports/{t['report_id']}")).status_code == 200


async def test_viewer_can_read_but_not_write(account_factory):
    owner = await account_factory()
    viewer = await account_factory()
    await add_member(owner.workspace_id, viewer.user_id, "viewer")
    project = await create_project(owner, "Shared")
    hdr = viewer.headers(owner.workspace_id)
    r = await viewer.client.get("/api/v1/projects", headers=hdr)
    assert r.status_code == 200 and r.json()["total"] == 1
    assert (await viewer.client.get(f"/api/v1/projects/{project['id']}", headers=hdr)).status_code == 200
    for method, path, body in [
        ("POST", "/api/v1/projects", {"name": "Nope"}),
        ("PATCH", f"/api/v1/projects/{project['id']}", {"name": "Nope"}),
        ("POST", "/api/v1/reviews", {"project_id": project["id"], "text": "viewer review"}),
        ("POST", "/api/v1/reports", {"report_type": "customer_sentiment"}),
        ("DELETE", f"/api/v1/projects/{project['id']}", None),
    ]:
        r = await viewer.client.request(method, path, json=body, headers=hdr)
        assert r.status_code == 403, f"{method} {path}"
        assert r.json()["error"]["code"] == "insufficient_role"


async def test_analyst_cannot_delete_project_but_admin_can(account_factory):
    owner = await account_factory()
    analyst = await account_factory()
    admin = await account_factory()
    await add_member(owner.workspace_id, analyst.user_id, "analyst")
    await add_member(owner.workspace_id, admin.user_id, "admin")
    project = await create_project(owner)
    r = await analyst.client.delete(f"/api/v1/projects/{project['id']}", headers=analyst.headers(owner.workspace_id))
    assert r.status_code == 403 and r.json()["error"]["code"] == "insufficient_role"
    r = await admin.client.delete(f"/api/v1/projects/{project['id']}", headers=admin.headers(owner.workspace_id))
    assert r.status_code == 200


async def _member_id(acct, ws_id: str, user_id: str) -> str:
    r = await acct.client.get("/api/v1/team/members", headers=acct.headers(ws_id))
    assert r.status_code == 200
    return next(m["id"] for m in r.json()["members"] if m["user_id"] == user_id)


async def test_team_privilege_escalation_guards(account_factory):
    owner = await account_factory()
    await set_plan(owner.workspace_id, "pro")
    admin = await account_factory()
    analyst = await account_factory()
    await add_member(owner.workspace_id, admin.user_id, "admin")
    await add_member(owner.workspace_id, analyst.user_id, "analyst")
    ws = owner.workspace_id
    admin_mid = await _member_id(owner, ws, admin.user_id)
    analyst_mid = await _member_id(owner, ws, analyst.user_id)
    owner_mid = await _member_id(owner, ws, owner.user_id)

    # Admin cannot promote anyone to owner or admin.
    for role in ("owner", "admin"):
        r = await admin.client.patch(f"/api/v1/team/members/{analyst_mid}", json={"role": role}, headers=admin.headers(ws))
        assert r.status_code == 403, role
    # Admin cannot demote the owner, nor change their own role.
    r = await admin.client.patch(f"/api/v1/team/members/{owner_mid}", json={"role": "viewer"}, headers=admin.headers(ws))
    assert r.status_code == 403
    r = await admin.client.patch(f"/api/v1/team/members/{admin_mid}", json={"role": "owner"}, headers=admin.headers(ws))
    assert r.status_code == 400
    # Admin cannot remove the owner.
    r = await admin.client.delete(f"/api/v1/team/members/{owner_mid}", headers=admin.headers(ws))
    assert r.status_code == 400 and r.json()["error"]["code"] == "owner_cannot_leave"
    # Admin cannot invite admins; analyst cannot invite at all.
    r = await admin.client.post("/api/v1/team/invitations", json={"email": "x@example.com", "role": "admin"},
                                headers=admin.headers(ws))
    assert r.status_code == 403
    r = await analyst.client.post("/api/v1/team/invitations", json={"email": "y@example.com", "role": "viewer"},
                                  headers=analyst.headers(ws))
    assert r.status_code == 403 and r.json()["error"]["code"] == "insufficient_role"
    # Analyst cannot remove others; admin can demote an analyst.
    r = await analyst.client.delete(f"/api/v1/team/members/{admin_mid}", headers=analyst.headers(ws))
    assert r.status_code == 403
    r = await admin.client.patch(f"/api/v1/team/members/{analyst_mid}", json={"role": "viewer"}, headers=admin.headers(ws))
    assert r.status_code == 200 and r.json()["role"] == "viewer"
    # Owner can promote to admin.
    r = await owner.client.patch(f"/api/v1/team/members/{analyst_mid}", json={"role": "admin"}, headers=owner.headers(ws))
    assert r.status_code == 200

    async with session_scope() as db:
        roles = {str(m.user_id): m.role for m in (await db.scalars(
            select(WorkspaceMember).where(WorkspaceMember.workspace_id == uuid.UUID(ws)))).all()}
    assert roles == {owner.user_id: "owner", admin.user_id: "admin", analyst.user_id: "admin"}


async def test_invitation_flow_and_email_binding(account_factory, sent_emails):
    owner = await account_factory()
    # Free plan allows a single member.
    r = await owner.client.post("/api/v1/team/invitations", json={"email": "friend@example.com", "role": "viewer"})
    assert r.status_code == 402
    await set_plan(owner.workspace_id, "pro")
    invitee = await account_factory()
    stranger = await account_factory()
    r = await owner.client.post("/api/v1/team/invitations", json={"email": invitee.email, "role": "analyst"})
    assert r.status_code == 201, r.text
    token = token_from(sent_emails, "team_invitation", "invite_url")

    r = await stranger.client.post("/api/v1/team/invitations/accept", json={"token": token})
    assert r.status_code == 403 and r.json()["error"]["code"] == "invitation_email_mismatch"
    r = await invitee.client.post("/api/v1/team/invitations/accept", json={"token": token})
    assert r.status_code == 200, r.text
    assert r.json()["workspace_id"] == owner.workspace_id
    r = await invitee.client.get("/api/v1/projects", headers=invitee.headers(owner.workspace_id))
    assert r.status_code == 200
    # Token is single-use.
    r = await invitee.client.post("/api/v1/team/invitations/accept", json={"token": token})
    assert r.status_code == 404
