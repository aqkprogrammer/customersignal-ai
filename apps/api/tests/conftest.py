"""Shared fixtures for the CustomerSignal AI API test suite.

Environment variables are set *before* the application is imported so the settings singleton, the database
engine (NullPool in test) and storage pick them up.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]
TEST_DB_URL = os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://localhost/customersignal_test")
_STORAGE_DIR = tempfile.mkdtemp(prefix="cs-test-storage-")

os.environ.update({
    "ENVIRONMENT": "test",
    "DATABASE_URL": TEST_DB_URL,
    "REDIS_URL": "redis://localhost:6379/15",
    "JOBS_INLINE": "true",
    "APP_SECRET_KEY": "test-secret-key-0123456789-abcdefghijklmnopqrstuvwxyz",
    "EMAIL_VERIFICATION_REQUIRED": "false",
    "STRIPE_WEBHOOK_SECRET": "whsec_test_customersignal_secret",
    "STRIPE_SECRET_KEY": "",
    "RESEND_API_KEY": "",
    "ANTHROPIC_API_KEY": "",
    "OPENAI_API_KEY": "",
    "GOOGLE_CLIENT_ID": "test-google-client",
    "GOOGLE_CLIENT_SECRET": "test-google-secret",
    "ADMIN_BOOTSTRAP_EMAIL": "",
    "ADMIN_BOOTSTRAP_SECRET": "",
    "LOCAL_STORAGE_PATH": _STORAGE_DIR,
    "S3_ACCESS_KEY": "",
    "S3_SECRET_KEY": "",
    "S3_BUCKET": "",
})

import asyncio  # noqa: E402
import threading  # noqa: E402
import uuid  # noqa: E402
from collections.abc import AsyncIterator  # noqa: E402
from dataclasses import dataclass  # noqa: E402
from typing import Any  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402
from asgi_lifespan import LifespanManager  # noqa: E402


# ------------------------------------------------------------------------------------------- schema
def _migrate_fresh_schema() -> None:
    """Drop everything in the test DB and run the real Alembic migrations (verifies they work)."""

    async def _reset() -> None:
        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import create_async_engine

        eng = create_async_engine(TEST_DB_URL)
        async with eng.begin() as conn:
            await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
        await eng.dispose()

    def _run() -> None:
        asyncio.run(_reset())
        from alembic import command
        from alembic.config import Config

        cfg = Config(str(API_DIR / "alembic.ini"))
        cfg.set_main_option("script_location", str(API_DIR / "migrations"))
        cfg.attributes["database_url"] = TEST_DB_URL
        command.upgrade(cfg, "head")

    # migrations/env.py calls asyncio.run(); keep it off pytest-asyncio's loop thread.
    errors: list[BaseException] = []

    def _target() -> None:
        try:
            _run()
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    t = threading.Thread(target=_target)
    t.start()
    t.join()
    if errors:
        raise errors[0]


@pytest.fixture(scope="session")
def migrated() -> None:
    _migrate_fresh_schema()


@pytest.fixture(scope="session")
async def app(migrated):
    from app.main import app as fastapi_app

    async with LifespanManager(fastapi_app):
        yield fastapi_app


@pytest.fixture(autouse=True)
async def clean_db(app):
    """Truncate every table, then re-seed reference data (plans, categories, templates, flags, settings)."""
    from sqlalchemy import text

    from app.ai.registry import set_provider_override
    from app.core.database import SessionLocal
    from app.models import Base
    from app.services import settings_service
    from app.services.seed_reference import seed_reference_data

    names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    async with SessionLocal() as db:
        await db.execute(text(f"TRUNCATE TABLE {names} RESTART IDENTITY CASCADE"))
        await seed_reference_data(db)
        await db.commit()
    settings_service.invalidate()
    set_provider_override(None)
    yield
    set_provider_override(None)
    settings_service.invalidate()


# ------------------------------------------------------------------------------------------- jobs
ENQUEUE_MODULES = (
    "app.workers.jobs",
    "app.api.v1.routes.misc",
    "app.api.v1.routes.analysis",
    "app.api.v1.routes.reviews",
    "app.api.v1.routes.reports",
    "app.api.v1.routes.leads",
    "app.api.v1.routes.opportunities",
    "app.api.v1.routes.competitors",
    "app.api.v1.admin.routes",
)


class JobQueue:
    """Records enqueued job ids instead of spawning background tasks, so tests run jobs deterministically."""

    def __init__(self) -> None:
        self.ids: list[str] = []

    async def enqueue(self, job_id, defer_seconds: float = 0) -> str:
        self.ids.append(str(job_id))
        return "test"

    async def drain(self, max_runs: int = 50) -> dict[str, str]:
        from app.workers.jobs import run_job

        results: dict[str, str] = {}
        runs = 0
        while self.ids:
            runs += 1
            assert runs <= max_runs, "job queue did not settle"
            jid = self.ids.pop(0)
            results[jid] = await run_job(jid)
        return results


@pytest.fixture(autouse=True)
def jobs(monkeypatch) -> JobQueue:
    import importlib

    q = JobQueue()
    for mod_name in ENQUEUE_MODULES:
        monkeypatch.setattr(importlib.import_module(mod_name), "enqueue", q.enqueue)
    return q


# ------------------------------------------------------------------------------------------- email capture
@pytest.fixture
def sent_emails(monkeypatch) -> list[dict[str, Any]]:
    """Capture template emails (raw tokens only ever exist in the email variables)."""
    from app.services import email_service

    captured: list[dict[str, Any]] = []
    original = email_service.send_template

    async def _capture(db, to, key, variables):
        captured.append({"to": to, "key": key, "variables": dict(variables)})
        return await original(db, to, key, variables)

    monkeypatch.setattr(email_service, "send_template", _capture)
    return captured


def token_from(emails: list[dict[str, Any]], key: str, var: str) -> str:
    matches = [e for e in emails if e["key"] == key]
    assert matches, f"no '{key}' email was sent (sent: {[e['key'] for e in emails]})"
    url = str(matches[-1]["variables"][var])
    return url.split("token=")[-1] if "token=" in url else url.rstrip("/").rsplit("/", 1)[-1]


# ------------------------------------------------------------------------------------------- clients
def _cookie(client: httpx.AsyncClient, name: str) -> str | None:
    for c in client.cookies.jar:
        if c.name == name:
            return c.value
    return None


def make_client(app) -> httpx.AsyncClient:
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
    client.csrf_enabled = True  # type: ignore[attr-defined]

    async def _csrf(request: httpx.Request) -> None:
        if not getattr(client, "csrf_enabled", True) or "x-csrf-token" in request.headers:
            return
        token = _cookie(client, "cs_csrf")
        if token:
            request.headers["x-csrf-token"] = token

    client.event_hooks["request"].append(_csrf)
    return client


@pytest.fixture
async def new_client(app) -> AsyncIterator:
    clients: list[httpx.AsyncClient] = []

    def _factory() -> httpx.AsyncClient:
        c = make_client(app)
        clients.append(c)
        return c

    yield _factory
    for c in clients:
        await c.aclose()


@pytest.fixture
async def client(new_client) -> httpx.AsyncClient:
    return new_client()


@dataclass
class Account:
    client: httpx.AsyncClient
    email: str
    password: str
    user_id: str
    workspace_id: str

    def headers(self, workspace_id: str | None = None) -> dict[str, str]:
        return auth_headers(workspace_id or self.workspace_id)


def auth_headers(workspace_id: str) -> dict[str, str]:
    return {"x-workspace-id": str(workspace_id)}


PASSWORD = "Sup3rSecret-pass"


def unique_email(prefix: str = "user") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


async def signup_and_login(client: httpx.AsyncClient, email: str | None = None, password: str = PASSWORD,
                           full_name: str = "Test User", company_name: str | None = None) -> Account:
    email = email or unique_email()
    r = await client.post("/api/v1/auth/signup", json={
        "full_name": full_name, "email": email, "password": password, "company_name": company_name,
        "accept_terms": True})
    assert r.status_code == 201, r.text
    body = r.json()
    if body["status"] != "authenticated":
        r = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert r.status_code == 200, r.text
        body = r.json()
    ws_id = body["workspaces"][0]["id"]
    client.headers["x-workspace-id"] = ws_id
    return Account(client=client, email=email, password=password, user_id=body["user"]["id"], workspace_id=ws_id)


@pytest.fixture
def account_factory(new_client):
    async def _make(email: str | None = None, **kw) -> Account:
        return await signup_and_login(new_client(), email, **kw)

    return _make


# ------------------------------------------------------------------------------------------- DB helpers
async def set_plan(workspace_id: str, plan_code: str) -> None:
    from sqlalchemy import select

    from app.core.database import session_scope
    from app.models import Subscription, SubscriptionPlan

    async with session_scope() as db:
        plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == plan_code))
        sub = await db.scalar(select(Subscription).where(Subscription.workspace_id == uuid.UUID(workspace_id)))
        sub.plan_id = plan.id
        sub.status = "active"


async def add_member(workspace_id: str, user_id: str, role: str) -> str:
    from app.core.database import session_scope
    from app.models import WorkspaceMember

    async with session_scope() as db:
        m = WorkspaceMember(workspace_id=uuid.UUID(workspace_id), user_id=uuid.UUID(user_id), role=role)
        db.add(m)
        await db.flush()
        return str(m.id)


async def create_admin(email: str, password: str = "Adm1n-Password-Strong", role: str = "super_admin") -> str:
    from app.core.database import session_scope
    from app.core.security import hash_password
    from app.models import AdminUser

    async with session_scope() as db:
        a = AdminUser(email=email.lower(), full_name="Admin", password_hash=hash_password(password), role=role)
        db.add(a)
        await db.flush()
        return str(a.id)


async def admin_login(client: httpx.AsyncClient, email: str, password: str = "Adm1n-Password-Strong") -> dict:
    r = await client.post("/api/v1/admin/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


async def create_project(acct: Account, name: str = "Cafe Uno", **extra) -> dict:
    r = await acct.client.post("/api/v1/projects", json={"name": name, "business_name": name, **extra})
    assert r.status_code == 201, r.text
    return r.json()


async def upload_reviews(acct: Account, project_id: str, content: bytes, filename: str = "reviews.csv",
                         auto_analyze: bool = False) -> dict:
    ctype = "text/csv" if filename.endswith(".csv") else \
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    r = await acct.client.post(
        "/api/v1/reviews/import", files={"file": (filename, content, ctype)},
        data={"project_id": project_id, "auto_analyze": "true" if auto_analyze else "false"})
    assert r.status_code == 202, r.text
    return r.json()


SAMPLE_CSV = (
    b"review_text,rating,date,reviewer\n"
    b"\"The staff were rude and we waited over an hour for our food.\",1,2026-10-01,Alice\n"
    b"\"Great coffee and friendly staff, highly recommend!\",5,2026-10-02,Bob\n"
    b"\"Prices are too expensive for the tiny portion size.\",2,2026-10-03,Carl\n"
    b"\"Terrible waiting time, we waited 45 minutes for a table.\",2,2026-10-04,Dana\n"
    b"\"Great coffee and friendly staff, highly recommend!\",5,2026-10-02,Bob\n"
    b"\"\",4,2026-10-05,Eve\n"
    b"\"Lovely place but slow\",abc,2026-10-06,Fay\n"
)
