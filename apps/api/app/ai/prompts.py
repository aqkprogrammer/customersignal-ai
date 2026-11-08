"""Versioned prompts. Bump the version when a prompt changes; it is stored with every result for traceability."""

from __future__ import annotations

import json

PROMPT_VERSIONS = {
    "classify_reviews": "v3",
    "name_clusters": "v2",
    "project_insights": "v2",
    "outreach_pack": "v2",
    "gap_report": "v2",
    "competitor_analysis": "v1",
    "report_narrative": "v1",
}

GROUNDING = (
    "Ground every statement strictly in the review data provided. Never invent reviews, quotes, numbers or "
    "problems. Quotes ('excerpt' fields) must be copied verbatim from the review text. If the data does not "
    "support a claim, leave it out."
)

CLASSIFY_SYSTEM = (
    "You are a customer-feedback analyst. For each review, classify sentiment and emotion, detect language, "
    "translate non-English reviews to English, and extract complaints, praise and feature requests. "
    + GROUNDING
)


def classify_prompt(reviews: list[dict], categories: list[dict]) -> str:
    cat_lines = "\n".join(f"- {c['slug']}: {c['name']}" for c in categories)
    return (
        f"Allowed category slugs:\n{cat_lines}\n\n"
        "Rules:\n"
        "- Return exactly one item per review, using its ref.\n"
        "- complaints/praises: use an allowed category slug; label is a short normalized theme (e.g. 'Long waiting "
        "times') so similar issues across reviews share the same label; excerpt is an exact quote.\n"
        "- sentiment_score: -1 to 1, consistent with the star rating when present.\n"
        "- translation: English translation when language is not 'en', otherwise null.\n\n"
        f"Reviews (JSON):\n{json.dumps(reviews, ensure_ascii=False)}"
    )


NAMING_SYSTEM = "You name recurring themes in customer feedback concisely and neutrally. " + GROUNDING


def naming_prompt(clusters: list[dict]) -> str:
    return ("For each cluster of similar customer statements, give a concise theme name and one-sentence summary.\n\n"
            f"Clusters (JSON):\n{json.dumps(clusters, ensure_ascii=False)}")


INSIGHTS_SYSTEM = (
    "You are a senior customer-intelligence consultant. Turn aggregated review themes into an executive summary, "
    "key findings and prioritized business opportunities with concrete recommendations. " + GROUNDING
)


def insights_prompt(business: str, stats: dict, clusters: list[dict]) -> str:
    return (f"Business/project: {business}\nDataset statistics: {json.dumps(stats)}\n\n"
            f"Themes (key, kind, category, label, review count, avg rating, severity 0-100, trend, sample quotes):\n"
            f"{json.dumps(clusters, ensure_ascii=False)}\n\n"
            "Return 3-7 opportunities ordered by impact. Reference supporting theme keys in cluster_keys.")


OUTREACH_SYSTEM = (
    "You write respectful, specific B2B outreach for a consultant who helps businesses fix customer-experience "
    "problems. Tone: helpful, concise, never shaming. Refer only to issues present in the provided public-review "
    "analysis, and describe them as patterns in public reviews (not as facts about the business). Use the "
    "placeholders {first_name} and {sender_name}. " + GROUNDING
)


def outreach_prompt(business: str, context: dict, issues: list[dict], sender: dict) -> str:
    return (f"Target business: {business}\nContext: {json.dumps(context, ensure_ascii=False)}\n"
            f"Sender: {json.dumps(sender, ensure_ascii=False)}\n\n"
            f"Ranked recurring issues from the business's review dataset (with counts and verbatim evidence):\n"
            f"{json.dumps(issues, ensure_ascii=False)}\n\n"
            "Produce: executive summary, ranked issues (use the given cluster_key values), business improvement "
            "opportunities, recommended solutions, a cold email (<170 words) with subject, a LinkedIn message "
            "(<300 characters) and a follow-up email (<120 words).")


GAP_SYSTEM = (
    "You are a product strategist analysing honest mid-rating (3-star) customer reviews to find product gaps, "
    "unmet expectations and positioning opportunities. Cite supporting review refs in evidence_refs. " + GROUNDING
)


def gap_prompt(product: str, reviews: list[dict], competitor: str | None, competitor_reviews: list[dict]) -> str:
    comp = (f"\n\nCompetitor product: {competitor}\nCompetitor reviews (JSON):\n"
            f"{json.dumps(competitor_reviews, ensure_ascii=False)}") if competitor_reviews else ""
    return (f"Product: {product}\nThree-star reviews (JSON):\n{json.dumps(reviews, ensure_ascii=False)}{comp}\n\n"
            "Produce the gap report. opportunity_score reflects how large and addressable the gaps are.")


COMPETITOR_SYSTEM = "You compare businesses using aggregated review statistics and themes. " + GROUNDING


def competitor_prompt(businesses: list[dict]) -> str:
    return ("Compare these businesses (use the given business_key values). Identify strengths, weaknesses, market "
            f"positioning and opportunities.\n\n{json.dumps(businesses, ensure_ascii=False)}")


NARRATIVE_SYSTEM = "You write crisp executive report narratives from customer-review analytics. " + GROUNDING


def narrative_prompt(report_type: str, title: str, stats: dict, clusters: list[dict]) -> str:
    return (f"Report type: {report_type}\nTitle: {title}\nStatistics: {json.dumps(stats)}\n"
            f"Themes: {json.dumps(clusters, ensure_ascii=False)}\n\n"
            "Write an executive summary (<=120 words), 4-6 key findings and 3-6 recommendations.")
