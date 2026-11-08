"""ReviewIngestionService + ReviewNormalizationService: parse CSV/Excel/manual/API input, validate, normalize, dedupe."""

from __future__ import annotations

import csv
import hashlib
import html
import io
import re
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.heuristics import detect_language
from app.models import Business, Project, Review

ALIASES: dict[str, tuple[str, ...]] = {
    "text": ("review_text", "review", "text", "comment", "comments", "body", "content", "feedback", "review_body",
             "review_content", "message"),
    "rating": ("rating", "stars", "star_rating", "score", "review_rating", "rating_value"),
    "review_date": ("review_date", "date", "created_at", "published_at", "time", "review_time", "submitted_at",
                    "timestamp"),
    "reviewer_name": ("reviewer_name", "reviewer", "author", "author_name", "customer", "customer_name", "name",
                      "user"),
    "platform": ("platform", "source", "site", "channel"),
    "business": ("business", "business_name", "location_name", "store", "branch", "company", "brand", "competitor"),
    "product_name": ("product_name", "product", "item", "asin", "sku", "product_title"),
    "location": ("location", "city", "region", "country"),
    "verified": ("verified", "verified_purchase", "is_verified"),
    "external_id": ("review_id", "external_id", "id", "reviewid"),
    "title": ("title", "headline", "review_title", "summary"),
}
DATE_FORMATS = ("%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S",
                "%d %b %Y", "%b %d, %Y", "%B %d, %Y", "%d %B %Y", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%fZ")
MAX_TEXT = 10_000
_TAG = re.compile(r"<[^>]+>")
_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_WS = re.compile(r"[ \t]+")


class IngestionError(ValueError):
    pass


@dataclass
class NormalizedReview:
    text: str
    rating: float | None = None
    review_date: date | None = None
    reviewer_name: str | None = None
    platform: str | None = None
    business: str | None = None
    product_name: str | None = None
    location: str | None = None
    verified: bool | None = None
    external_id: str | None = None
    title: str | None = None


@dataclass
class ParseResult:
    rows: list[NormalizedReview] = field(default_factory=list)
    total: int = 0
    invalid: int = 0
    errors: list[dict] = field(default_factory=list)
    columns: dict[str, str] = field(default_factory=dict)


def normalize_text(value: str) -> str:
    value = html.unescape(_TAG.sub(" ", value))
    value = _CTRL.sub("", value)
    value = "\n".join(_WS.sub(" ", line).strip() for line in value.replace("\r\n", "\n").split("\n"))
    return re.sub(r"\n{3,}", "\n\n", value).strip()


def parse_rating(value: object) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    raw = str(value).strip().lower().replace("stars", "").replace("star", "").replace("★", "").strip()
    m = re.match(r"^(\d+(?:[.,]\d+)?)\s*(?:/\s*(\d+))?", raw)
    if not m:
        raise IngestionError(f"Unrecognized rating '{value}'")
    num = float(m.group(1).replace(",", "."))
    scale = float(m.group(2)) if m.group(2) else (10.0 if num > 5 else 5.0)
    if scale <= 0 or num < 0 or num > scale:
        raise IngestionError(f"Rating '{value}' is out of range")
    return round(num / scale * 5, 2)


def parse_date(value: object) -> date | None:
    if value is None or str(value).strip() == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    raw = str(value).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
    except ValueError:
        raise IngestionError(f"Unrecognized date '{value}'")


def parse_bool(value: object) -> bool | None:
    if value is None or str(value).strip() == "":
        return None
    return str(value).strip().lower() in ("1", "true", "yes", "y", "verified", "verified purchase")


def _map_columns(headers: list[str]) -> dict[str, str]:
    normalized = {re.sub(r"[^a-z0-9]+", "_", h.strip().lower()).strip("_"): h for h in headers if h}
    mapping: dict[str, str] = {}
    for target, aliases in ALIASES.items():
        for alias in aliases:
            if alias in normalized and normalized[alias] not in mapping.values():
                mapping[target] = normalized[alias]
                break
    if "text" not in mapping:
        raise IngestionError(
            "Could not find a review text column. Name it one of: review_text, review, text, comment, feedback."
        )
    return mapping


def normalize_row(raw: dict[str, object], mapping: dict[str, str]) -> NormalizedReview:
    def get(key: str) -> object:
        col = mapping.get(key)
        return raw.get(col) if col else None

    text = normalize_text(str(get("text") or ""))
    if len(text) < 3:
        raise IngestionError("Review text is empty or too short")
    if len(text) > MAX_TEXT:
        text = text[:MAX_TEXT]

    def s(key: str, n: int) -> str | None:
        v = get(key)
        return normalize_text(str(v))[:n] or None if v not in (None, "") else None

    return NormalizedReview(
        text=text, rating=parse_rating(get("rating")), review_date=parse_date(get("review_date")),
        reviewer_name=s("reviewer_name", 200), platform=s("platform", 80), business=s("business", 200),
        product_name=s("product_name", 300), location=s("location", 200), verified=parse_bool(get("verified")),
        external_id=s("external_id", 200), title=s("title", 500),
    )


def _rows_to_result(headers: list[str], rows: list[dict[str, object]], max_rows: int) -> ParseResult:
    mapping = _map_columns(headers)
    result = ParseResult(columns=mapping)
    for i, raw in enumerate(rows, start=2):  # row 1 = header
        if all(v in (None, "") for v in raw.values()):
            continue
        result.total += 1
        if result.total > max_rows:
            raise IngestionError(f"File has more than {max_rows:,} rows. Split it into smaller files.")
        try:
            result.rows.append(normalize_row(raw, mapping))
        except IngestionError as exc:
            result.invalid += 1
            if len(result.errors) < 50:
                result.errors.append({"row": i, "error": str(exc)})
    return result


def parse_csv(data: bytes, max_rows: int) -> ParseResult:
    for encoding in ("utf-8-sig", "utf-16", "cp1252"):
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise IngestionError("Could not decode the file. Save it as UTF-8 CSV.")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    if not reader.fieldnames:
        raise IngestionError("The file has no header row.")
    return _rows_to_result(list(reader.fieldnames), list(reader), max_rows)


def parse_excel(data: bytes, max_rows: int) -> ParseResult:
    from openpyxl import load_workbook

    try:
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001
        raise IngestionError(f"Could not read the Excel file: {exc}")
    ws = wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    try:
        headers = [str(h).strip() if h is not None else "" for h in next(it)]
    except StopIteration:
        raise IngestionError("The spreadsheet is empty.")
    rows = []
    for values in it:
        rows.append({headers[i]: v for i, v in enumerate(values) if i < len(headers) and headers[i]})
        if len(rows) > max_rows + 1:
            break
    wb.close()
    return _rows_to_result([h for h in headers if h], rows, max_rows)


def parse_upload(filename: str, data: bytes, max_rows: int) -> ParseResult:
    name = filename.lower()
    if name.endswith((".xlsx", ".xlsm")):
        return parse_excel(data, max_rows)
    if name.endswith((".csv", ".tsv", ".txt")):
        return parse_csv(data, max_rows)
    raise IngestionError("Unsupported file type. Upload a .csv or .xlsx file.")


def content_hash(r: NormalizedReview, business_key: str) -> str:
    key = "|".join([
        business_key.lower(), re.sub(r"\s+", " ", r.text.lower()).strip(), f"{r.rating or ''}",
        r.review_date.isoformat() if r.review_date else "", (r.reviewer_name or "").lower(),
    ])
    return hashlib.sha256(key.encode()).hexdigest()


async def get_or_create_business(db: AsyncSession, project: Project, name: str | None, *,
                                 entity_type: str = "business") -> Business:
    primary_name = project.business_name or project.name
    name = (name or primary_name).strip()[:200]
    biz = await db.scalar(select(Business).where(Business.project_id == project.id, Business.name == name,
                                                 Business.deleted_at.is_(None)))
    if biz:
        return biz
    biz = Business(workspace_id=project.workspace_id, project_id=project.id, name=name,
                   is_primary=name.lower() == primary_name.lower(), entity_type=entity_type,
                   industry=project.industry, country=project.country, city=project.city, is_demo=project.is_demo)
    db.add(biz)
    await db.flush()
    return biz


async def insert_reviews(db: AsyncSession, project: Project, rows: list[NormalizedReview], *,
                         source_id: uuid.UUID | None, default_platform: str | None = None,
                         business_id: uuid.UUID | None = None, is_demo: bool = False) -> tuple[int, int]:
    """Insert normalized reviews, skipping duplicates (in-file and already stored). Returns (inserted, duplicates)."""
    businesses: dict[str, Business] = {}
    seen: set[str] = set()
    values = []
    fixed_business = await db.get(Business, business_id) if business_id else None
    for r in rows:
        if fixed_business:
            biz = fixed_business
        else:
            key = (r.business or project.business_name or project.name).strip().lower()
            if key not in businesses:
                businesses[key] = await get_or_create_business(db, project, r.business)
            biz = businesses[key]
        h = content_hash(r, biz.name)
        if h in seen:
            continue
        seen.add(h)
        values.append({
            "id": uuid.uuid4(), "workspace_id": project.workspace_id, "project_id": project.id, "business_id": biz.id,
            "source_id": source_id, "external_id": r.external_id, "platform": r.platform or default_platform,
            "product_name": r.product_name, "reviewer_name": r.reviewer_name, "rating": r.rating, "title": r.title,
            "text": r.text, "review_date": r.review_date, "location": r.location, "verified": r.verified,
            "language": detect_language(r.text), "content_hash": h, "analysis_status": "pending", "is_demo": is_demo,
        })
    inserted = 0
    for i in range(0, len(values), 500):
        chunk = values[i:i + 500]
        stmt = pg_insert(Review).values(chunk).on_conflict_do_nothing(constraint="uq_reviews_project_hash")
        res = await db.execute(stmt.returning(Review.id))
        inserted += len(res.fetchall())
    return inserted, len(rows) - inserted
