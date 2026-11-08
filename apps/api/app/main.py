"""FastAPI application factory."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging
from app.core.redis import close_redis, redis_available
from app.middleware.http import RequestContextMiddleware

log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    from app.services.seed_reference import seed_reference_data

    async with SessionLocal() as db:
        await seed_reference_data(db)  # idempotent: plans, categories, templates, flags, settings
        await db.commit()
    log.info("CustomerSignal AI API started (env=%s, jobs=%s)", settings.environment,
             "inline" if settings.jobs_inline else "redis/arq")
    yield
    await close_redis()
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="CustomerSignal AI API",
        version="1.0.0",
        description="Customer intelligence platform API. User endpoints under /api/v1, admin under /api/v1/admin.",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["content-type", "x-csrf-token", "x-workspace-id", "authorization", "x-request-id"],
    )
    install_error_handlers(app)
    app.include_router(api_router)

    @app.get("/health", tags=["health"])
    async def health() -> dict:
        return {"status": "ok"}

    @app.get("/health/ready", tags=["health"])
    async def ready() -> JSONResponse:
        checks = {"database": False, "redis": await redis_available()}
        try:
            async with SessionLocal() as db:
                await db.execute(text("select 1"))
            checks["database"] = True
        except Exception as exc:  # noqa: BLE001
            log.error("DB health check failed: %s", exc)
        ok = checks["database"] and (checks["redis"] or settings.jobs_inline)
        return JSONResponse({"status": "ok" if ok else "degraded", "checks": checks}, status_code=200 if ok else 503)

    return app


app = create_app()
