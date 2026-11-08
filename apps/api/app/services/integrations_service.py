"""Integration marketplace. Only official/approved access methods; providers needing approval are clearly marked."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import uuid
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError, NotFound
from app.core.security import decrypt_secret, encrypt_secret, utcnow
from app.models import Integration, IntegrationSyncLog, Lead

log = logging.getLogger(__name__)

# availability: builtin (always on) | available (self-serve) | requires_approval (needs platform API approval)
CATALOG: list[dict[str, Any]] = [
    {
        "provider": "csv_upload", "name": "CSV upload", "category": "Files", "availability": "builtin",
        "description": "Upload review exports as CSV from any platform you have access to.",
        "capabilities": ["Import reviews", "Auto column mapping", "Duplicate detection"],
        "setup": ["Export reviews from your platform or reviews app as CSV.",
                  "Open Review Intelligence → Import and upload the file.",
                  "Required column: review text. Optional: rating, date, reviewer, platform, business, product."],
    },
    {
        "provider": "excel_upload", "name": "Excel upload", "category": "Files", "availability": "builtin",
        "description": "Import .xlsx spreadsheets of reviews.",
        "capabilities": ["Import reviews", "Auto column mapping"],
        "setup": ["Use the first sheet with a header row.", "Upload from Review Intelligence → Import."],
    },
    {
        "provider": "reviews_api", "name": "Reviews API", "category": "Developer", "availability": "available",
        "description": "Push reviews from your own systems with a workspace API key.",
        "capabilities": ["POST /api/v1/ingest/reviews", "Per-project ingestion", "Optional auto-analysis"],
        "setup": ["Click Connect to generate an API key (shown once).",
                  "Send POST /api/v1/ingest/reviews with header 'Authorization: Bearer <key>' and a JSON body "
                  "{project_id, reviews:[{text, rating, review_date, reviewer_name, platform}], analyze: true}."],
        "fields": [{"name": "key_name", "label": "Key name", "type": "text", "required": False}],
    },
    {
        "provider": "webhooks", "name": "Webhooks", "category": "Developer", "availability": "available",
        "description": "Receive signed HTTP callbacks when analyses finish, alerts fire or leads change.",
        "capabilities": ["analysis.completed", "monitoring.triggered", "report.ready", "lead.status_changed"],
        "setup": ["Enter an HTTPS endpoint URL.",
                  "Verify the X-CustomerSignal-Signature header: HMAC-SHA256 of the raw body with your signing secret."],
        "fields": [{"name": "url", "label": "Endpoint URL", "type": "url", "required": True}],
    },
    {
        "provider": "hubspot", "name": "HubSpot CRM", "category": "CRM", "availability": "available",
        "description": "Sync Opportunity Finder leads to HubSpot as companies and contacts.",
        "capabilities": ["Create companies", "Create contacts", "One-click lead sync"],
        "setup": ["In HubSpot: Settings → Integrations → Private Apps → Create app.",
                  "Grant scopes crm.objects.companies.write and crm.objects.contacts.write.",
                  "Paste the private app access token here."],
        "fields": [{"name": "access_token", "label": "Private app access token", "type": "password", "required": True}],
    },
    {
        "provider": "google_business_profile", "name": "Google Business Profile", "category": "Review platforms",
        "availability": "requires_approval",
        "description": "Sync reviews for locations you manage via the official Business Profile API.",
        "capabilities": ["Sync reviews for owned locations", "Scheduled sync"],
        "setup": ["Google requires API access approval for the Business Profile APIs "
                  "(https://developers.google.com/my-business/content/prereqs).",
                  "Until approved: export reviews (e.g. via Google Takeout for your Business Profile) and use CSV upload.",
                  "Once approved, an administrator configures the OAuth client in Admin → Integrations."],
    },
    {
        "provider": "amazon_sp_api", "name": "Amazon Selling Partner API", "category": "Marketplaces",
        "availability": "requires_approval",
        "description": "Use authorized Selling Partner data for your own products.",
        "capabilities": ["Product catalog", "Customer feedback for your listings (where permitted)"],
        "setup": ["Register as a Selling Partner API developer and obtain approval.",
                  "Until then, use CSV upload with review data you are authorized to use.",
                  "CustomerSignal AI does not scrape Amazon or bypass platform restrictions."],
    },
    {
        "provider": "shopify", "name": "Shopify", "category": "Ecommerce", "availability": "requires_approval",
        "description": "Shopify has no native reviews API; most stores use a reviews app with CSV export.",
        "capabilities": ["Import product reviews via your reviews app's export"],
        "setup": ["Export reviews from your reviews app (e.g. Judge.me, Yotpo, Shopify Product Reviews) as CSV.",
                  "Upload with the product column set so reviews are grouped per product."],
    },
    {
        "provider": "trustpilot", "name": "Trustpilot", "category": "Review management", "availability": "requires_approval",
        "description": "Trustpilot Business API access for your own business units.",
        "capabilities": ["Import service reviews for your business units"],
        "setup": ["Requires a Trustpilot Business plan with API access.",
                  "Until configured, export reviews from Trustpilot Business and upload the CSV."],
    },
    {
        "provider": "salesforce", "name": "Salesforce", "category": "CRM", "availability": "requires_approval",
        "description": "Sync leads to Salesforce (Enterprise plan, custom integration).",
        "capabilities": ["Lead sync"], "setup": ["Contact sales to enable a Salesforce connected app for your org."],
    },
]
CATALOG_BY_PROVIDER = {c["provider"]: c for c in CATALOG}


def catalog_entry(provider: str) -> dict:
    entry = CATALOG_BY_PROVIDER.get(provider)
    if not entry:
        raise NotFound("Unknown integration.")
    return entry


def get_credentials(integration: Integration) -> dict:
    if not integration.credentials_encrypted:
        return {}
    raw = decrypt_secret(integration.credentials_encrypted)
    return json.loads(raw) if raw else {}


def set_credentials(integration: Integration, creds: dict) -> None:
    integration.credentials_encrypted = encrypt_secret(json.dumps(creds))


async def log_sync(db: AsyncSession, integration: Integration, action: str, status: str, message: str,
                   items: int = 0, **details: Any) -> None:
    db.add(IntegrationSyncLog(integration_id=integration.id, workspace_id=integration.workspace_id, action=action,
                              status=status, message=message[:2000], items_processed=items, details=details))
    await db.flush()


def _sign(secret: str, body: bytes) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


async def deliver_webhook_event(db: AsyncSession, workspace_id: uuid.UUID, event: str, data: dict) -> None:
    integ = await db.scalar(select(Integration).where(Integration.workspace_id == workspace_id,
                                                      Integration.provider == "webhooks",
                                                      Integration.status == "connected"))
    if not integ or settings.environment == "test":
        return
    events = integ.config.get("events") or CATALOG_BY_PROVIDER["webhooks"]["capabilities"]
    if event not in events:
        return
    secret = get_credentials(integ).get("signing_secret", "")
    body = json.dumps({"event": event, "workspace_id": str(workspace_id), "created_at": utcnow().isoformat(),
                       "data": data}, default=str).encode()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(integ.config["url"], content=body, headers={
                "content-type": "application/json", "x-customersignal-event": event,
                "x-customersignal-signature": _sign(secret, body)})
        ok = resp.status_code < 300
        await log_sync(db, integ, "deliver", "success" if ok else "error", f"{event} → HTTP {resp.status_code}")
        integ.last_sync_at = utcnow()
        integ.last_error = None if ok else f"HTTP {resp.status_code}"
    except httpx.HTTPError as exc:
        await log_sync(db, integ, "deliver", "error", f"{event} → {exc}")
        integ.last_error = str(exc)[:500]


async def hubspot_request(token: str, method: str, path: str, payload: dict | None = None) -> httpx.Response:
    async with httpx.AsyncClient(timeout=15, base_url="https://api.hubapi.com") as client:
        return await client.request(method, path, json=payload, headers={"Authorization": f"Bearer {token}"})


async def test_hubspot(token: str) -> None:
    try:
        resp = await hubspot_request(token, "GET", "/crm/v3/objects/companies?limit=1")
    except httpx.HTTPError as exc:
        raise AppError(f"Could not reach HubSpot: {exc}", code="integration_error")
    if resp.status_code == 401:
        raise AppError("HubSpot rejected the token (401). Check the private app token.", code="integration_auth")
    if resp.status_code >= 300:
        raise AppError(f"HubSpot error {resp.status_code}: {resp.text[:200]}", code="integration_error")


async def push_lead_to_hubspot(db: AsyncSession, integ: Integration, lead: Lead) -> dict:
    token = get_credentials(integ).get("access_token")
    if not token:
        raise AppError("HubSpot is not connected.", code="integration_not_connected")
    domain = (lead.website or "").replace("https://", "").replace("http://", "").split("/")[0] or None
    props = {k: v for k, v in {"name": lead.business_name, "domain": domain, "city": lead.city,
                                "country": lead.country,
                                "description": (lead.executive_summary or "")[:1000]}.items() if v}
    resp = await hubspot_request(token, "POST", "/crm/v3/objects/companies", {"properties": props})
    if resp.status_code >= 300:
        await log_sync(db, integ, "sync", "error", f"Company create failed: HTTP {resp.status_code} {resp.text[:300]}")
        raise AppError(f"HubSpot error {resp.status_code}", code="integration_error")
    company_id = resp.json().get("id")
    contact_id = None
    if lead.contact_email:
        first, _, last = (lead.contact_name or "").partition(" ")
        c = await hubspot_request(token, "POST", "/crm/v3/objects/contacts", {"properties": {
            "email": lead.contact_email, "firstname": first or None, "lastname": last or None}})
        if c.status_code < 300:
            contact_id = c.json().get("id")
    await log_sync(db, integ, "sync", "success", f"Lead '{lead.business_name}' synced (company {company_id}).", 1,
                   company_id=company_id, contact_id=contact_id)
    integ.last_sync_at = utcnow()
    return {"company_id": company_id, "contact_id": contact_id}
