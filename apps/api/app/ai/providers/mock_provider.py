"""Deterministic provider for automated tests: exercises the full LLM code path without network calls or charges."""

from __future__ import annotations

from typing import Any

from app.ai import heuristics
from app.ai.providers.base import AIError, AIProvider, CompletionResult, T, Usage
from app.ai.schemas import ClusterName, ClusterNaming


class MockProvider(AIProvider):
    name = "mock"
    model = "mock-model"
    label = "Mock provider (tests)"
    is_llm = True

    def __init__(self, fail_operations: set[str] | None = None) -> None:
        self.calls: list[str] = []
        self.fail_operations = fail_operations or set()

    async def complete_json(self, *, operation: str, system: str, prompt: str, schema: type[T],
                            context: dict[str, Any] | None = None, max_tokens: int = 8000) -> CompletionResult[T]:
        self.calls.append(operation)
        if operation in self.fail_operations:
            raise AIError(f"mock failure for {operation}")
        ctx = context or {}
        if operation == "classify_reviews":
            items = [heuristics.classify_review(r["ref"], r["text"], r.get("rating"), ctx["categories"]).model_dump()
                     for r in ctx["reviews"]]
            payload: Any = {"items": items}
        elif operation == "name_clusters":
            payload = ClusterNaming(clusters=[ClusterName(key=c["key"], label=c["label"], summary=f"Customers mention {c['label'].lower()}.")
                                              for c in ctx["clusters"]]).model_dump()
        elif operation == "project_insights":
            payload = heuristics.project_insights(ctx["clusters"], ctx["stats"]).model_dump()
        elif operation == "outreach_pack":
            payload = heuristics.outreach_pack(ctx["business"], ctx.get("city"), ctx.get("industry"), ctx["issues"],
                                               ctx["stats"], ctx.get("sender_company")).model_dump()
        elif operation == "gap_report":
            payload = heuristics.gap_report(ctx["product"], ctx["reviews"], ctx["competitor_reviews"],
                                            ctx["categories"]).model_dump()
        elif operation == "competitor_analysis":
            payload = heuristics.competitor_analysis(ctx["businesses"]).model_dump()
        elif operation == "report_narrative":
            payload = heuristics.report_narrative(ctx["report_type"], ctx["stats"], ctx["clusters"]).model_dump()
        else:
            raise AIError(f"MockProvider has no responder for {operation}")
        return CompletionResult(data=schema.model_validate(payload), usage=Usage(input_tokens=100, output_tokens=50,
                                                                                 duration_ms=1), model=self.model)
