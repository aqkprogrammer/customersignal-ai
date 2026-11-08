# Testing

## Backend — pytest (95 tests)

```bash
createdb customersignal_test        # once
cd apps/api && .venv/bin/pytest -q
```

The suite runs real Alembic migrations against `customersignal_test`, truncates between tests, uses the
`MockProvider` (no AI charges) and never calls Stripe. Coverage includes auth (signup, login, refresh rotation,
logout, verification, reset, Google upsert/callback rejection, open-redirect protection), CSRF, tenant isolation and
role checks, plan entitlements, CSV/Excel ingestion with dedupe and invalid rows, the full analysis pipeline,
anti-fabrication of excerpts, provider-failure fallback, CSV formula-injection protection, reports + share links,
opportunity finder, gap finder, Stripe webhook signatures/idempotency/lifecycle, and the admin console (MFA, lockout,
role permissions, audit logging, bootstrap).

## Frontend — Vitest (26 tests)

```bash
cd apps/web && pnpm test
```

Form validation schemas, the API client (CSRF/workspace headers, 401 refresh-and-retry, typed errors), shared
components (badges, empty/error/plan-restricted states) and utilities.

## End-to-end — Playwright (9 tests)

Start the stack, then:

```bash
cd apps/web
E2E_BASE_URL=http://localhost:3000 pnpm test:e2e
```

| Env | Enables |
| --- | --- |
| *(none)* | Public site, pricing from API, route protection, form validation, failed login, sitemap/robots |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Admin login, user management, audit trail (account without MFA) |
| `E2E_FULL_FLOW=1` | Signup → onboarding → project → CSV upload → background analysis → PDF report → logout → login. Run the API with `EMAIL_VERIFICATION_REQUIRED=false` and a worker (or `JOBS_INLINE=true`). |

Install browsers once with `pnpm exec playwright install chromium`.
