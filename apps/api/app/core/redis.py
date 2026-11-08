from __future__ import annotations

import logging

from redis.asyncio import Redis

from app.core.config import settings

log = logging.getLogger(__name__)
_client: Redis | None = None


def get_redis() -> Redis:
    global _client
    if _client is None:
        _client = Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=2)
    return _client


async def redis_available() -> bool:
    try:
        return bool(await get_redis().ping())
    except Exception:  # noqa: BLE001
        return False


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
