# Local development

## Requirements

- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- Node.js 20.9+ and pnpm (`corepack enable`)
- PostgreSQL 15+ with `pgvector` (Homebrew: `brew install postgresql@17 pgvector`)
- Redis 7+ (`brew install redis && brew services start redis`)

## First run

```bash
cp .env.example .env
createdb customersignal
make setup
make migrate
make demo        # prints the demo user's password once
```

Run the API, the worker and the web app in three terminals: `make api`, `make worker`, `make web`.

| URL | What |
| --- | --- |
| http://localhost:3000 | Marketing site, `/signup`, `/login`, `/app`, `/admin/login` |
| http://localhost:8000/api/docs | OpenAPI / Swagger |
| http://localhost:8000/health/ready | Readiness (DB + Redis) |

### Ports already in use?

Run the API on another port and point the web proxy at it — the rewrite target is read when the web app builds/starts:

```bash
cd apps/api && .venv/bin/uvicorn app.main:app --port 8100
```

```bash
cd apps/web && API_INTERNAL_URL=http://localhost:8100 pnpm dev --port 3100
```

Also set `NEXT_PUBLIC_APP_URL=http://localhost:3100` in `.env` so emails and OAuth redirects use the right origin.

## Useful settings for development

| Variable | Effect |
| --- | --- |
| `JOBS_INLINE=true` | Run background jobs inside the API process (no worker needed) |
| `EMAIL_VERIFICATION_REQUIRED=false` | Skip email verification on signup |
| `RESEND_API_KEY` unset | Emails are printed to the API log (copy verification/reset links from there) |
| `AI_PROVIDER=heuristic` | Force the free built-in engine even if keys are present |
| `JOBS_QUEUE_NAME` | Use a unique value if several projects share one Redis |

## Database changes

```bash
cd apps/api
.venv/bin/alembic revision --autogenerate -m "describe change"
.venv/bin/alembic upgrade head
```

## Code quality

```bash
make lint      # ruff + eslint
make test      # pytest + vitest
```
