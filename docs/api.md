# API

Interactive OpenAPI docs: `GET /api/docs` (Swagger) and `/api/redoc`; schema at `/api/openapi.json`
(159 paths). Health: `GET /health` (liveness) and `GET /health/ready` (DB + Redis).

## Conventions

- Base path `/api/v1`; JSON bodies validated with Pydantic v2.
- Errors: `{"error": {"code": "...", "message": "...", "details": ...}}` — e.g. `validation_error` (422, with
  per-field details), `unauthorized`/`token_expired` (401), `forbidden`/`insufficient_role`/`workspace_forbidden` (403),
  `not_found` (404), `plan_limit`/`feature_not_in_plan` (402), `rate_limited` (429), `service_not_configured` (503).
- Auth: session cookies (`cs_access`, `cs_refresh`) or `Authorization: Bearer <access token>`; admin uses `cs_admin`.
- Tenancy: `X-Workspace-Id` header (falls back to the user's default workspace).
- CSRF: cookie-authenticated non-GET requests send `x-csrf-token` = `cs_csrf` cookie.
- Pagination: `?page=1&page_size=25` → `{items, total, page, page_size}`; list endpoints support filtering/sorting.
- Rate limits: login, signup, password reset, OAuth, uploads, invitations, contact form, share links, ingest API.

## Customer endpoints (selection)

| Group | Endpoints |
| --- | --- |
| `/auth` | `POST signup, login, logout, refresh, verify-email, resend-verification, forgot-password, reset-password` · `GET me, providers, sessions` · `DELETE sessions/{id}` · `GET google/start, google/callback` |
| `/users` | `GET/PATCH me` · `PUT me/notification-preferences` · `POST me/password` · `GET/PUT me/onboarding` · `GET me/export` · `DELETE me` |
| `/workspaces` | list/create · `POST demo` · `GET/PATCH/DELETE current` · `PUT current/branding` · `POST {id}/default` · `GET current/activity` · custom categories |
| `/projects` | CRUD, search/filter/sort, `archive`, `unarchive`, `{id}/businesses` |
| `/reviews` | list with filters · `semantic-search` · `analytics` · `export` (CSV) · `sources` · `clusters/{id}` · `{id}` · manual `POST` · `POST import` (multipart CSV/XLSX) |
| `/analysis` | `dashboard` · `POST run` · `jobs`, `jobs/{id}`, `jobs/{id}/cancel` · `insights` |
| `/opportunities` | list, detail (with evidence), status update |
| `/gap-finder` | list, create, `{id}/run`, `{id}/report` |
| `/leads` | pipeline list, create (Opportunity Finder), detail, edit, notes, `generate`, `report`, `sync/hubspot`, delete |
| `/competitors` | list, add, update, remove, `comparison`, `analyze` |
| `/reports` | list, create, detail, `download` (PDF), `regenerate`, shares create/revoke, delete |
| `/monitoring` | `rule-types`, rules CRUD, `rules/{id}/evaluate`, `events`, acknowledge |
| `/integrations` | marketplace, `{provider}/connect|disconnect|test|logs`, API keys |
| `/team` | members, invitations (create/resend/revoke/preview/accept), role change, remove/leave |
| `/billing` | overview, `checkout`, `portal`, `cancel`, `resume`, `invoices`, `payments`, `webhook` (Stripe-signed) |
| `/notifications`, `/usage`, `/support` | inbox & read state, monthly usage, support tickets |
| `/ingest/reviews` | API-key authenticated review ingestion (`Authorization: Bearer csk_...`) |
| `/public` | `plans`, `config`, `announcements`, `contact`, `reports/{token}` (+ `/pdf`) |

### Reviews API example

```bash
curl -X POST "$APP_URL/api/v1/ingest/reviews" \
  -H "Authorization: Bearer $CUSTOMERSIGNAL_API_KEY" -H "content-type: application/json" \
  -d '{"project_id":"<uuid>","analyze":true,"reviews":[{"text":"Great service","rating":5,"review_date":"2026-11-01","platform":"Website"}]}'
```

### Webhook signature verification

```python
import hmac, hashlib
expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
assert hmac.compare_digest(expected, request.headers["x-customersignal-signature"])
```

Events: `analysis.completed`, `monitoring.triggered`, `report.ready`, `lead.status_changed`.

## Admin endpoints (`/api/v1/admin`)

`auth/login|logout|me|mfa/setup|mfa/enable|mfa/disable|bootstrap` · `dashboard` · `users` (+ detail, suspend,
reactivate, ban, revoke-sessions, delete, notify) · `workspaces` (+ suspend/restore) · `subscriptions` (+ adjust) ·
`payments` · `invoices` · `revenue` · `plans` · `ai-usage` (+ settings) · `review-analytics` · `projects` · `reports` ·
`integrations` (+ toggle) · `jobs` (+ retry/cancel) · `support` (+ assign/status/messages) · `announcements` ·
`notifications` (+ send) · `email-templates` (+ preview/test) · `audit-logs` · `feature-flags` · `settings` · `admins`.
Each requires a specific permission (see `ADMIN_PERMISSIONS` in `app/api/deps.py`).
