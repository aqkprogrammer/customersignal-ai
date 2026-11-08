from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Any, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class AIError(Exception):
    """Provider call failed after retries, or the output didn't validate."""


class AIRefusal(AIError):
    """The model declined the request (stop_reason == 'refusal')."""


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    duration_ms: int = 0


@dataclass
class CompletionResult[T: BaseModel]:
    data: T
    usage: Usage
    model: str


class AIProvider(abc.ABC):
    """Provider abstraction. `is_llm` providers implement complete_json; others are handled by heuristics."""

    name: str = "base"
    model: str = ""
    is_llm: bool = True
    label: str = ""

    @abc.abstractmethod
    async def complete_json(self, *, operation: str, system: str, prompt: str, schema: type[T],
                            context: dict[str, Any] | None = None, max_tokens: int = 8000) -> CompletionResult[T]:
        ...

    async def embed(self, texts: list[str]) -> tuple[list[list[float]], Usage, str] | None:
        """Return embeddings or None when the provider has no embedding model (local embeddings are used)."""
        return None
