"""AIEngine: runs one structured AI operation with quota checks, usage/cost logging and transparent fallback."""

from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embeddings import local_embedding
from app.ai.pricing import estimate_cost
from app.ai.prompts import PROMPT_VERSIONS
from app.ai.providers.base import AIError, AIProvider, T
from app.ai.registry import get_embedding_provider, get_provider
from app.models import AIUsageLog
from app.services import settings_service
from app.services.entitlements import current_period, record_usage

log = logging.getLogger(__name__)


class AIEngine:
    def __init__(self, db: AsyncSession, provider: AIProvider, *, workspace_id: uuid.UUID | None,
                 user_id: uuid.UUID | None = None, job_id: uuid.UUID | None = None) -> None:
        self.db = db
        self.provider = provider
        self.workspace_id = workspace_id
        self.user_id = user_id
        self.job_id = job_id
        self.warnings: list[str] = []
        self.used_llm = False
        self.used_fallback = False

    @classmethod
    async def create(cls, db: AsyncSession, *, workspace_id: uuid.UUID | None, user_id: uuid.UUID | None = None,
                     job_id: uuid.UUID | None = None) -> AIEngine:
        return cls(db, await get_provider(db), workspace_id=workspace_id, user_id=user_id, job_id=job_id)

    @property
    def provider_name(self) -> str:
        if self.used_llm and not self.used_fallback:
            return self.provider.name
        if self.used_llm and self.used_fallback:
            return f"{self.provider.name}+heuristic"
        return "heuristic"

    @property
    def model_name(self) -> str | None:
        return self.provider.model if self.used_llm else "builtin-keyword-v1"

    async def _tokens_used_this_month(self) -> int:
        if not self.workspace_id:
            return 0
        start = datetime.strptime(current_period() + "-01", "%Y-%m-%d").replace(tzinfo=UTC)
        total = await self.db.scalar(
            select(func.coalesce(func.sum(AIUsageLog.input_tokens + AIUsageLog.output_tokens), 0)).where(
                AIUsageLog.workspace_id == self.workspace_id, AIUsageLog.created_at >= start
            )
        )
        return int(total or 0)

    async def run(self, operation: str, schema: type[T], *, system: str, prompt: str, context: dict[str, Any],
                  heuristic: Callable[[], T], max_tokens: int = 8000) -> T:
        if not self.provider.is_llm:
            return heuristic()
        limit = await settings_service.get(self.db, "ai_monthly_token_limit_per_workspace")
        if limit and await self._tokens_used_this_month() >= int(limit):
            msg = "Monthly AI token limit reached for this workspace; used the built-in engine instead."
            if msg not in self.warnings:
                self.warnings.append(msg)
            self.used_fallback = True
            return heuristic()
        try:
            result = await self.provider.complete_json(operation=operation, system=system, prompt=prompt,
                                                       schema=schema, context=context, max_tokens=max_tokens)
        except AIError as exc:
            log.error("AI %s failed: %s", operation, exc)
            await self._log(operation, 0, 0, 0, "error", str(exc)[:1000])
            msg = f"AI provider error during {operation.replace('_', ' ')}: {exc}. Used the built-in engine for that step."
            if msg not in self.warnings:
                self.warnings.append(msg[:400])
            self.used_fallback = True
            return heuristic()
        self.used_llm = True
        await self._log(operation, result.usage.input_tokens, result.usage.output_tokens, result.usage.duration_ms,
                        "success", None, model=result.model)
        return result.data

    async def _log(self, operation: str, inp: int, out: int, duration: int, status: str, error: str | None,
                   model: str | None = None) -> None:
        model = model or self.provider.model
        self.db.add(AIUsageLog(
            workspace_id=self.workspace_id, user_id=self.user_id, job_id=self.job_id, provider=self.provider.name,
            model=model, operation=operation, prompt_version=PROMPT_VERSIONS.get(operation), input_tokens=inp,
            output_tokens=out, cost_usd=estimate_cost(model, inp, out), duration_ms=duration, status=status, error=error,
        ))
        if self.workspace_id and (inp or out):
            await record_usage(self.db, self.workspace_id, "ai_tokens", inp + out)
        await self.db.flush()

    async def embed(self, texts: list[str]) -> tuple[list[list[float]], str]:
        """Returns (vectors, source) where source is the embedding model name or 'local-hash'."""
        if not texts:
            return [], "none"
        emb = get_embedding_provider()
        if emb is not None:
            out: list[list[float]] = []
            total_tokens = 0
            for i in range(0, len(texts), 256):
                res = await emb.embed(texts[i:i + 256])
                if res is None:
                    break
                vectors, usage, model = res
                out.extend(vectors)
                total_tokens += usage.input_tokens
            if len(out) == len(texts):
                await self._log("embeddings", total_tokens, 0, 0, "success", None, model=emb.embedding_model)
                return out, emb.embedding_model
        return [local_embedding(t) for t in texts], "local-hash"
