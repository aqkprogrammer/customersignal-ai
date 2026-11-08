"""Default plan catalog (seeded into subscription_plans; editable by admins) and entitlement keys."""

from __future__ import annotations

# Entitlement keys gate features server-side.
FEATURES = {
    "basic_sentiment": "Basic sentiment analysis",
    "advanced_analytics": "Advanced analytics",
    "competitor_comparison": "Competitor comparison",
    "advanced_ai": "Advanced AI intelligence (opportunity finder, gap finder, outreach)",
    "monitoring": "Monitoring & alerts",
    "team_collaboration": "Team collaboration",
    "advanced_competitor_intel": "Advanced competitor intelligence",
    "priority_processing": "Priority processing",
    "custom_branding": "Custom report branding",
    "api_access": "API access",
    "custom_integrations": "Custom integrations",
    "advanced_permissions": "Advanced permissions",
}

DEFAULT_PLANS: list[dict] = [
    {
        "code": "free", "name": "Free", "price_monthly_cents": 0, "sort_order": 0,
        "description": "Explore CustomerSignal AI with a small dataset.",
        "max_workspaces": 1, "max_projects": 2, "max_reviews_per_month": 100, "max_reports_per_month": 2,
        "max_members": 1, "trial_days": 0,
        "features": ["basic_sentiment"],
        "marketing_features": ["1 workspace", "2 projects", "100 reviews / month", "Basic sentiment analysis",
                               "2 AI reports / month"],
    },
    {
        "code": "starter", "name": "Starter", "price_monthly_cents": 2900, "sort_order": 1,
        "description": "For small businesses getting serious about customer feedback.",
        "max_workspaces": 1, "max_projects": 3, "max_reviews_per_month": 2000, "max_reports_per_month": 10,
        "max_members": 2, "trial_days": 14,
        "features": ["basic_sentiment", "advanced_analytics", "competitor_comparison"],
        "marketing_features": ["3 projects", "2,000 reviews / month", "Advanced analytics",
                               "Competitor comparison", "10 AI reports / month"],
    },
    {
        "code": "pro", "name": "Pro", "price_monthly_cents": 9900, "sort_order": 2, "highlighted": True,
        "description": "Full AI intelligence, monitoring and collaboration for growing teams.",
        "max_workspaces": 3, "max_projects": 10, "max_reviews_per_month": 15000, "max_reports_per_month": 200,
        "max_members": 5, "trial_days": 14,
        "features": ["basic_sentiment", "advanced_analytics", "competitor_comparison", "advanced_ai", "monitoring",
                     "team_collaboration"],
        "marketing_features": ["10 projects", "15,000 reviews / month", "Advanced AI intelligence",
                               "Unlimited report downloads (fair use)", "Monitoring & alerts", "Team collaboration"],
    },
    {
        "code": "business", "name": "Business", "price_monthly_cents": 24900, "sort_order": 3,
        "description": "Advanced competitor intelligence and priority processing at scale.",
        "max_workspaces": 5, "max_projects": 30, "max_reviews_per_month": 50000, "max_reports_per_month": 1000,
        "max_members": 10, "trial_days": 14,
        "features": ["basic_sentiment", "advanced_analytics", "competitor_comparison", "advanced_ai", "monitoring",
                     "team_collaboration", "advanced_competitor_intel", "priority_processing", "custom_branding"],
        "marketing_features": ["30 projects", "50,000 reviews / month", "Advanced competitor intelligence",
                               "Priority processing", "10 team members", "Custom report branding"],
    },
    {
        "code": "enterprise", "name": "Enterprise", "price_monthly_cents": None, "sort_order": 4,
        "description": "Custom limits, dedicated support, API access and custom integrations.",
        "max_workspaces": None, "max_projects": None, "max_reviews_per_month": None, "max_reports_per_month": None,
        "max_members": None, "trial_days": 0,
        "features": list(FEATURES.keys()),
        "marketing_features": ["Custom limits", "Dedicated support", "API access", "Advanced permissions",
                               "Custom integrations"],
    },
]
