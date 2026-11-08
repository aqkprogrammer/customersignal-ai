"""Admin authentication (separate identity, MFA, lockout), RBAC, audit logging and bootstrap."""

from __future__ import annotations

import uuid

import pyotp
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import session_scope
from app.models import AdminAuditLog, AdminUser, User
from tests.conftest import PASSWORD, _cookie, admin_login, create_admin, signup_and_login, unique_email

ADMIN_PW = "Adm1n-Password-Strong"


async def _audit_actions() -> list[str]:
    async with session_scope() as db:
        return list((await db.scalars(select(AdminAuditLog.action).order_by(AdminAuditLog.created_at))).all())


async def test_public_signup_never_creates_admin(client, new_client):
    email = unique_email("wannabe")
    r = await client.post("/api/v1/auth/signup", json={
        "full_name": "Eve", "email": email, "password": PASSWORD, "accept_terms": True,
        "role": "super_admin", "is_admin": True, "admin_role": "super_admin"})
    assert r.status_code == 201
    async with session_scope() as db:
        assert await db.scalar(select(func.count()).select_from(AdminUser)) == 0
    # Customer credentials do not work on the admin login, and customer cookies grant no admin access.
    r = await new_client().post("/api/v1/admin/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 401
    for path in ("/api/v1/admin/auth/me", "/api/v1/admin/dashboard", "/api/v1/admin/users"):
        r = await client.get(path)
        assert r.status_code == 401, path
        assert r.json()["error"]["code"] == "admin_auth_required"
    r = await client.put("/api/v1/admin/settings", json={"registration_enabled": False})
    assert r.status_code == 401


async def test_user_access_token_cannot_be_used_as_admin_cookie(client, new_client):
    await signup_and_login(client)
    access = _cookie(client, "cs_access")
    r = await new_client().get("/api/v1/admin/dashboard", headers={"cookie": f"cs_admin={access}"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "admin_session_expired"


async def test_admin_login_logout_and_audit(client):
    await create_admin("Ops@Example.com")
    body = await admin_login(client, "ops@example.com")
    assert body["status"] == "authenticated" and body["admin"]["role"] == "super_admin"
    assert _cookie(client, "cs_admin")
    assert (await client.get("/api/v1/admin/auth/me")).json()["email"] == "ops@example.com"
    assert (await client.get("/api/v1/admin/dashboard")).status_code == 200
    r = await client.post("/api/v1/admin/auth/logout")
    assert r.status_code == 200
    assert (await client.get("/api/v1/admin/dashboard")).status_code == 401
    assert await _audit_actions() == ["admin.login", "admin.logout"]


async def test_admin_mfa_flow(client, new_client):
    await create_admin("mfa@example.com")
    await admin_login(client, "mfa@example.com")
    setup = await client.post("/api/v1/admin/auth/mfa/setup")
    assert setup.status_code == 200, setup.text
    secret = setup.json()["secret"]
    assert setup.json()["otpauth_uri"].startswith("otpauth://totp/")
    async with session_scope() as db:
        row = await db.scalar(select(AdminUser).where(AdminUser.email == "mfa@example.com"))
        assert row.mfa_secret_encrypted and secret not in row.mfa_secret_encrypted  # encrypted at rest

    bad = await client.post("/api/v1/admin/auth/mfa/enable", json={"code": "000000"})
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "invalid_mfa"
    ok = await client.post("/api/v1/admin/auth/mfa/enable", json={"code": pyotp.TOTP(secret).now()})
    assert ok.status_code == 200 and ok.json()["mfa_enabled"] is True

    c2 = new_client()
    step1 = await c2.post("/api/v1/admin/auth/login", json={"email": "mfa@example.com", "password": ADMIN_PW})
    assert step1.status_code == 200 and step1.json() == {"status": "mfa_required"}
    assert _cookie(c2, "cs_admin") is None
    wrong = await c2.post("/api/v1/admin/auth/login",
                          json={"email": "mfa@example.com", "password": ADMIN_PW, "mfa_code": "123456"})
    assert wrong.status_code == 401 and wrong.json()["error"]["code"] == "invalid_mfa"
    good = await c2.post("/api/v1/admin/auth/login",
                         json={"email": "mfa@example.com", "password": ADMIN_PW, "mfa_code": pyotp.TOTP(secret).now()})
    assert good.status_code == 200 and good.json()["status"] == "authenticated"
    assert (await c2.get("/api/v1/admin/dashboard")).status_code == 200
    actions = await _audit_actions()
    assert "admin.mfa_enabled" in actions and "admin.mfa_failed" in actions


async def test_admin_lockout_after_five_failures(client):
    await create_admin("lock@example.com")
    for _ in range(5):
        r = await client.post("/api/v1/admin/auth/login", json={"email": "lock@example.com", "password": "wrong-pass"})
        assert r.status_code == 401
    r = await client.post("/api/v1/admin/auth/login", json={"email": "lock@example.com", "password": ADMIN_PW})
    assert r.status_code == 403 and r.json()["error"]["code"] == "admin_locked"
    async with session_scope() as db:
        admin = await db.scalar(select(AdminUser).where(AdminUser.email == "lock@example.com"))
        assert admin.locked_until is not None
        failures = await db.scalar(select(func.count()).select_from(AdminAuditLog)
                                   .where(AdminAuditLog.action == "admin.login_failed"))
    assert failures == 5


async def test_read_only_admin_cannot_mutate(client, account_factory):
    user = await account_factory()
    await create_admin("viewer@ops.example.com", role="read_only")
    await admin_login(client, "viewer@ops.example.com")
    assert (await client.get("/api/v1/admin/users")).status_code == 200
    assert (await client.get("/api/v1/admin/settings")).status_code == 200
    mutations = [
        ("PUT", "/api/v1/admin/settings", {"registration_enabled": False}),
        ("POST", f"/api/v1/admin/users/{user.user_id}/suspend", {"reason": "x"}),
        ("POST", "/api/v1/admin/announcements", {"title": "Hi", "body": "There"}),
        ("POST", "/api/v1/admin/admins", {"email": "new@ops.example.com", "full_name": "N", "role": "super_admin",
                                          "password": "Another-Strong-Pass1"}),
    ]
    for method, path, body in mutations:
        r = await client.request(method, path, json=body)
        assert r.status_code == 403, f"{method} {path}: {r.text}"
        assert r.json()["error"]["code"] == "admin_forbidden"
    async with session_scope() as db:
        u = await db.get(User, uuid.UUID(user.user_id))
        assert u.status == "active"
        assert await db.scalar(select(func.count()).select_from(AdminUser)) == 1


async def test_support_admin_can_suspend_but_not_ban(client, account_factory):
    user = await account_factory()
    await create_admin("support@ops.example.com", role="support_admin")
    await admin_login(client, "support@ops.example.com")
    r = await client.post(f"/api/v1/admin/users/{user.user_id}/ban", json={"reason": "spam"})
    assert r.status_code == 403
    r = await client.post(f"/api/v1/admin/users/{user.user_id}/suspend", json={"reason": "chargeback"})
    assert r.status_code == 200 and r.json()["status"] == "suspended"
    # Suspension revokes the user's sessions immediately.
    me = await user.client.get("/api/v1/auth/me")
    assert me.status_code == 401
    async with session_scope() as db:
        log = await db.scalar(select(AdminAuditLog).where(AdminAuditLog.action == "user.suspend"))
        assert log.target_id == user.user_id and log.meta["reason"] == "chargeback"
        assert log.admin_email == "support@ops.example.com"
    # A suspended user cannot sign in.
    r = await user.client.post("/api/v1/auth/login", json={"email": user.email, "password": PASSWORD})
    assert r.status_code == 403 and r.json()["error"]["code"] == "account_suspended"


async def test_every_mutation_is_audited(client, account_factory):
    user = await account_factory()
    await create_admin("root@ops.example.com")
    await admin_login(client, "root@ops.example.com")
    subs = (await client.get("/api/v1/admin/subscriptions")).json()["items"]
    sub_id = next(s["id"] for s in subs if s["workspace_id"] == user.workspace_id)

    steps = [
        ("POST", f"/api/v1/admin/subscriptions/{sub_id}/adjust", {"plan_code": "starter", "reason": "goodwill"},
         "subscription.adjusted"),
        ("PUT", "/api/v1/admin/settings", {"maintenance_mode": True}, "settings.updated"),
        ("POST", f"/api/v1/admin/users/{user.user_id}/ban", {"reason": "abuse"}, "user.ban"),
        ("POST", f"/api/v1/admin/users/{user.user_id}/reactivate", {}, "user.reactivate"),
        ("POST", f"/api/v1/admin/workspaces/{user.workspace_id}/suspend", {"reason": "fraud"}, None),
    ]
    for method, path, body, action in steps:
        before = len(await _audit_actions())
        r = await client.request(method, path, json=body)
        assert r.status_code == 200, f"{method} {path}: {r.text}"
        actions = await _audit_actions()
        assert len(actions) == before + 1, f"{path} wrote no audit log"
        if action:
            assert actions[-1] == action
    bad = await client.put("/api/v1/admin/settings", json={"max_upload_mb": "lots"})
    assert bad.status_code == 400
    # The ban revoked the user's sessions; after reactivation they can sign in again,
    # but the suspended workspace stays blocked for its members.
    assert (await user.client.get("/api/v1/projects")).status_code == 401
    login = await user.client.post("/api/v1/auth/login", json={"email": user.email, "password": PASSWORD})
    assert login.status_code == 200
    r = await user.client.get("/api/v1/projects")
    assert r.status_code == 403 and r.json()["error"]["code"] == "workspace_suspended"
    logs = await client.get("/api/v1/admin/audit-logs")
    assert logs.status_code == 200 and logs.json()["total"] >= len(steps)


async def test_admin_registration_toggle_blocks_signup(client, new_client):
    await create_admin("root@ops.example.com")
    await admin_login(client, "root@ops.example.com")
    r = await client.put("/api/v1/admin/settings", json={"registration_enabled": False})
    assert r.status_code == 200
    s = await new_client().post("/api/v1/auth/signup", json={"full_name": "Late", "email": unique_email(),
                                                             "password": PASSWORD, "accept_terms": True})
    assert s.status_code == 403 and s.json()["error"]["code"] == "registration_closed"


async def test_admin_csrf_required(client):
    await create_admin("root@ops.example.com")
    await admin_login(client, "root@ops.example.com")
    client.csrf_enabled = False
    r = await client.put("/api/v1/admin/settings", json={"maintenance_mode": True})
    assert r.status_code == 403 and r.json()["error"]["code"] == "csrf_failed"


async def test_bootstrap_endpoint(client, monkeypatch):
    r = await client.post("/api/v1/admin/auth/bootstrap", json={
        "email": "first@ops.example.com", "password": "Bootstrap-Pass-123", "bootstrap_secret": "anything"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "bootstrap_disabled"

    monkeypatch.setattr(settings, "admin_bootstrap_email", "first@ops.example.com")
    monkeypatch.setattr(settings, "admin_bootstrap_secret", "s3cret-bootstrap-value")
    bad = await client.post("/api/v1/admin/auth/bootstrap", json={
        "email": "first@ops.example.com", "password": "Bootstrap-Pass-123", "bootstrap_secret": "wrong"})
    assert bad.status_code == 403 and bad.json()["error"]["code"] == "bootstrap_invalid"
    other = await client.post("/api/v1/admin/auth/bootstrap", json={
        "email": "attacker@example.com", "password": "Bootstrap-Pass-123", "bootstrap_secret": "s3cret-bootstrap-value"})
    assert other.status_code == 403 and other.json()["error"]["code"] == "bootstrap_invalid"

    ok = await client.post("/api/v1/admin/auth/bootstrap", json={
        "email": "first@ops.example.com", "password": "Bootstrap-Pass-123", "bootstrap_secret": "s3cret-bootstrap-value"})
    assert ok.status_code == 200, ok.text
    again = await client.post("/api/v1/admin/auth/bootstrap", json={
        "email": "first@ops.example.com", "password": "Bootstrap-Pass-123", "bootstrap_secret": "s3cret-bootstrap-value"})
    assert again.status_code == 403 and again.json()["error"]["code"] == "bootstrap_closed"
    async with session_scope() as db:
        admins = (await db.scalars(select(AdminUser))).all()
    assert [(a.email, a.role) for a in admins] == [("first@ops.example.com", "super_admin")]
    assert "admin.bootstrap" in await _audit_actions()
    await admin_login(client, "first@ops.example.com", "Bootstrap-Pass-123")


async def test_bootstrap_refused_when_admin_exists(client, monkeypatch):
    await create_admin("existing@ops.example.com")
    monkeypatch.setattr(settings, "admin_bootstrap_email", "first@ops.example.com")
    monkeypatch.setattr(settings, "admin_bootstrap_secret", "s3cret-bootstrap-value")
    r = await client.post("/api/v1/admin/auth/bootstrap", json={
        "email": "first@ops.example.com", "password": "Bootstrap-Pass-123", "bootstrap_secret": "s3cret-bootstrap-value"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "bootstrap_closed"
