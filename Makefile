.PHONY: setup migrate seed demo api worker web dev test test-api test-web lint build admin docker-up

API=apps/api
WEB=apps/web

setup:            ## Install backend + frontend dependencies
	cd $(API) && uv sync
	cd $(WEB) && pnpm install

migrate:          ## Apply database migrations
	cd $(API) && .venv/bin/alembic upgrade head

seed:             ## Seed reference data (plans, categories, email templates, flags, settings)
	cd $(API) && .venv/bin/python -m app.scripts.seed

demo:             ## Seed reference data + demo@customersignal.local with a DEMO workspace
	cd $(API) && .venv/bin/python -m app.scripts.seed --demo

admin:            ## Create the first super-admin (needs ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_SECRET)
	cd $(API) && .venv/bin/python -m app.scripts.bootstrap_admin

api:              ## Run the API with reload on :8000
	cd $(API) && .venv/bin/uvicorn app.main:app --reload --port 8000

worker:           ## Run the background worker (needs Redis)
	cd $(API) && .venv/bin/arq app.workers.worker.WorkerSettings

web:              ## Run the Next.js dev server on :3000
	cd $(WEB) && pnpm dev

test: test-api test-web

test-api:
	cd $(API) && .venv/bin/pytest -q

test-web:
	cd $(WEB) && pnpm test

lint:
	cd $(API) && .venv/bin/ruff check app tests
	cd $(WEB) && pnpm lint

build:
	cd $(WEB) && pnpm build

docker-up:
	docker compose up --build
