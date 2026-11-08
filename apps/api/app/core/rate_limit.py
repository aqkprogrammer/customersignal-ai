"""Fixed-window rate limiting backed by Redis, with an in-process fallback when Redis is unavailable."""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import Request

from app.core.config import settings
from app.core.errors import RateLimited
from app.core.redis import get_redis

_memory: dict[str, tuple[int, float]] = defaultdict(lambda: (0, 0.0))


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def hit(key: str, limit: int, window_seconds: int) -> int:
    """Increment the counter for `key` and raise RateLimited when it exceeds `limit` within the window."""
    if settings.environment == "test":
        return 0
    bucket = f"rl:{key}:{int(time.time() // window_seconds)}"
    try:
        r = get_redis()
        count = await r.incr(bucket)
        if count == 1:
            await r.expire(bucket, window_seconds)
    except Exception:  # noqa: BLE001 - Redis down: degrade to per-process limiting
        prev, exp = _memory[bucket]
        now = time.time()
        count = 1 if now > exp else prev + 1
        _memory[bucket] = (count, now + window_seconds if count == 1 else exp)
    if count > limit:
        raise RateLimited("Too many requests. Please wait a moment and try again.")
    return count


def limiter(name: str, limit: int, window_seconds: int = 60):
    """FastAPI dependency factory: limit per client IP."""

    async def _dep(request: Request) -> None:
        await hit(f"{name}:{client_ip(request)}", limit, window_seconds)

    return _dep
