# Deployment

Recommended topology: **Vercel** (web) → **Railway or Render** (API + worker) → managed **PostgreSQL with pgvector**
(Neon, Supabase, Railway, Render) → managed **Redis** (Upstash, Railway, Render) → **S3-compatible** storage
(AWS S3, Cloudflare R2, Supabase Storage S3 endpoint).

## 1. Database & Redis

Create a Postgres 15+ instance with the `vector` extension available (the first migration runs
`CREATE EXTENSION IF NOT EXISTS vector`). Create Redis. Note both URLs.

## 2. API + worker (Railway or Render)

Both services use `apps/api/Dockerfile`.

| Service | Start command |
| --- | --- |
| API | default `CMD` (runs `alembic upgrade head`, then uvicorn on `$PORT`) |
| Worker | `arq app.workers.worker.WorkerSettings` |

Required env (both): `ENVIRONMENT=production`, `APP_SECRET_KEY` (≥32 random chars), `DATABASE_URL`, `REDIS_URL`,
`NEXT_PUBLIC_APP_URL=https://app.yourdomain.com`, `CORS_ORIGINS=https://app.yourdomain.com`, storage (`S3_*`), and
whichever integrations you use (`RESEND_API_KEY`, `EMAIL_FROM`, `STRIPE_*`, `GOOGLE_*`, `ANTHROPIC_API_KEY` /
`OPENAI_API_KEY`). Production startup fails fast if required variables are missing or `JOBS_INLINE=true`.
Health check path: `/health` (liveness) or `/health/ready` (DB + Redis).

Render users can deploy everything from the root [`render.yaml`](../render.yaml) — see the next section.

## Render (one-click, free tier)

`render.yaml` creates: `customersignal-ai-web` (Next.js, Node runtime), `customersignal-ai-api` (Docker; runs
migrations + seed on start and the arq worker in the same container via `RUN_WORKER_IN_PROCESS=true`),
`customersignal-ai-db` (Postgres 17, pgvector) and `customersignal-ai-redis` (Key Value). Uploads and PDFs use
`STORAGE_BACKEND=database` because free instances have ephemeral disks.

1. Dashboard → **New → Blueprint** → select this repository (or use the README's *Deploy to Render* button).
2. Fill `ADMIN_BOOTSTRAP_EMAIL` (and any optional keys) when prompted → **Apply**.
3. If Render had to give a service a different hostname (name already taken), update `API_INTERNAL_URL` on the web
   service and `NEXT_PUBLIC_APP_URL` / `CORS_ORIGINS` on the API to the real `onrender.com` URLs, then redeploy.
4. Create the first admin with the bootstrap endpoint (README → Deploy to Render), then enable MFA.
5. `EMAIL_VERIFICATION_REQUIRED=false` is set until you add `RESEND_API_KEY`; flip it to `true` afterwards.

To move off the free tier: set `plan: starter` (or higher), set `RUN_WORKER_IN_PROCESS=false`, and add a
`type: worker` service with `dockerCommand: arq app.workers.worker.WorkerSettings`. Optionally switch storage to S3.

## 3. Web (Vercel)

- Import the repository, root directory `apps/web`, framework Next.js, install `pnpm install`, build `pnpm build`.
- Env: `NEXT_PUBLIC_APP_URL=https://app.yourdomain.com`, `API_INTERNAL_URL=https://<your-api-host>` (the rewrite
  target — set it before building), optional `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Add your custom domain. Because the browser only talks to the Vercel origin, cookies are first-party and secure.

Self-hosting instead: `docker build --build-arg API_INTERNAL_URL=... --build-arg NEXT_PUBLIC_APP_URL=... apps/web`
produces a standalone Node server (`BUILD_STANDALONE=1` is set in the Dockerfile).

## 4. After the first deploy

1. Bootstrap the super-admin ([admin-bootstrap.md](admin-bootstrap.md)) and enable MFA.
2. Configure Stripe webhook → `https://app.yourdomain.com/api/v1/billing/webhook` ([stripe-setup.md](stripe-setup.md)).
3. Configure Google OAuth redirect → `https://app.yourdomain.com/api/v1/auth/google/callback` ([oauth-setup.md](oauth-setup.md)).
4. Verify a sending domain in Resend and set `EMAIL_FROM`.
5. Review the legal pages with counsel and update company details.
6. Optionally seed a demo account: `python -m app.scripts.seed --demo`.

## Operations

- Scale workers horizontally; jobs are coordinated through Redis and the `analysis_jobs` table.
- Failed/dead-lettered jobs are visible and retryable in Admin → Background Jobs.
- Logs are JSON in production (request id, path, status, duration).
- Back up Postgres (point-in-time recovery recommended) and the storage bucket.
