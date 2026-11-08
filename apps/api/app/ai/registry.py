"""Provider selection: admin setting (system_settings.ai_provider) > env AI_PROVIDER > auto-detect from API keys."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.providers.anthropic_provider import AnthropicProvider
from app.ai.providers.base import AIProvider
from app.ai.providers.mock_provider import MockProvider
from app.ai.providers.openai_provider import OpenAIProvider
from app.core.config import settings
from app.services import settings_service


class HeuristicProvider(AIProvider):
    name = "heuristic"
    model = "builtin-keyword-v1"
    label = "Built-in keyword engine (no AI provider configured)"
    is_llm = False

    async def complete_json(self, **kwargs):  # pragma: no cover - never called; heuristics run directly
        raise NotImplementedError


_override: AIProvider | None = None


def set_provider_override(provider: AIProvider | None) -> None:
    """Used by tests to inject a MockProvider."""
    global _override
    _override = provider


async def get_provider(db: AsyncSession) -> AIProvider:
    if _override is not None:
        return _override
    if settings.environment == "test":
        return MockProvider()
    choice = await settings_service.get(db, "ai_provider")
    if choice in (None, "auto"):
        choice = settings.ai_provider
    if choice == "auto":
        choice = "anthropic" if settings.anthropic_api_key else "openai" if settings.openai_api_key else "heuristic"
    if choice == "anthropic" and settings.anthropic_api_key:
        model = await settings_service.get(db, "ai_model_anthropic") or settings.anthropic_model
        return AnthropicProvider(settings.anthropic_api_key, model)
    if choice == "openai" and settings.openai_api_key:
        model = await settings_service.get(db, "ai_model_openai") or settings.openai_model
        return OpenAIProvider(settings.openai_api_key, model, settings.openai_embedding_model)
    return HeuristicProvider()


def get_embedding_provider() -> OpenAIProvider | None:
    if settings.openai_api_key and settings.environment != "test":
        return OpenAIProvider(settings.openai_api_key, settings.openai_model, settings.openai_embedding_model)
    return None


def provider_status() -> dict:
    return {
        "anthropic": {"configured": bool(settings.anthropic_api_key), "model": settings.anthropic_model},
        "openai": {"configured": bool(settings.openai_api_key), "model": settings.openai_model,
                   "embedding_model": settings.openai_embedding_model},
        "default": settings.ai_provider,
    }
