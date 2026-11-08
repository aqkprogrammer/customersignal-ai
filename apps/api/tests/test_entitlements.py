"""Server-side plan limits and feature gates, and admin plan adjustment unlocking them."""

from __future__ import annotations

from tests.conftest import admin_login, create_admin, create_project, unique_email


async def test_free_plan_project_limit(account_factory):
    a = await account_factory()
    await create_project(a, "One")
    await create_project(a, "Two")
    r = await a.client.post("/api/v1/projects", json={"name": "Three"})
    assert r.status_code == 402
    err = r.json()["error"]
    assert err["code"] == "plan_limit"
    assert err["details"] == {"limit": 2, "metric": "projects"}
    # Deleting a project frees a slot.
    first = (await a.client.get("/api/v1/projects")).json()["items"][0]
    assert (await a.client.delete(f"/api/v1/projects/{first['id']}")).status_code == 200
    assert (await a.client.post("/api/v1/projects", json={"name": "Three"})).status_code == 201


async def test_free_plan_blocks_advanced_ai_features(account_factory):
    a = await account_factory()
    r = await a.client.post("/api/v1/gap-finder", json={"product_name": "Blender X"})
    assert r.status_code == 402
    assert r.json()["error"]["code"] == "feature_not_in_plan"
    assert r.json()["error"]["details"] == {"feature": "advanced_ai", "plan": "free"}
    r = await a.client.post("/api/v1/leads", json={"business_name": "Some Salon"})
    assert r.status_code == 402 and r.json()["error"]["code"] == "feature_not_in_plan"
    r = await a.client.post("/api/v1/reports", json={"report_type": "product_opportunity"})
    assert r.status_code == 402 and r.json()["error"]["code"] == "feature_not_in_plan"


async def test_admin_plan_adjustment_unlocks_features(account_factory, new_client):
    a = await account_factory(company_name=f"Upgrade Co {unique_email()[:6]}")
    assert (await a.client.post("/api/v1/leads", json={"business_name": "Salon"})).status_code == 402

    await create_admin("billing@ops.example.com", role="billing_admin")
    admin = new_client()
    await admin_login(admin, "billing@ops.example.com")
    subs = await admin.get("/api/v1/admin/subscriptions", params={"q": "Upgrade Co"})
    assert subs.status_code == 200, subs.text
    sub = next(s for s in subs.json()["items"] if s["workspace_id"] == a.workspace_id)
    assert sub["plan"] == "free"
    r = await admin.post(f"/api/v1/admin/subscriptions/{sub['id']}/adjust",
                         json={"plan_code": "pro", "reason": "sales-led upgrade"})
    assert r.status_code == 200, r.text

    r = await a.client.post("/api/v1/leads", json={"business_name": "Salon"})
    assert r.status_code == 201, r.text
    billing = await a.client.get("/api/v1/billing")
    assert billing.json()["subscription"]["plan"]["code"] == "pro"


async def test_limit_override_and_lapsed_subscription(account_factory, new_client):
    a = await account_factory()
    await create_admin("root@ops.example.com")
    admin = new_client()
    await admin_login(admin, "root@ops.example.com")
    subs = (await admin.get("/api/v1/admin/subscriptions")).json()["items"]
    sub_id = next(s["id"] for s in subs if s["workspace_id"] == a.workspace_id)

    r = await admin.post(f"/api/v1/admin/subscriptions/{sub_id}/adjust",
                         json={"limit_overrides": {"max_projects": 1}, "reason": "trial restriction"})
    assert r.status_code == 200
    await create_project(a, "Only one")
    assert (await a.client.post("/api/v1/projects", json={"name": "Second"})).status_code == 402

    bad = await admin.post(f"/api/v1/admin/subscriptions/{sub_id}/adjust",
                           json={"limit_overrides": {"max_unicorns": 1}, "reason": "typo"})
    assert bad.status_code == 400

    # A canceled paid plan falls back to Free features.
    await admin.post(f"/api/v1/admin/subscriptions/{sub_id}/adjust",
                     json={"plan_code": "pro", "status": "canceled", "limit_overrides": {}, "reason": "lapsed"})
    r = await a.client.post("/api/v1/leads", json={"business_name": "Salon"})
    assert r.status_code == 402 and r.json()["error"]["code"] == "feature_not_in_plan"
