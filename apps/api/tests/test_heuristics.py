"""Unit tests for the built-in heuristic engine and the strict structured-output schema converter."""

from __future__ import annotations

import pytest
from pydantic import BaseModel

from app.ai import heuristics, schemas
from app.ai.schemas import to_strict_json_schema
from app.services.seed_reference import SYSTEM_CATEGORIES

CATS = {c["slug"]: c["keywords"] for c in SYSTEM_CATEGORIES}


def classify(text: str, rating: float | None = None):
    return heuristics.classify_review("R1", text, rating, CATS)


def test_positive_and_negative_polarity_with_ratings():
    pos = classify("Amazing food and friendly staff, I would recommend it!", 5)
    assert pos.sentiment == "positive" and pos.sentiment_score > 0.5
    neg = classify("Terrible experience. The staff were rude and the room was dirty.", 1)
    assert neg.sentiment == "negative" and neg.sentiment_score < -0.5
    assert neg.ref == "R1"


def test_rating_dominates_mild_text():
    assert classify("It was fine.", 5).sentiment == "positive"
    assert classify("It was fine.", 1).sentiment == "negative"
    assert classify("It was fine.", None).sentiment == "neutral"


def test_negation_flips_positive_words():
    pos, neg, _ = heuristics._polarity("The food was not good.")
    assert (pos, neg) == (0, 1)
    pos2, neg2, _ = heuristics._polarity("The food was good.")
    assert (pos2, neg2) == (1, 0)
    assert classify("The service was not good and not friendly.").sentiment == "negative"
    assert classify("Honestly, the coffee wasn't great.").sentiment_score < 0


def test_category_extraction():
    item = classify("The prices are far too expensive. We waited 40 minutes for a table.", 2)
    complaint_cats = {c.category for c in item.complaints}
    assert {"pricing", "waiting_time"} <= complaint_cats
    praise = classify("Spotless and clean rooms, very friendly staff.", 5)
    assert {"cleanliness", "staff_behavior"} <= {p.category for p in praise.praises}
    assert not praise.complaints


def test_low_rated_topic_sentence_without_positive_cue_is_complaint():
    item = classify("The final bill was much higher than quoted.", 2)
    assert any(c.category == "pricing" for c in item.complaints)


@pytest.mark.parametrize("text,rating", [
    ("Delivery was late. The package arrived damaged! Customer support never replied.", 1),
    ("Great value for money and the staff were lovely.\nWould love an online booking option.", 5),
    ("Ok product but the battery stopped working after a week; I wish they had a longer warranty.", 2),
])
def test_excerpts_are_verbatim_substrings(text, rating):
    item = classify(text, rating)
    signals = [*item.complaints, *item.praises, *item.feature_requests]
    assert signals
    for s in signals:
        assert s.excerpt in text


def test_feature_request_detection():
    item = classify("Nice app. I wish they would add a dark mode.", 4)
    assert item.feature_requests and "wish" in item.feature_requests[0].excerpt


def test_arabic_language_detection():
    assert heuristics.detect_language("الخدمة ممتازة والموظفين رائعين") == "ar"
    assert heuristics.detect_language("Обслуживание отличное") == "ru"
    assert heuristics.detect_language("Great service") == "en"
    assert heuristics.detect_language("12345 !!!") == "en"
    item = classify("الخدمة ممتازة جدا", 5)
    assert item.language == "ar" and item.sentiment == "positive"


def test_emotion_and_confidence_bounds():
    item = classify("Absolutely disgusting and unacceptable, the worst visit ever.", 1)
    assert item.emotion == "anger"
    assert 0.0 <= item.confidence <= 1.0 and -1.0 <= item.sentiment_score <= 1.0


# --------------------------------------------------------------------------------- strict JSON schema
STRICT_MODELS = [schemas.ReviewBatchAnalysis, schemas.ClusterNaming, schemas.ProjectInsights, schemas.OutreachPack,
                 schemas.GapReport, schemas.CompetitorAnalysis, schemas.ReportNarrative]


def _object_nodes(node):
    if isinstance(node, dict):
        if node.get("type") == "object":
            yield node
        for v in node.values():
            yield from _object_nodes(v)
    elif isinstance(node, list):
        for v in node:
            yield from _object_nodes(v)


@pytest.mark.parametrize("model", STRICT_MODELS, ids=lambda m: m.__name__)
def test_strict_schema_has_no_extras_and_requires_everything(model):
    strict = to_strict_json_schema(model)
    objects = list(_object_nodes(strict))
    assert objects
    for obj in objects:
        assert obj["additionalProperties"] is False
        assert sorted(obj["required"]) == sorted(obj["properties"])
    # Unsupported keywords are removed everywhere except as property names.
    text = repr(strict)
    for kw in ("'default':", "'minimum':", "'maximum':", "'format':"):
        assert kw not in text


def _all_models(model: type[BaseModel], seen=None):
    seen = seen or {}
    seen[model.__name__] = model
    for f in model.model_fields.values():
        for arg in [f.annotation, *getattr(f.annotation, "__args__", ())]:
            if isinstance(arg, type) and issubclass(arg, BaseModel) and arg.__name__ not in seen:
                _all_models(arg, seen)
    return seen


@pytest.mark.parametrize("model", STRICT_MODELS, ids=lambda m: m.__name__)
def test_strict_schema_keeps_every_model_field(model):
    """Regression: fields literally named like dropped keywords (e.g. `title`) must not disappear."""
    strict = to_strict_json_schema(model)
    defs = strict.get("$defs", {})
    for name, sub in _all_models(model).items():
        node = strict if sub is model else defs[name]
        assert set(node["properties"]) == set(sub.model_fields), name
        assert set(node["required"]) == set(sub.model_fields), name
