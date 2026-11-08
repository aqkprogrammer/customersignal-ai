"""OpenAI provider: strict JSON-schema structured outputs + embeddings."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import openai
from pydantic import ValidationError

from app.ai.providers.base import AIError, AIProvider, CompletionResult, T, Usage
from app.ai.schemas import to_strict_json_schema
from app.core.config import settings
from app.models.review import EMBEDDING_DIM

log = logging.getLogger(__name__)


class OpenAIProvider(AIProvider):
    name = "openai"
    is_llm = True

    def __init__(self, api_key: str, model: str, embedding_model: str) -> None:
        self.model = model
        self.embedding_model = embedding_model
        self.label = f"OpenAI {model}"
        self._client = openai.AsyncOpenAI(api_key=api_key, timeout=settings.ai_timeout_seconds,
                                          max_retries=settings.ai_max_retries)

    async def complete_json(self, *, operation: str, system: str, prompt: str, schema: type[T],
                            context: dict[str, Any] | None = None, max_tokens: int = 8000) -> CompletionResult[T]:
        started = time.perf_counter()
        usage = Usage()
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                resp = await self._client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
                    max_completion_tokens=max_tokens,
                    response_format={
                        "type": "json_schema",
                        "json_schema": {"name": schema.__name__, "schema": to_strict_json_schema(schema), "strict": True},
                    },
                )
            except openai.AuthenticationError as exc:
                raise AIError("OpenAI API key is invalid.") from exc
            except openai.APIStatusError as exc:
                raise AIError(f"OpenAI API error ({exc.status_code}): {exc.message}") from exc
            except openai.APIConnectionError as exc:
                raise AIError(f"Could not reach OpenAI: {exc}") from exc
            if resp.usage:
                usage.input_tokens += resp.usage.prompt_tokens
                usage.output_tokens += resp.usage.completion_tokens
            choice = resp.choices[0]
            if getattr(choice.message, "refusal", None):
                raise AIError("The model declined to process this content.")
            try:
                data = schema.model_validate(json.loads(choice.message.content or ""))
                usage.duration_ms = int((time.perf_counter() - started) * 1000)
                return CompletionResult(data=data, usage=usage, model=resp.model or self.model)
            except (json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
                log.warning("OpenAI %s output failed validation (attempt %s): %s", operation, attempt + 1, exc)
        raise AIError(f"Invalid structured output for {operation}: {last_error}")

    async def embed(self, texts: list[str]) -> tuple[list[list[float]], Usage, str] | None:
        started = time.perf_counter()
        try:
            resp = await self._client.embeddings.create(model=self.embedding_model, input=texts,
                                                        dimensions=EMBEDDING_DIM)
        except openai.OpenAIError as exc:
            log.warning("OpenAI embeddings failed, falling back to local embeddings: %s", exc)
            return None
        usage = Usage(input_tokens=resp.usage.prompt_tokens if resp.usage else 0,
                      duration_ms=int((time.perf_counter() - started) * 1000))
        return [d.embedding for d in resp.data], usage, self.embedding_model
