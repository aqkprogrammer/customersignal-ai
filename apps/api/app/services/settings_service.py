"""Platform-wide settings managed in the admin panel (stored in system_settings, cached briefly)."""

from __future__ import annotations

import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SystemSetting

DEFAULT_SETTINGS: dict[str, Any] = {
    "platform_name": "CustomerSignal AI",
    "branding": {"logo_url": None, "primary_color": "#4F46E5"},
    "default_currency": "usd",
    "supported_countries": ["United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Bahrain", "Oman",
                            "United Kingdom", "United States", "India", "Pakistan", "Egypt", "Germany"],
    "default_timezone": "Asia/Dubai",
    "registration_enabled": True,
    "email_verification_required": True,
    "support_email": "support@customersignal.ai",
    "ai_provider": "auto",  # auto | anthropic | openai | heuristic
    "ai_model_anthropic": "claude-opus-5-5",
    "ai_model_openai": "gpt-5-mini",
    "ai_monthly_token_limit_per_workspace": 5_000_000,
    "maintenance_mode": False,
    "maintenance_message": "We're performing scheduled maintenance. We'll be back shortly.",
    "max_upload_mb": 20,
    "max_rows_per_upload": 50_000,
    "trial_days": 14,
    "disabled_integrations": [],
}

SETTING_TYPES: dict[str, type | tuple[type, ...]] = {
    "platform_name": str, "branding": dict, "default_currency": str, "supported_countries": list,
    "default_timezone": str, "registration_enabled": bool, "email_verification_required": bool,
    "support_email": str, "ai_provider": str, "ai_model_anthropic": str, "ai_model_openai": str,
    "ai_monthly_token_limit_per_workspace": int, "maintenance_mode": bool, "maintenance_message": str,
    "max_upload_mb": int, "max_rows_per_upload": int, "trial_days": int,
    "disabled_integrations": list,
}

_cache: dict[str, Any] = {}
_cache_at = 0.0


async def get_all(db: AsyncSession, *, fresh: bool = False) -> dict[str, Any]:
    global _cache, _cache_at
    if not fresh and _cache and time.monotonic() - _cache_at < 15:
        return _cache
    rows = (await db.scalars(select(SystemSetting))).all()
    merged = dict(DEFAULT_SETTINGS)
    merged.update({r.key: r.value for r in rows})
    _cache, _cache_at = merged, time.monotonic()
    return merged


async def get(db: AsyncSession, key: str) -> Any:
    return (await get_all(db)).get(key, DEFAULT_SETTINGS.get(key))


def invalidate() -> None:
    global _cache_at
    _cache_at = 0.0


def validate(key: str, value: Any) -> Any:
    if key not in SETTING_TYPES:
        raise ValueError(f"Unknown setting '{key}'")
    expected = SETTING_TYPES[key]
    if expected is int and isinstance(value, bool):
        raise ValueError(f"Setting '{key}' must be an integer")
    if not isinstance(value, expected):
        raise ValueError(f"Setting '{key}' has the wrong type")
    if key == "ai_provider" and value not in ("auto", "anthropic", "openai", "heuristic"):
        raise ValueError("ai_provider must be auto, anthropic, openai or heuristic")
    if key == "branding":
        logo = value.get("logo_url")
        if logo and not (str(logo).startswith("https://") or str(logo).startswith("/")):
            raise ValueError("branding.logo_url must be an https:// URL or a site-relative path")
        color = value.get("primary_color")
        if color and not (isinstance(color, str) and len(color) == 7 and color.startswith("#")):
            raise ValueError("branding.primary_color must be a hex color like #4F46E5")
    if key in ("max_upload_mb",) and not (1 <= value <= 200):
        raise ValueError("max_upload_mb must be between 1 and 200")
    return value
