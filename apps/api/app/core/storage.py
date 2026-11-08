"""File storage backends for uploads and generated PDFs.

- ``s3``       — any S3-compatible store (AWS S3, Cloudflare R2, Supabase Storage S3 endpoint, MinIO)
- ``database`` — rows in ``stored_files`` (for hosts with ephemeral disks, e.g. Render free instances)
- ``local``    — filesystem under LOCAL_STORAGE_PATH (development)

STORAGE_BACKEND=auto picks s3 when S3 credentials are set, otherwise local.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from app.core.config import settings


class Storage:
    def __init__(self) -> None:
        self._s3 = None
        choice = settings.storage_backend
        if choice == "auto":
            choice = "s3" if settings.s3_enabled else "local"
        if choice == "s3":
            if not settings.s3_enabled:
                raise RuntimeError("STORAGE_BACKEND=s3 requires S3_ACCESS_KEY, S3_SECRET_KEY and S3_BUCKET")
            import boto3

            self._s3 = boto3.client(
                "s3",
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
                region_name=settings.s3_region,
                endpoint_url=settings.s3_endpoint_url or None,
            )
        self._backend = choice
        self._root = Path(settings.local_storage_path).resolve()

    @property
    def backend(self) -> str:
        return self._backend

    def _local_path(self, key: str) -> Path:
        path = (self._root / key).resolve()
        if not str(path).startswith(str(self._root)):
            raise ValueError("Invalid storage key")
        return path

    async def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        if self._backend == "s3":
            await asyncio.to_thread(
                self._s3.put_object, Bucket=settings.s3_bucket, Key=key, Body=data, ContentType=content_type
            )
        elif self._backend == "database":
            from sqlalchemy.dialects.postgresql import insert

            from app.core.database import session_scope
            from app.models.storage import StoredFile

            async with session_scope() as db:
                stmt = insert(StoredFile).values(key=key, content=data, content_type=content_type, size=len(data))
                await db.execute(stmt.on_conflict_do_update(
                    index_elements=[StoredFile.key],
                    set_={"content": data, "content_type": content_type, "size": len(data)},
                ))
        else:
            path = self._local_path(key)
            path.parent.mkdir(parents=True, exist_ok=True)
            await asyncio.to_thread(path.write_bytes, data)
        return key

    async def get(self, key: str) -> bytes | None:
        if self._backend == "s3":
            try:
                obj = await asyncio.to_thread(self._s3.get_object, Bucket=settings.s3_bucket, Key=key)
                return await asyncio.to_thread(obj["Body"].read)
            except Exception:  # noqa: BLE001
                return None
        if self._backend == "database":
            from app.core.database import session_scope
            from app.models.storage import StoredFile

            async with session_scope() as db:
                row = await db.get(StoredFile, key)
                return bytes(row.content) if row else None
        path = self._local_path(key)
        if not path.exists():
            return None
        return await asyncio.to_thread(path.read_bytes)

    async def delete(self, key: str) -> None:
        if self._backend == "s3":
            await asyncio.to_thread(self._s3.delete_object, Bucket=settings.s3_bucket, Key=key)
        elif self._backend == "database":
            from sqlalchemy import delete

            from app.core.database import session_scope
            from app.models.storage import StoredFile

            async with session_scope() as db:
                await db.execute(delete(StoredFile).where(StoredFile.key == key))
        else:
            path = self._local_path(key)
            if path.exists():
                os.remove(path)


storage = Storage()
