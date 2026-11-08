from fastapi import APIRouter

from app.api.v1.admin import auth as admin_auth
from app.api.v1.admin import routes as admin_routes
from app.api.v1.routes import (
    analysis,
    auth,
    billing,
    competitors,
    integrations,
    leads,
    misc,
    monitoring,
    opportunities,
    projects,
    public,
    reports,
    reviews,
    team,
    users,
    workspaces,
)

api_router = APIRouter(prefix="/api/v1")
for r in (auth.router, users.router, workspaces.router, projects.router, reviews.router, analysis.router,
          opportunities.router, opportunities.gap, leads.router, competitors.router, reports.router, monitoring.router,
          integrations.router, team.router, billing.router, misc.notifications, misc.usage, misc.support, misc.ingest,
          public.router, admin_auth.router, admin_routes.router):
    api_router.include_router(r)
