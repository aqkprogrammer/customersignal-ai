"""Anthropic Claude provider using the official SDK with structured JSON outputs (output_config.format)."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

import anthropic
from pydantic import ValidationError

from app.ai.providers.base import AIError, AIProvider, AIRefusal, CompletionResult, T, Usage
from app.ai.schemas import to_strict_json_schema
from app.core.config import settings

log = logging.getLogger(__name__)
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AnthropicProvider(AIProvider):
    name = "anthropic"
    is_llm = True

    def __init__(self, api_key: str, model: str) -> None:
        self.model = model
        self.label = f"Anthropic {model}"
        # The SDK retries 408/409/429/5xx and connection errors with backoff.
        self._client = anthropic.AsyncAnthropic(
            api_key=api_key, timeout=settings.ai_timeout_seconds, max_retries=settings.ai_max_retries
        )
        self._fallbacks = settings.anthropic_server_fallback

    async def _create(self, **kwargs: Any) -> Any:
        if self._fallbacks:
            try:
                # Server-side refusal fallbacks: route a refused request to a fallback model automatically.
                return await self._client.messages.create(
                    **kwargs, extra_headers={"anthropic-beta": FALLBACK_BETA}, extra_body={"fallbacks": "default"}
                )
            except anthropic.BadRequestError as exc:
                if "fallback" not in str(exc).lower():
                    raise
                log.warning("Server-side fallbacks unavailable for this account/model; continuing without them.")
                self._fallbacks = False
        return await self._client.messages.create(**kwargs)

    async def complete_json(self, *, operation: str, system: str, prompt: str, schema: type[T],
                            context: dict[str, Any] | None = None, max_tokens: int = 8000) -> CompletionResult[T]:
        started = time.perf_counter()
        last_error: Exception | None = None
        usage = Usage()
        for attempt in range(2):  # one extra attempt if the output fails validation
            try:
                response = await self._create(
                    model=self.model,
                    max_tokens=max_tokens,
                    system=system,
                    messages=[{"role": "user", "content": prompt}],
                    output_config={
                        "effort": settings.anthropic_effort,
                        "format": {"type": "json_schema", "schema": to_strict_json_schema(schema)},
                    },
                )
            except anthropic.RateLimitError as exc:
                raise AIError(f"Anthropic rate limit exceeded: {exc}") from exc
            except anthropic.AuthenticationError as exc:
                raise AIError("Anthropic API key is invalid.") from exc
            except anthropic.APIStatusError as exc:
                raise AIError(f"Anthropic API error ({exc.status_code}): {exc.message}") from exc
            except anthropic.APIConnectionError as exc:
                raise AIError(f"Could not reach Anthropic: {exc}") from exc

            usage.input_tokens += response.usage.input_tokens
            usage.output_tokens += response.usage.output_tokens
            if response.stop_reason == "refusal":
                raise AIRefusal("The model declined to process this content.")
            if response.stop_reason == "max_tokens":
                last_error = AIError("Model output was truncated (max_tokens).")
                max_tokens = min(max_tokens * 2, 32000)
                continue
            text = "".join(b.text for b in response.content if getattr(b, "type", "") == "text")
            try:
                data = schema.model_validate(json.loads(text))
                usage.duration_ms = int((time.perf_counter() - started) * 1000)
                return CompletionResult(data=data, usage=usage, model=response.model or self.model)
            except (json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
                log.warning("Anthropic %s output failed validation (attempt %s): %s", operation, attempt + 1, exc)
                await asyncio.sleep(0.5)
        raise AIError(f"Invalid structured output for {operation}: {last_error}")
