"""Per-million-token prices (USD) used for cost *estimates* shown in the admin panel."""

from __future__ import annotations

PRICES: dict[str, tuple[float, float]] = {
    # Anthropic (first-party API list prices)
    "claude-fable-5-1": (10.0, 50.0),
    "claude-opus-5-5": (4.0, 20.0),
    "claude-opus-5": (5.0, 25.0),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-haiku-5-5": (0.10, 0.50),
    # OpenAI (approximate; verify against current OpenAI pricing)
    "gpt-5": (1.25, 10.0),
    "gpt-5-mini": (0.25, 2.0),
    "gpt-5-nano": (0.05, 0.40),
    "text-embedding-3-small": (0.02, 0.0),
    "text-embedding-3-large": (0.13, 0.0),
}


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    inp, out = PRICES.get(model, (0.0, 0.0))
    return round(input_tokens / 1_000_000 * inp + output_tokens / 1_000_000 * out, 6)
