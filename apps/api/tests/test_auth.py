from __future__ import annotations

import uuid

import pytest
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import session_scope
from app.core.security import hash_token, sign_value
from app.models import AuthToken, User, UserSession, Workspace, WorkspaceMember
from app.services import auth_service
from tests.conftest import PASSWORD, _cookie, signup_and_login, token_from, unique_email

SIGNUP = "/api/v1/auth/signup"
LOGIN = "/api/v1/auth/login"


def signup_body(**over):
    return {"full_name": "Jane Doe", "email": unique_email(), "password": PASSWORD, "accept_terms": True, **over}


# ----------------------------------------------------------------------------------------------- signup
async def test_signup_creates_user_workspace_and_session(client):
    body = signup_body(company_name="Acme Cafe")
    r = await client.post(SIGNUP, json=body)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["status"] == "authenticated"
    assert data["user"]["email"] == body["email"]
    assert data["user"]["email_verified"] is True  # verification disabled in this test config
    assert [w["role"] for w in data["workspaces"]] == ["owner"]
    assert data["workspaces"][0]["name"] == "Acme Cafe"
    assert _cookie(client, "cs_access") and _cookie(client, "cs_refresh") and _cookie(client, "cs_csrf")
    # Password is stored hashed.
    async with session_scope() as db:
        user = await db.scalar(select(User).where(User.email == body["email"]))
        assert user.password_hash and PASSWORD not in user.password_hash


@pytest.mark.parametrize(
    ("override", "status", "code"),
    [
        ({"email": "not-an-email"}, 422, "validation_error"),
        ({"password": "short1"}, 422, "validation_error"),
        ({"full_name": ""}, 422, "validation_error"),
        ({"password": "onlyletterspassword"}, 400, "weak_password"),
        ({"password": "1234567890123"}, 400, "weak_password"),
        ({"accept_terms": False}, 400, "terms_required"),
    ],
)
async def test_signup_validation(client, override, status, code):
    r = await client.post(SIGNUP, json=signup_body(**override))
    assert r.status_code == status, r.text
    assert r.json()["error"]["code"] == code


async def test_signup_duplicate_email_is_409_case_insensitive(client, new_client):
    body = signup_body()
    assert (await client.post(SIGNUP, json=body)).status_code == 201
    r = await new_client().post(SIGNUP, json={**body, "email": body["email"].upper()})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "email_taken"


# ------------------------------------------------------------------------------------------------ login
async def test_login_success_and_failures(client, new_client):
    acct = await signup_and_login(client)
    c2 = new_client()
    r = await c2.post(LOGIN, json={"email": acct.email, "password": PASSWORD})
    assert r.status_code == 200
    assert r.json()["user"]["id"] == acct.user_id

    bad = await new_client().post(LOGIN, json={"email": acct.email, "password": "Wrong-pass-123"})
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "invalid_credentials"
    unknown = await new_client().post(LOGIN, json={"email": unique_email(), "password": PASSWORD})
    assert unknown.status_code == 401
    assert unknown.json()["error"]["code"] == "invalid_credentials"  # no user enumeration


async def test_me_requires_auth(client, new_client):
    r = await new_client().get("/api/v1/auth/me")
    assert r.status_code == 401
    acct = await signup_and_login(client)
    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["email"] == acct.email
    assert me.json()["workspaces"][0]["id"] == acct.workspace_id


async def test_refresh_rotates_token_and_old_token_stops_working(client, new_client):
    await signup_and_login(client)
    old_refresh = _cookie(client, "cs_refresh")
    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 200, r.text
    new_refresh = _cookie(client, "cs_refresh")
    assert new_refresh and new_refresh != old_refresh

    replay = await new_client().post("/api/v1/auth/refresh", headers={"cookie": f"cs_refresh={old_refresh}"})
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "session_expired"
    # The rotated token still works.
    ok = await new_client().post("/api/v1/auth/refresh", headers={"cookie": f"cs_refresh={new_refresh}"})
    assert ok.status_code == 200


async def test_logout_revokes_session(client, new_client):
    await signup_and_login(client)
    access = _cookie(client, "cs_access")
    r = await client.post("/api/v1/auth/logout")
    assert r.status_code == 200, r.text
    reuse = await new_client().get("/api/v1/auth/me", headers={"cookie": f"cs_access={access}"})
    assert reuse.status_code == 401
    assert reuse.json()["error"]["code"] == "session_revoked"


async def test_bearer_token_bound_to_session(client, new_client):
    await signup_and_login(client)
    access = _cookie(client, "cs_access")
    r = await new_client().get("/api/v1/auth/me", headers={"authorization": f"Bearer {access}"})
    assert r.status_code == 200
    forged = await new_client().get("/api/v1/auth/me", headers={"authorization": "Bearer not-a-jwt"})
    assert forged.status_code == 401


# ------------------------------------------------------------------------------------- email verification
async def test_email_verification_flow(client, new_client, sent_emails, monkeypatch):
    monkeypatch.setattr(settings, "email_verification_required", True)
    body = signup_body()
    r = await client.post(SIGNUP, json=body)
    assert r.status_code == 201
    assert r.json() == {"status": "verification_required", "email": body["email"]}
    assert _cookie(client, "cs_access") is None

    blocked = await new_client().post(LOGIN, json={"email": body["email"], "password": PASSWORD})
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "email_not_verified"

    raw = token_from(sent_emails, "verify_email", "verify_url")
    async with session_scope() as db:
        rows = (await db.scalars(select(AuthToken).where(AuthToken.purpose == "verify_email"))).all()
    assert len(rows) == 1
    assert rows[0].token_hash != raw and rows[0].token_hash == hash_token(raw)  # stored hashed only

    v = await new_client().post("/api/v1/auth/verify-email", json={"token": raw})
    assert v.status_code == 200, v.text
    assert v.json()["status"] == "verified"
    assert v.json()["user"]["email_verified"] is True

    again = await new_client().post("/api/v1/auth/verify-email", json={"token": raw})
    assert again.status_code == 400
    assert again.json()["error"]["code"] == "invalid_token"
    ok = await new_client().post(LOGIN, json={"email": body["email"], "password": PASSWORD})
    assert ok.status_code == 200


async def test_resend_verification_invalidates_previous_token(client, new_client, sent_emails, monkeypatch):
    monkeypatch.setattr(settings, "email_verification_required", True)
    body = signup_body()
    await client.post(SIGNUP, json=body)
    first = token_from(sent_emails, "verify_email", "verify_url")
    r = await client.post("/api/v1/auth/resend-verification", json={"email": body["email"]})
    assert r.status_code == 200
    second = token_from(sent_emails, "verify_email", "verify_url")
    assert first != second
    assert (await new_client().post("/api/v1/auth/verify-email", json={"token": first})).status_code == 400
    assert (await new_client().post("/api/v1/auth/verify-email", json={"token": second})).status_code == 200


# ------------------------------------------------------------------------------------------ password reset
async def test_password_reset_revokes_all_sessions(client, new_client, sent_emails):
    acct = await signup_and_login(client)
    other = new_client()
    assert (await other.post(LOGIN, json={"email": acct.email, "password": PASSWORD})).status_code == 200

    r = await new_client().post("/api/v1/auth/forgot-password", json={"email": acct.email})
    assert r.status_code == 200
    # Unknown emails get the same response (no enumeration) and no email.
    n = len(sent_emails)
    r2 = await new_client().post("/api/v1/auth/forgot-password", json={"email": unique_email()})
    assert r2.status_code == 200 and r2.json() == r.json()
    assert len(sent_emails) == n

    token = token_from(sent_emails, "reset_password", "reset_url")
    weak = await new_client().post("/api/v1/auth/reset-password", json={"token": token, "password": "weakweakweak"})
    assert weak.status_code == 400 and weak.json()["error"]["code"] == "weak_password"
    new_pw = "Brand-new-passw0rd"
    ok = await new_client().post("/api/v1/auth/reset-password", json={"token": token, "password": new_pw})
    assert ok.status_code == 200, ok.text

    for c in (client, other):
        me = await c.get("/api/v1/auth/me")
        assert me.status_code == 401
    async with session_scope() as db:
        active = await db.scalar(select(func.count()).select_from(UserSession).where(
            UserSession.user_id == uuid.UUID(acct.user_id), UserSession.revoked_at.is_(None)))
    assert active == 0
    assert (await new_client().post(LOGIN, json={"email": acct.email, "password": PASSWORD})).status_code == 401
    assert (await new_client().post(LOGIN, json={"email": acct.email, "password": new_pw})).status_code == 200
    reuse = await new_client().post("/api/v1/auth/reset-password", json={"token": token, "password": new_pw + "x"})
    assert reuse.status_code == 400


# ------------------------------------------------------------------------------------------- Google OAuth
async def _counts(email: str) -> tuple[int, int]:
    async with session_scope() as db:
        users = await db.scalar(select(func.count()).select_from(User).where(User.email == email))
        wss = await db.scalar(select(func.count()).select_from(Workspace).join(User, User.id == Workspace.owner_id)
                              .where(User.email == email))
    return int(users), int(wss)


async def test_upsert_google_user_creates_exactly_one_user_and_workspace():
    email = unique_email("google")
    async with session_scope() as db:
        user, created = await auth_service.upsert_google_user(db, sub="g-sub-1", email=email.upper(),
                                                              email_verified=True, name="Gina Google", picture=None)
        assert created is True
        assert user.email == email and user.email_verified_at is not None
        uid = user.id
    async with session_scope() as db:
        user2, created2 = await auth_service.upsert_google_user(db, sub="g-sub-1", email=email,
                                                                email_verified=True, name="Gina Google", picture=None)
        assert created2 is False and user2.id == uid
    assert await _counts(email) == (1, 1)
    async with session_scope() as db:
        member = await db.scalar(select(WorkspaceMember).where(WorkspaceMember.user_id == uid))
        assert member.role == "owner"


async def test_upsert_google_user_links_existing_email_account(client):
    acct = await signup_and_login(client)
    async with session_scope() as db:
        user, created = await auth_service.upsert_google_user(db, sub="g-sub-link", email=acct.email,
                                                              email_verified=True, name="X", picture=None)
        assert created is False
        assert str(user.id) == acct.user_id
        assert user.google_sub == "g-sub-link"
    assert await _counts(acct.email) == (1, 1)


async def test_upsert_google_user_rejects_unverified_email():
    from app.core.errors import AppError

    async with session_scope() as db:
        with pytest.raises(AppError) as exc:
            await auth_service.upsert_google_user(db, sub="g-x", email=unique_email(), email_verified=False,
                                                  name="X", picture=None)
    assert exc.value.code == "google_email_unverified"


async def test_google_callback_rejects_bad_state(client):
    r = await client.get("/api/v1/auth/google/callback", params={"code": "abc", "state": "whatever"})
    assert r.status_code == 302
    assert "error=invalid_state" in r.headers["location"]

    cookie = sign_value("expected-state|/app")
    r = await client.get("/api/v1/auth/google/callback", params={"code": "abc", "state": "attacker-state"},
                         headers={"cookie": f"cs_oauth_state={cookie}"})
    assert r.status_code == 302 and "error=invalid_state" in r.headers["location"]

    tampered = cookie[:-2] + ("aa" if not cookie.endswith("aa") else "bb")
    r = await client.get("/api/v1/auth/google/callback", params={"code": "abc", "state": "expected-state"},
                         headers={"cookie": f"cs_oauth_state={tampered}"})
    assert r.status_code == 302 and "error=invalid_state" in r.headers["location"]
    assert _cookie(client, "cs_access") is None


async def test_google_start_sets_signed_state_and_safe_next(client):
    r = await client.get("/api/v1/auth/google/start", params={"next": "//evil.example.com"})
    assert r.status_code == 302
    assert r.headers["location"].startswith("https://accounts.google.com/")
    state_cookie = _cookie(client, "cs_oauth_state")
    from app.core.security import unsign_value

    raw = unsign_value(state_cookie.strip('"'))  # value is RFC-quoted ("/" in it); Starlette unquotes it
    assert raw and raw.endswith("|/app")  # open redirect neutralized


# ------------------------------------------------------------------------------------------------ CSRF
async def test_csrf_required_for_cookie_authenticated_mutations(client):
    await signup_and_login(client)
    client.csrf_enabled = False
    r = await client.post("/api/v1/projects", json={"name": "No CSRF"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "csrf_failed"
    r = await client.post("/api/v1/projects", json={"name": "Bad CSRF"}, headers={"x-csrf-token": "forged"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "csrf_failed"
    client.csrf_enabled = True
    r = await client.post("/api/v1/projects", json={"name": "With CSRF"})
    assert r.status_code == 201, r.text


async def test_bearer_auth_without_cookies_is_not_subject_to_csrf(client, new_client):
    acct = await signup_and_login(client)
    access = _cookie(client, "cs_access")
    bare = new_client()
    bare.csrf_enabled = False
    r = await bare.post("/api/v1/projects", json={"name": "API client"},
                        headers={"authorization": f"Bearer {access}", "x-workspace-id": acct.workspace_id})
    assert r.status_code == 201, r.text
