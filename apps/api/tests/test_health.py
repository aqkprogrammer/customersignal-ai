from __future__ import annotations


async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    # Security headers are applied to every response.
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers.get("x-request-id")


async def test_health_ready_checks_database(client):
    r = await client.get("/health/ready")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ok"
    assert body["checks"]["database"] is True


async def test_openapi_schema_generates(client):
    r = await client.get("/api/openapi.json")
    assert r.status_code == 200
    paths = r.json()["paths"]
    for p in ("/api/v1/auth/signup", "/api/v1/projects", "/api/v1/reviews/import", "/api/v1/admin/auth/login"):
        assert p in paths
    # The Stripe webhook is intentionally hidden from the public schema.
    assert "/api/v1/billing/webhook" not in paths


async def test_public_plans_seeded(client):
    r = await client.get("/api/v1/public/plans")
    assert r.status_code == 200
    codes = [p["code"] for p in r.json()]
    assert codes == ["free", "starter", "pro", "business", "enterprise"]
    free = r.json()[0]
    assert free["limits"]["max_projects"] == 2
