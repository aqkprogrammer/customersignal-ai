#!/bin/sh
# Container entrypoint: migrate, optionally start the arq worker alongside, then serve the API.
# RUN_WORKER_IN_PROCESS=true is for single-instance hosts without background workers (e.g. Render free tier).
set -e

alembic upgrade head
python -m app.scripts.seed

if [ "${RUN_WORKER_IN_PROCESS:-false}" = "true" ]; then
  echo "Starting arq worker in the same container"
  arq app.workers.worker.WorkerSettings &
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
