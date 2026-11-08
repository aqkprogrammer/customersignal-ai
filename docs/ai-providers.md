# AI providers

| Provider | Env vars | Used for |
| --- | --- | --- |
| Anthropic Claude | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-opus-5-5`), `ANTHROPIC_EFFORT` (default `low`), `ANTHROPIC_SERVER_FALLBACK` (default `true`) | Classification, translation, theme naming, insights, outreach, gap reports, competitor analysis, report narratives |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-5-mini`), `OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-small`) | Same operations; also the only source of semantic embeddings |
| Built-in engine | none | Deterministic keyword analysis; DEMO data; automatic fallback |

**Selection order:** Admin → AI Usage → *Provider* setting (`auto`/`anthropic`/`openai`/`heuristic`) → `AI_PROVIDER`
env → auto-detect (Anthropic if its key is set, else OpenAI, else built-in). Model names can also be changed in the
admin console without redeploying.

**Embeddings:** with an OpenAI key, reviews and theme labels use `text-embedding-3-small` at 512 dimensions; otherwise
a local hashed bag-of-words embedding is used. Changing the embedding source requires re-analyzing projects for
consistent semantic search.

**Cost & limits:** every call is logged to `ai_usage_logs` with tokens, estimated cost (`app/ai/pricing.py`), duration
and status. `ai_monthly_token_limit_per_workspace` (admin setting) caps usage; when reached, the built-in engine is
used and the user sees a warning. Review analysis is also bounded by the plan's monthly review quota.

**Reliability:** SDK retries with backoff (`AI_MAX_RETRIES`), timeouts (`AI_TIMEOUT_SECONDS`), structured-output
validation with one retry, refusal and truncation handling, job-level retries for transient errors, and per-step
fallback to the built-in engine (recorded as a job warning, never silent).

**Grounding:** prompts instruct models to use only provided data; the pipeline additionally verifies every quoted
excerpt is verbatim, drops opportunities/issues not tied to real clusters, and resolves evidence refs to real reviews.

**Prompts** are versioned in `app/ai/prompts.py` (`PROMPT_VERSIONS`) and stored with each result for traceability.
