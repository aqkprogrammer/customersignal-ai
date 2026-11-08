"""Structured-output schemas. Every AI response is validated against one of these before it touches the database."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Sentiment = Literal["positive", "neutral", "negative"]
Emotion = Literal["joy", "satisfaction", "trust", "neutral", "confusion", "disappointment", "frustration", "anger"]
Impact = Literal["low", "medium", "high"]


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(v)))


class ExtractedSignal(BaseModel):
    category: str = Field(description="Category slug from the allowed list")
    label: str = Field(description="Short normalized description of the issue/praise, max ~8 words")
    excerpt: str = Field(description="Verbatim quote copied exactly from the review text")
    severity: int = Field(default=3, description="1 (minor) to 5 (critical)")

    @field_validator("severity")
    @classmethod
    def _sev(cls, v: int) -> int:
        return int(_clamp(v, 1, 5))


class FeatureRequest(BaseModel):
    label: str
    excerpt: str


class ReviewAnalysisItem(BaseModel):
    ref: str = Field(description="The review reference id exactly as given, e.g. R3")
    language: str = Field(description="ISO 639-1 code of the review's language")
    translation: str | None = Field(description="English translation if the review is not in English, else null")
    sentiment: Sentiment
    sentiment_score: float = Field(description="-1.0 (very negative) to 1.0 (very positive)")
    emotion: Emotion
    confidence: float = Field(description="0.0 to 1.0")
    complaints: list[ExtractedSignal]
    praises: list[ExtractedSignal]
    feature_requests: list[FeatureRequest]
    topics: list[str] = Field(description="1-4 short topic tags")
    explanation: str = Field(description="One or two sentences explaining the classification")

    @field_validator("sentiment_score")
    @classmethod
    def _score(cls, v: float) -> float:
        return _clamp(v, -1, 1)

    @field_validator("confidence")
    @classmethod
    def _conf(cls, v: float) -> float:
        return _clamp(v, 0, 1)


class ReviewBatchAnalysis(BaseModel):
    items: list[ReviewAnalysisItem]


class ClusterName(BaseModel):
    key: str
    label: str = Field(description="Concise name for the recurring theme, max ~6 words")
    summary: str = Field(description="One sentence describing what customers say")


class ClusterNaming(BaseModel):
    clusters: list[ClusterName]


class OpportunityItem(BaseModel):
    title: str
    description: str = Field(description="What the evidence shows, citing counts")
    recommendation: str = Field(description="Concrete actions to take")
    opportunity_type: Literal["fix_complaint", "new_feature", "positioning", "pricing", "service", "competitor_gap"]
    impact: Impact
    effort: Impact
    cluster_keys: list[str] = Field(description="Keys of the themes that support this opportunity")


class ProjectInsights(BaseModel):
    executive_summary: str
    key_findings: list[str]
    opportunities: list[OpportunityItem]


class RankedIssue(BaseModel):
    cluster_key: str
    title: str
    why_it_matters: str


class SolutionItem(BaseModel):
    title: str
    description: str


class OutreachPack(BaseModel):
    executive_summary: str
    issues: list[RankedIssue]
    opportunities: list[SolutionItem]
    solutions: list[SolutionItem]
    cold_email_subject: str
    cold_email: str
    linkedin_message: str
    follow_up_email: str


class EvidencedPoint(BaseModel):
    point: str
    evidence_refs: list[str] = Field(description="Review refs (e.g. R4) that support the point")


class FeatureRecommendation(BaseModel):
    title: str
    rationale: str
    priority: Impact


class PositioningAngle(BaseModel):
    angle: str
    rationale: str


class RoadmapPhase(BaseModel):
    phase: str
    items: list[str]


class GapReport(BaseModel):
    summary: str
    opportunity_score: int = Field(description="0-100: size of the improvement opportunity")
    likes: list[EvidencedPoint]
    dislikes: list[EvidencedPoint]
    wishes: list[EvidencedPoint]
    missing_features: list[EvidencedPoint]
    quality_complaints: list[EvidencedPoint]
    price_value: list[EvidencedPoint]
    unmet_expectations: list[EvidencedPoint]
    competitor_advantages: list[EvidencedPoint]
    feature_recommendations: list[FeatureRecommendation]
    positioning: list[PositioningAngle]
    roadmap: list[RoadmapPhase]

    @field_validator("opportunity_score")
    @classmethod
    def _score(cls, v: int) -> int:
        return int(_clamp(v, 0, 100))


class CompetitorProfile(BaseModel):
    business_key: str
    strengths: list[str]
    weaknesses: list[str]


class CompetitorAnalysis(BaseModel):
    summary: str
    profiles: list[CompetitorProfile]
    market_positioning: str
    opportunities: list[SolutionItem]


class ReportNarrative(BaseModel):
    executive_summary: str
    key_findings: list[str]
    recommendations: list[str]


def to_strict_json_schema(model: type[BaseModel]) -> dict:
    """Pydantic JSON schema -> strict structured-output schema (all props required, no extras, no unsupported keywords)."""
    schema = model.model_json_schema()
    drop = {"title", "default", "minimum", "maximum", "minLength", "maxLength", "maxItems", "pattern", "format",
            "exclusiveMinimum", "exclusiveMaximum"}

    def walk(node: object) -> object:
        if isinstance(node, dict):
            out = {k: walk(v) for k, v in node.items() if k not in drop}
            if isinstance(node.get("properties"), dict):
                # Property *names* (e.g. a field called "title") are data, not keywords: never drop them.
                out["properties"] = {k: walk(v) for k, v in node["properties"].items()}
            if out.get("type") == "object" and "properties" in out:
                out["additionalProperties"] = False
                out["required"] = list(out["properties"].keys())
            return out
        if isinstance(node, list):
            return [walk(v) for v in node]
        return node

    return walk(schema)  # type: ignore[return-value]
