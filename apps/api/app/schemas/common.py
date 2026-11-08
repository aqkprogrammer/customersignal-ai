from __future__ import annotations

from typing import Any

from fastapi import Query
from pydantic import BaseModel, ConfigDict


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Message(BaseModel):
    message: str


class Page(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int


class Pagination:
    def __init__(self, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200)) -> None:
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page(items: list[Any], total: int, p: Pagination) -> dict:
    return {"items": items, "total": total, "page": p.page, "page_size": p.page_size}
