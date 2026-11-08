<div align="center">

# CustomerSignal AI

### Turn Customer Feedback Into Your Next Business Opportunity.

AI-powered customer intelligence: analyze reviews, uncover recurring complaints, monitor competitors,
and turn feedback into evidence-backed opportunities, outreach and branded PDF reports.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/aqkprogrammer/customersignal-ai)

![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![FastAPI](https://img.shields.io/badge/FastAPI-0.16x-009688) ![PostgreSQL + pgvector](https://img.shields.io/badge/PostgreSQL-pgvector-336791) ![Tests](https://img.shields.io/badge/tests-95%20api%20%C2%B7%2026%20unit%20%C2%B7%209%20e2e-success) ![License](https://img.shields.io/badge/license-MIT-blue)

</div>

<p align="center">
  <img src="docs/images/review-intelligence.jpg" width="49%" alt="Review Intelligence dashboard" />
  <img src="docs/images/admin-dashboard.jpg" width="49%" alt="Admin console" />
</p>

---

## Contents

- [What it does](#what-it-does)
- [System architecture](#system-architecture)
- [Workflows](#workflows) — auth & tenancy · review analysis · background jobs · 1-star cold pitch · 3-star gap finder · billing
- [Data model](#data-model)
- [Quick start](#quick-start) · [Deploy to Render](#deploy-to-render) · [Project structure](#project-structure)
- [Documentation](#documentation)

## What it does

| Area | Highlights |
| --- | --- |
| **Marketing site** | Home, features, 5 industry pages, live pricing, contact form, blog, legal pages, sitemap, robots, OpenGraph, JSON-LD |
| **Auth** | Email/password, Google OAuth, email verification, password reset, refresh-token rotation, session management, CSRF, rate limits |
| **Review Intelligence** | CSV/Excel/manual/API ingestion → validation → dedupe → language detection & translation → sentiment, emotion, complaints, praise, feature requests → pgvector embeddings → theme clustering with severity & trends → semantic search & CSV export |
| **1-Star Review Cold Pitch** | Lead pipeline, ranked issues with **verbatim** review evidence, cold email / LinkedIn / follow-up drafts, one-page PDF, HubSpot sync |
| **3-Star Gap Finder** | Likes, dislikes, wishes, missing features, unmet expectations, competitor advantages, opportunity score, roadmap |
| **Competitors** | Side-by-side sentiment, ratings, complaint heat-map, trend lines, AI strengths/weaknesses |
| **AI Reports** | 9 report types → branded PDF with charts & evidence, secure expiring share links |
| **Monitoring** | 6 rule types evaluated hourly, in-app + email alerts, signed webhooks |
| **Team & billing** | Owner/Admin/Analyst/Viewer, invitations, Stripe Checkout/Portal/webhooks, plan limits enforced server-side |
| **Admin console** | Separate auth + TOTP MFA, 4 admin roles, users, workspaces, subscriptions, revenue, plans, AI usage & cost, jobs, support, announcements, email templates, audit logs, feature flags, settings |

> **No AI key? It still works.** A transparent built-in keyword engine runs when no provider is configured (and is
> labelled as such everywhere). Add `ANTHROPIC_API_KEY` (default `claude-opus-5-5`) or `OPENAI_API_KEY` for LLM
> analysis with validated structured outputs.

## System architecture

```mermaid
flowchart LR
    subgraph Client["Browser"]
        M[Marketing site]
        U[Customer app /app]
        A[Admin console /admin]
    end

    subgraph Web["Next.js 16 · apps/web"]
        P[proxy.ts<br/>optimistic route guard]
        R[Rewrites /api/v1/* ➜ API]
    end

    subgraph API["FastAPI · apps/api"]
        AU[Auth & sessions<br/>CSRF · rate limits]
        T[Tenant & RBAC deps<br/>X-Workspace-Id]
        S[Services<br/>ingestion · analytics · reports<br/>billing · monitoring]
        AI[AI engine<br/>Anthropic · OpenAI · heuristic]
        ADM[Admin API<br/>MFA · permissions · audit]
    end

    subgraph Workers["arq worker"]
        J[Jobs: import · analyze · gap finder<br/>outreach · reports · monitoring]
        C[Cron: hourly monitoring<br/>stuck-job recovery · retention]
    end

    DB[(PostgreSQL<br/>+ pgvector)]
    RD[(Redis<br/>queue · rate limits)]
    FS[(S3 / Postgres blobs<br/>uploads · PDFs)]
    EXT[[Stripe · Resend · Google OAuth<br/>HubSpot · webhooks]]
    LLM[[Claude / OpenAI]]

    M & U & A --> P --> R --> AU --> T --> S
    A --> R --> ADM
    S --> DB
    S -- enqueue job id --> RD --> J
    J --> AI --> LLM
    J --> DB & FS
    C --> DB
    S --> EXT
    ADM --> DB
```

The browser only talks to the Next.js origin; `/api/v1/*` is proxied to FastAPI so session cookies are first-party.
Every check that matters — authentication, workspace membership, roles, plan limits, admin permissions — runs on the
API. See [docs/architecture.md](docs/architecture.md).

## Workflows

<details open>
<summary><b>Authentication, sessions & tenant isolation</b></summary>

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Next.js
    participant API as FastAPI
    participant DB as Postgres

    User->>Web: POST /api/v1/auth/login (email, password)
    Web->>API: proxied request
    API->>DB: verify argon2 hash · create user_sessions row
    API-->>User: Set-Cookie cs_access (JWT, 15 min) · cs_refresh (rotating, HttpOnly) · cs_csrf
    User->>API: GET /api/v1/projects  + X-Workspace-Id
    API->>DB: session not revoked? member of workspace? role ≥ viewer?
    API-->>User: only this workspace's rows (foreign ids → 404)
    Note over User,API: Mutations must echo cs_csrf in x-csrf-token
    User->>API: 401 token_expired → POST /auth/refresh
    API->>DB: rotate refresh token, keep session
    API-->>User: new cookies, request retried by the client
```

Google OAuth uses the authorization-code flow with a signed state cookie; accounts link only on a
**Google-verified** email, so duplicates can't be created.
</details>

<details open>
<summary><b>Review analysis pipeline</b></summary>

```mermaid
flowchart TD
    UP[CSV / Excel upload<br/>manual entry · Reviews API] --> V{Validate & map columns}
    V -- invalid rows --> ERR[Row-level errors<br/>shown to the user]
    V --> N[Normalize text, ratings, dates]
    N --> D{Duplicate?<br/>SHA-256 content hash}
    D -- yes --> SKIP[Skipped & counted]
    D -- no --> STORE[(reviews)]
    STORE --> Q{Monthly review quota}
    Q --> LANG[Detect language]
    LANG --> CL[Batch classification<br/>sentiment · emotion · complaints · praise<br/>feature requests · explanation · translation]
    CL --> G{Excerpt is a verbatim<br/>substring of the review?}
    G -- no --> DROP[Excerpt discarded]
    G -- yes --> SIG[(review_topics)]
    SIG --> EMB[Embeddings · pgvector]
    EMB --> CLU[Cluster themes per business<br/>LLM names each theme]
    CLU --> SEV[Severity = frequency × recency × ratings<br/>Trend = last 30d vs previous 30d]
    SEV --> OPP[Opportunities<br/>must cite real themes]
    OPP --> OUT[Dashboard · alerts · webhooks · reports]
```

Each AI step runs through `AIEngine`: per-workspace token quota → provider call with structured JSON schema →
Pydantic validation → usage & cost log. If a provider fails, that step uses the built-in engine and the job shows a
warning; it never fails silently.
</details>

<details>
<summary><b>Background job lifecycle</b></summary>

```mermaid
stateDiagram-v2
    [*] --> pending: create_job + enqueue (Redis, dedicated queue)
    pending --> processing: worker picks up
    pending --> pending: workspace busy (standard plans) → re-defer 8s
    processing --> completed: result_summary saved
    processing --> cancelled: user/admin cancels (checked between batches)
    processing --> pending: transient AI/network error → retry with backoff
    processing --> failed: validation error or retries exhausted
    failed --> pending: admin retry
    failed --> [*]: dead-lettered (visible in Admin → Background Jobs)
    completed --> [*]
    note right of pending
      Recovery cron re-enqueues jobs
      stuck in pending > 1 min
    end note
```
</details>

<details>
<summary><b>1-Star Review Cold Pitch (Opportunity Finder)</b></summary>

```mermaid
flowchart LR
    A[Enter business<br/>city · industry · competitors] --> B[Upload authorized<br/>review export]
    B --> C[Analyze & cluster complaints]
    C --> D{Recurring issues<br/>2+ reviews?}
    D -- no --> X[No pitch:<br/>nothing evidence-backed]
    D -- yes --> E[Rank by severity]
    E --> F[Attach real excerpts<br/>platform · date · rating · ref]
    F --> G[Generate executive summary,<br/>solutions, cold email,<br/>LinkedIn, follow-up]
    G --> H[Edit · copy · PDF report]
    H --> I[Pipeline: new → researched → contacted<br/>→ replied → meeting → converted]
    I --> J[Optional HubSpot sync]
```
</details>

<details>
<summary><b>3-Star Gap Finder</b></summary>

```mermaid
flowchart LR
    P[Your product reviews] --> F3[Filter 2.5–3.4★ reviews]
    C[Competitor product reviews] --> F3C[Filter 2.5–3.4★ reviews]
    F3 & F3C --> AN[Likes · dislikes · wishes · missing features<br/>quality · price-value · unmet expectations<br/>competitor advantages]
    AN --> REF[Resolve every point to real review refs]
    REF --> SC[Opportunity score · feature recommendations<br/>positioning angles · roadmap]
    SC --> PDF[Executive PDF] & OPPS[Product Opportunities]
```
</details>

<details>
<summary><b>Subscription & billing</b></summary>

```mermaid
sequenceDiagram
    actor Owner
    participant App as CustomerSignal
    participant Stripe
    Owner->>App: Upgrade to Pro
    App->>Stripe: ensure customer & price → Checkout Session (trial if eligible)
    Stripe-->>Owner: hosted checkout
    Stripe->>App: webhook checkout.session.completed (signature verified, idempotent)
    App->>App: subscription = Pro · limits & features updated
    Stripe->>App: invoice.paid / payment_failed / subscription.updated / deleted
    App->>Owner: in-app + email notices · invoice history
    Note over App: Limits are always enforced server-side from the plan record
```
</details>

## Data model

47 tables with UUID keys, foreign keys, soft deletes and `workspace_id` on every tenant-owned row.
Full reference: [docs/database.md](docs/database.md).

```mermaid
erDiagram
    USERS ||--|| USER_PROFILES : has
    USERS ||--o{ WORKSPACE_MEMBERS : joins
    WORKSPACES ||--o{ WORKSPACE_MEMBERS : has
    WORKSPACES ||--|| SUBSCRIPTIONS : billed_by
    SUBSCRIPTION_PLANS ||--o{ SUBSCRIPTIONS : defines
    WORKSPACES ||--o{ PROJECTS : owns
    PROJECTS ||--o{ BUSINESSES : tracks
    BUSINESSES ||--o| COMPETITORS : "is a"
    PROJECTS ||--o{ REVIEW_SOURCES : imports
    BUSINESSES ||--o{ REVIEWS : receives
    REVIEWS ||--|| REVIEW_SENTIMENTS : scored_by
    REVIEWS ||--o{ REVIEW_TOPICS : yields
    COMPLAINT_CLUSTERS ||--o{ REVIEW_TOPICS : groups
    PROJECTS ||--o{ PRODUCT_OPPORTUNITIES : surfaces
    PROJECTS ||--o{ LEADS : prospects
    LEADS ||--o{ LEAD_ACTIVITIES : logs
    WORKSPACES ||--o{ REPORTS : generates
    REPORTS ||--o{ REPORT_SHARES : shared_via
    PROJECTS ||--o{ MONITORING_RULES : watches
    MONITORING_RULES ||--o{ MONITORING_EVENTS : fires
    WORKSPACES ||--o{ ANALYSIS_JOBS : runs
    ANALYSIS_JOBS ||--o{ AI_USAGE_LOGS : meters
    ADMIN_USERS ||--o{ ADMIN_AUDIT_LOGS : audited
```

## Quick start

Prerequisites: Python 3.12+ with [uv](https://docs.astral.sh/uv/), Node 20.9+ with pnpm, PostgreSQL 15+ with
`pgvector`, Redis 7+ — or just Docker.

```bash
cp .env.example .env          # every external key is optional for local use
createdb customersignal
make setup && make migrate
make demo                     # demo user + DEMO workspace (prints the password once)
```

Run in three terminals:

```bash
make api       # FastAPI :8000 — docs at /api/docs
```

```bash
make worker    # background jobs
```

```bash
make web       # Next.js :3000
```

Without `RESEND_API_KEY`, verification/reset emails are printed to the API log. No worker? Set `JOBS_INLINE=true`.

**Docker:**

```bash
docker compose up --build
```

## Deploy to Render

[`render.yaml`](render.yaml) provisions the whole stack on Render's free tier: Next.js web service, FastAPI API (with
the job worker in the same container), Postgres with pgvector, and Key Value (Redis). Click **Deploy to Render**
above, then create the first admin:

```bash
curl -X POST https://customersignal-ai-api.onrender.com/api/v1/admin/auth/bootstrap \
  -H 'content-type: application/json' \
  -d '{"email":"<ADMIN_BOOTSTRAP_EMAIL>","password":"<a strong password>","bootstrap_secret":"<ADMIN_BOOTSTRAP_SECRET from the Render dashboard>"}'
```

Free-tier caveats: services sleep when idle (first request takes ~30–60 s), and free Postgres expires after 30 days
unless upgraded. Details and the paid-tier layout: [docs/deployment.md](docs/deployment.md).

## Screenshots

| AI report (in app) | PDF report |
| --- | --- |
| <img src="docs/images/ai-report.jpg" alt="AI report view" /> | <img src="docs/images/pdf-report-page.png" alt="Generated PDF page" /> |

## Project structure

```
customersignal-ai/
├── apps/api/                 FastAPI backend (Python 3.13)
│   ├── app/ai/               provider abstraction, prompts, schemas, embeddings, heuristic engine
│   ├── app/api/v1/routes/    customer REST API
│   ├── app/api/v1/admin/     admin auth + admin REST API
│   ├── app/core/             config, DB, security, errors, rate limiting, storage
│   ├── app/models/           SQLAlchemy 2.0 models
│   ├── app/services/         ingestion, analysis, intelligence, reports/PDF, billing, monitoring
│   ├── app/workers/          job runner + arq worker
│   ├── migrations/           Alembic
│   └── tests/                pytest (95)
├── apps/web/                 Next.js 16 (App Router, Tailwind v4, shadcn/ui, Recharts)
│   ├── app/(marketing)/      public site
│   ├── app/(auth)/           login, signup, verify, reset, OAuth callback
│   ├── app/(dashboard)/app/  customer app
│   ├── app/admin/            admin console
│   └── tests/                Vitest (26) + Playwright (9)
├── docs/                     architecture, database, API, setup & deployment guides
├── render.yaml               Render blueprint (full stack)
├── docker-compose.yml
└── Makefile
```

## Documentation

| Guide | |
| --- | --- |
| [Architecture](docs/architecture.md) | Components, security model, AI engine, jobs |
| [Database](docs/database.md) | Tables, relationships, constraints, seeding, retention |
| [API](docs/api.md) | Conventions, endpoints, Reviews API, webhook signatures |
| [Local development](docs/local-development.md) | Setup, ports, dev settings, migrations |
| [Testing](docs/testing.md) | pytest, Vitest, Playwright |
| [Deployment](docs/deployment.md) | Render, Vercel, Railway, Docker |
| [Google OAuth](docs/oauth-setup.md) · [Stripe](docs/stripe-setup.md) · [AI providers](docs/ai-providers.md) | Integrations |
| [Admin bootstrap](docs/admin-bootstrap.md) · [Troubleshooting](docs/troubleshooting.md) | Operations |

## Principles

- **Authorized data only** — uploads, official APIs and approved providers; no scraping or bypassing platform controls.
- **Evidence over claims** — every quote is verbatim, every opportunity cites real themes, synthetic data is labelled DEMO.
- **Server-side enforcement** — auth, tenancy, roles, plan limits and admin permissions never trust the client.
- Legal pages ship as templates and must be reviewed by counsel before launch.

## License

[MIT](LICENSE)
