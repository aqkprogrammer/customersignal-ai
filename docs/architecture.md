# Architecture

```
Browser ──► Next.js (Vercel / Node)  ──rewrites /api/v1/*──►  FastAPI (Railway / Render)  ──► PostgreSQL + pgvector
              • marketing (static)                               • REST /api/v1, /api/v1/admin   ──► Redis (rate limits, arq queue)
              • customer app (client)                            • enqueue jobs ───────────────► arq worker(s)
              • admin console (client)                                                              • analysis, imports, reports, monitoring
                                                                 ──► S3-compatible storage (uploads, PDFs)
                                                                 ──► Anthropic / OpenAI, Stripe, Resend, Google, HubSpot
```

## Key decisions

**Same-origin API.** The browser only talks to the Next.js origin; `/api/v1/*` is rewritten to FastAPI
(`API_INTERNAL_URL`, resolved at build time). Session cookies are therefore first-party, `SameSite=Lax`, `HttpOnly`,
and no CORS credentials dance is needed in production.

**Authentication (built-in, provider-equivalent to Supabase Auth).** FastAPI issues a 15-minute JWT access token
(`cs_access`) bound to a server-side `user_sessions` row plus a rotating opaque refresh token (`cs_refresh`, scoped to
`/api/v1/auth`, stored as an HMAC). Every request re-checks the session row, so logout / "sign out other sessions" /
password reset revoke access immediately. Google OAuth uses the authorization-code flow with a signed, short-lived
state cookie; identities are linked by verified email so duplicates can't be created. Supabase variables remain in
`.env.example` for teams that prefer to swap in Supabase Auth; the rest of the system only depends on `get_current_user`.

**CSRF.** Double-submit cookie: cookie-authenticated, state-changing requests must send `x-csrf-token` equal to the
`cs_csrf` cookie. Webhooks, the ingest API (API-key auth) and session-establishing endpoints are exempt.

**Tenant isolation.** Every tenant-owned row carries `workspace_id`. `get_workspace_context` resolves the
`X-Workspace-Id` header against `workspace_members`; object lookups always compare `workspace_id`, returning 404 for
foreign objects (no enumeration). Roles (owner > admin > analyst > viewer) are checked server-side with `require_role`.

**Admin is a separate security domain.** `admin_users`, `admin_sessions` (opaque token, `SameSite=Strict` cookie
`cs_admin`, 8h TTL), TOTP MFA, lockout after 5 failures, role → permission matrix (`ADMIN_PERMISSIONS` in
`app/api/deps.py`), and every mutation / sensitive read writes `admin_audit_logs`. Public signup can never create an admin.

**Entitlements.** Plans live in `subscription_plans` (editable in the admin console). `app/services/entitlements.py`
enforces project/review/report/member/workspace limits and feature flags per plan, with per-workspace admin overrides.
Metered usage is recorded in `usage_records` per calendar month.

## AI engine

`app/ai/` contains a provider abstraction:

- `AnthropicProvider` — official SDK, `output_config.format` JSON-schema structured outputs, effort control,
  server-side refusal fallbacks (opt-out via `ANTHROPIC_SERVER_FALLBACK=false`), refusal / truncation handling, one
  validation retry.
- `OpenAIProvider` — strict `json_schema` response format + `text-embedding-3-small` (512 dims).
- `HeuristicProvider` — deterministic keyword engine, used when no key is set and for DEMO data.
- `MockProvider` — tests; exercises the full LLM path without network calls.

`AIEngine.run()` wraps every operation with: monthly per-workspace token quota, usage/cost logging (`ai_usage_logs`,
prices in `app/ai/pricing.py`), prompt versioning (`app/ai/prompts.py`), and **transparent fallback** — if a provider
call fails, that step uses the built-in engine and the job records a warning shown to the user.

All model output is validated with Pydantic (`app/ai/schemas.py`). Grounding safeguards:

- Excerpts must be verbatim substrings of the review (`_excerpt_ok`), otherwise they are dropped.
- Opportunities must reference real cluster keys; outreach issues must map to real complaint clusters; gap-report
  evidence refs are resolved to actual review ids.

### Analysis pipeline (`services/analysis_service.py`)

1. Ingest → validate → normalize → dedupe (`services/ingestion.py`, SHA-256 content hash, unique per project)
2. Language detection (script heuristics; LLM refines + translates)
3. Batch classification: sentiment, score, emotion, complaints, praise, feature requests, topics, explanation
4. Embeddings for reviews (pgvector, semantic search) and signal labels
5. Clustering per business × kind × category (greedy cosine), LLM theme naming
6. Severity (frequency, recency, ratings) and trend (last 30 days vs previous 30, anchored at the dataset's latest date)
7. Insights & opportunities, scored from evidence strength × impact/effort

## Background jobs

Jobs are rows in `analysis_jobs`; Redis only carries ids on a dedicated arq queue (`JOBS_QUEUE_NAME`). The runner
handles status/progress, cooperative cancellation, retries with exponential backoff for transient AI/network errors,
dead-lettering after `max_attempts`, and a per-workspace concurrency limit that Business-plan workspaces bypass
(priority processing). Cron: monitoring evaluation (hourly), stuck-job recovery (every 10 min), maintenance (daily:
expire invitations, purge sessions, apply data retention, dead-letter stuck jobs).

## Frontend

Next.js 16 App Router with Cache Components: marketing pages are static; the customer app and admin console are
client-rendered behind `proxy.ts` (cookie-presence redirect only — never a security boundary). Data fetching uses
TanStack Query; forms use react-hook-form + zod mirroring backend validation; shared UI is shadcn/ui (Radix) with a
custom indigo/navy/violet token set; charts use Recharts.
