"""Built-in, deterministic analysis engine used when no AI provider is configured (and by the test mock).

It is intentionally transparent: every signal it emits is backed by a verbatim sentence from the review, and
results are labelled with provider="heuristic" so the UI can tell users that a configured LLM gives deeper analysis.
"""

from __future__ import annotations

import math
import re
from collections import Counter

from app.ai.schemas import (
    CompetitorAnalysis,
    CompetitorProfile,
    EvidencedPoint,
    ExtractedSignal,
    FeatureRecommendation,
    FeatureRequest,
    GapReport,
    OpportunityItem,
    OutreachPack,
    PositioningAngle,
    ProjectInsights,
    RankedIssue,
    ReportNarrative,
    ReviewAnalysisItem,
    RoadmapPhase,
    SolutionItem,
)

POSITIVE = {
    "good", "great", "excellent", "amazing", "awesome", "love", "loved", "lovely", "fantastic", "perfect", "best",
    "friendly", "helpful", "clean", "fast", "quick", "recommend", "recommended", "happy", "pleased", "satisfied",
    "wonderful", "delicious", "professional", "beautiful", "comfortable", "easy", "reliable", "fresh", "polite",
    "attentive", "efficient", "worth", "nice", "smooth", "outstanding", "impressed", "brilliant", "superb", "kind",
    "affordable", "reasonable", "caring", "on time", "spotless", "gentle", "tasty", "accurate", "sturdy",
    "ممتاز", "رائع", "جميل", "شكرا",
}
NEGATIVE = {
    "bad", "terrible", "awful", "horrible", "worst", "poor", "rude", "slow", "dirty", "expensive", "overpriced",
    "disappointed", "disappointing", "never", "waited", "waiting", "late", "cold", "broken", "broke", "unprofessional",
    "ignored", "unacceptable", "disgusting", "useless", "problem", "issue", "issues", "complaint", "refund", "wrong",
    "missing", "damaged", "delay", "delayed", "hidden", "cancelled", "canceled", "confusing", "difficult", "noisy",
    "unhelpful", "careless", "stale", "flimsy", "cheaply", "fake", "lost", "mess", "messy", "crowded", "pushy",
    "nobody", "frustrating", "annoying", "stopped", "failed", "leaked", "leaks", "smell", "smelled", "hours",
    "سيء", "غالي", "تأخير", "انتظار",
}
NEGATIONS = {"not", "no", "never", "n't", "hardly", "barely", "without"}
EMOTION_WORDS = {
    "anger": {"rude", "terrible", "worst", "angry", "disgusting", "unacceptable", "furious", "scam", "ridiculous"},
    "frustration": {"waited", "again", "still", "third", "forever", "frustrating", "annoying", "hours", "nobody"},
    "disappointment": {"disappointed", "disappointing", "expected", "unfortunately", "letdown", "mediocre"},
    "confusion": {"confusing", "unclear", "confused", "complicated"},
    "joy": {"love", "loved", "amazing", "fantastic", "wonderful", "brilliant", "delighted", "superb"},
    "trust": {"professional", "reliable", "trust", "honest", "safe", "consistent"},
    "satisfaction": {"good", "great", "satisfied", "recommend", "happy", "pleased", "nice", "worth"},
}
FEATURE_CUES = ("wish", "would be nice", "would be great", "should add", "please add", "if only", "would love",
                "hope they", "needs a", "need a", "should have", "could use", "missing a", "lacks", "no option")

CATEGORY_LABELS: dict[str, tuple[str, str]] = {
    # slug: (complaint label, praise label)
    "pricing": ("Pricing feels too high or unclear", "Good value for money"),
    "customer_service": ("Unhelpful customer service", "Helpful customer service"),
    "waiting_time": ("Long waiting times", "Fast, on-time service"),
    "product_quality": ("Product quality problems", "High product quality"),
    "delivery": ("Delivery problems", "Smooth delivery"),
    "appointment_management": ("Difficult booking & appointments", "Easy booking"),
    "staff_behavior": ("Unprofessional staff behavior", "Friendly, professional staff"),
    "usability": ("Hard to use", "Easy to use"),
    "communication": ("Poor communication & follow-up", "Clear communication"),
    "reliability": ("Unreliable / inconsistent", "Reliable and consistent"),
    "cleanliness": ("Cleanliness concerns", "Clean environment"),
    "other": ("General dissatisfaction", "Overall positive experience"),
}

RECOMMENDATIONS: dict[str, tuple[str, str]] = {
    "pricing": ("Make pricing transparent",
                "Publish clear price lists, quote totals before service, and bundle popular options to reduce "
                "surprise charges."),
    "customer_service": ("Upgrade the customer-service playbook",
                         "Set response-time targets, give front-line staff authority to resolve common issues, and "
                         "track resolution in a shared inbox."),
    "waiting_time": ("Reduce waiting times",
                     "Introduce staggered scheduling, real-time queue updates by SMS/WhatsApp, and measure "
                     "time-to-serve weekly."),
    "product_quality": ("Fix recurring quality defects",
                        "Add a quality checkpoint before items reach customers and review supplier/material specs for "
                        "the issues customers describe."),
    "delivery": ("Make delivery predictable",
                 "Provide live tracking, tighter delivery windows and protective packaging; follow up on damaged "
                 "orders proactively."),
    "appointment_management": ("Simplify booking",
                               "Offer online self-service booking with instant confirmation, reminders and easy "
                               "rescheduling."),
    "staff_behavior": ("Invest in staff training",
                       "Run service-standards training, use mystery-shopper checks, and recognise staff mentioned "
                       "positively."),
    "usability": ("Improve ease of use",
                  "Simplify onboarding, add clear instructions and fix the specific friction points customers "
                  "mention."),
    "communication": ("Close the communication loop",
                      "Confirm every request, send proactive status updates, and guarantee a call-back window."),
    "reliability": ("Improve consistency",
                    "Standardise processes and monitor the failure points customers report."),
    "cleanliness": ("Raise cleanliness standards", "Introduce visible cleaning schedules and spot checks."),
    "other": ("Investigate general dissatisfaction",
              "Interview recent unhappy customers to identify the root cause behind uncategorised complaints."),
}

_SENT_SPLIT = re.compile(r"(?<=[.!?؟])\s+|\n+")
_WORD = re.compile(r"[a-zA-Z؀-ۿ']+")


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENT_SPLIT.split(text) if len(s.strip()) > 2]


def detect_language(text: str) -> str:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return "en"
    arabic = sum(1 for c in letters if "؀" <= c <= "ۿ")
    if arabic / len(letters) > 0.3:
        return "ar"
    cyr = sum(1 for c in letters if "Ѐ" <= c <= "ӿ")
    if cyr / len(letters) > 0.3:
        return "ru"
    hindi = sum(1 for c in letters if "ऀ" <= c <= "ॿ")
    if hindi / len(letters) > 0.3:
        return "hi"
    return "en"


def _polarity(sentence: str) -> tuple[int, int, list[str]]:
    lower = sentence.lower()
    words = _WORD.findall(lower)
    pos = neg = 0
    hits: list[str] = []
    for i, w in enumerate(words):
        negated = any(words[j] in NEGATIONS or words[j].endswith("n't") for j in range(max(0, i - 3), i))
        if w in POSITIVE:
            if negated:
                neg += 1
            else:
                pos += 1
            hits.append(w)
        elif w in NEGATIVE:
            if negated:
                pos += 0  # "not bad" -> mildly positive/neutral; ignore
            else:
                neg += 1
            hits.append(w)
    for phrase in ("on time", "value for money", "stopped working", "never again", "waste of money"):
        if phrase in lower:
            if phrase in ("on time", "value for money") and "not" not in lower:
                pos += 1
            else:
                neg += 1
            hits.append(phrase)
    return pos, neg, hits


def _categories_for(sentence: str, categories: dict[str, list[str]]) -> list[str]:
    lower = sentence.lower()
    found = []
    for slug, keywords in categories.items():
        if any(re.search(rf"\b{re.escape(k)}", lower) for k in keywords):
            found.append(slug)
    return found


def classify_review(ref: str, text: str, rating: float | None, categories: dict[str, list[str]]) -> ReviewAnalysisItem:
    sentences = split_sentences(text) or [text.strip()]
    total_pos = total_neg = 0
    all_hits: list[str] = []
    complaints: list[ExtractedSignal] = []
    praises: list[ExtractedSignal] = []
    requests: list[FeatureRequest] = []
    seen_c: set[str] = set()
    seen_p: set[str] = set()

    for s in sentences:
        pos, neg, hits = _polarity(s)
        total_pos += pos
        total_neg += neg
        all_hits += hits
        cats = _categories_for(s, categories)
        lower = s.lower()
        if any(cue in lower for cue in FEATURE_CUES):
            requests.append(FeatureRequest(label=_short_label(s), excerpt=s))
        low_rating = rating is not None and rating <= 3
        # In low-rated reviews, a sentence about a topic with no positive cue is a complaint
        # ("The final bill was much higher than quoted."), as is anything introduced with "but".
        sentence_negative = neg > pos or (pos == 0 and cats and (low_rating or lower.startswith("but ")))
        sentence_positive = pos > neg and not lower.startswith("but ")
        for c in cats:
            if c == "other":
                continue
            if sentence_negative and c not in seen_c:
                seen_c.add(c)
                severity = 5 if (rating or 3) <= 1 else 4 if (rating or 3) <= 2 else 3 if (rating or 3) <= 3 else 2
                complaints.append(ExtractedSignal(category=c, label=CATEGORY_LABELS.get(c, (c, c))[0], excerpt=s,
                                                  severity=severity))
            elif sentence_positive and c not in seen_p:
                seen_p.add(c)
                praises.append(ExtractedSignal(category=c, label=CATEGORY_LABELS.get(c, (c, c))[1], excerpt=s,
                                               severity=1))

    lex = math.tanh((total_pos - total_neg) / 2.5)
    if rating is not None:
        rating_score = (float(rating) - 3) / 2
        score = 0.65 * rating_score + 0.35 * lex
    else:
        score = lex
    score = max(-1.0, min(1.0, score))
    sentiment = "positive" if score > 0.2 else "negative" if score < -0.2 else "neutral"

    if sentiment == "negative" and not complaints:
        worst = max(sentences, key=lambda s: _polarity(s)[1])
        complaints.append(ExtractedSignal(category="other", label=CATEGORY_LABELS["other"][0], excerpt=worst,
                                          severity=4 if (rating or 3) <= 2 else 3))
    if sentiment == "positive" and not praises:
        best = max(sentences, key=lambda s: _polarity(s)[0])
        praises.append(ExtractedSignal(category="other", label=CATEGORY_LABELS["other"][1], excerpt=best, severity=1))

    word_set = set(_WORD.findall(text.lower()))
    emotion_scores = {e: len(word_set & ws) for e, ws in EMOTION_WORDS.items()}
    emotion = max(emotion_scores, key=lambda e: emotion_scores[e])
    if emotion_scores[emotion] == 0:
        emotion = "satisfaction" if sentiment == "positive" else "disappointment" if sentiment == "negative" else "neutral"

    topics = sorted({c.category for c in complaints} | {p.category for p in praises})[:4] or ["general"]
    explanation_parts = []
    if rating is not None:
        explanation_parts.append(f"Rated {rating:g}/5")
    if all_hits:
        uniq = list(dict.fromkeys(all_hits))[:5]
        explanation_parts.append("sentiment cues: " + ", ".join(f"'{h}'" for h in uniq))
    if complaints:
        explanation_parts.append("complaints about " + ", ".join(sorted({c.category.replace('_', ' ') for c in complaints})))
    explanation = ("; ".join(explanation_parts) or "No strong sentiment cues found") + \
        ". (Built-in keyword engine — configure an AI provider for deeper analysis.)"
    confidence = min(0.9, 0.45 + 0.1 * (len(all_hits) + (2 if rating is not None else 0)))

    return ReviewAnalysisItem(
        ref=ref, language=detect_language(text), translation=None, sentiment=sentiment,
        sentiment_score=round(score, 3), emotion=emotion, confidence=round(confidence, 2),
        complaints=complaints, praises=praises, feature_requests=requests[:3], topics=topics,
        explanation=explanation,
    )


def _short_label(sentence: str) -> str:
    s = re.sub(r"\s+", " ", sentence).strip().rstrip(".!")
    return s if len(s) <= 80 else s[:77].rsplit(" ", 1)[0] + "…"


# ------------------------------------------------------------------------------------------ insights
def project_insights(clusters: list[dict], stats: dict) -> ProjectInsights:
    """clusters: [{key, kind, category, label, count, avg_rating, severity, trend}]"""
    complaints = [c for c in clusters if c["kind"] == "complaint"]
    praises = [c for c in clusters if c["kind"] == "praise" and c["category"] != "other"] or \
        [c for c in clusters if c["kind"] == "praise"]
    requests = [c for c in clusters if c["kind"] == "feature_request"]
    total = stats.get("total", 0) or 1
    findings = [
        f"{stats.get('total', 0)} reviews analyzed: {stats.get('positive_pct', 0)}% positive, "
        f"{stats.get('negative_pct', 0)}% negative, average rating {stats.get('avg_rating') or 'n/a'}."
    ]
    for c in complaints[:3]:
        findings.append(f"'{c['label']}' appears in {c['count']} reviews ({round(100 * c['count'] / total)}%), "
                        f"trend: {c['trend']}.")
    if praises:
        findings.append(f"Top strength: '{praises[0]['label']}' ({praises[0]['count']} mentions).")

    opps: list[OpportunityItem] = []
    for c in complaints[:5]:
        title, rec = RECOMMENDATIONS.get(c["category"], RECOMMENDATIONS["other"])
        opps.append(OpportunityItem(
            title=title,
            description=f"{c['count']} reviews ({round(100 * c['count'] / total)}%) describe '{c['label'].lower()}'"
                        f" with an average rating of {c['avg_rating'] or 'n/a'}; trend is {c['trend']}.",
            recommendation=rec,
            opportunity_type="pricing" if c["category"] == "pricing" else
            "service" if c["category"] in ("customer_service", "staff_behavior", "communication", "waiting_time",
                                           "appointment_management") else "fix_complaint",
            impact="high" if c["severity"] >= 60 else "medium" if c["severity"] >= 35 else "low",
            effort="medium", cluster_keys=[c["key"]],
        ))
    for r in requests[:2]:
        opps.append(OpportunityItem(
            title=f"Consider: {r['label'][:70]}",
            description=f"{r['count']} customer(s) explicitly asked for this.",
            recommendation="Validate demand with a short survey or waitlist before building.",
            opportunity_type="new_feature", impact="medium" if r["count"] > 2 else "low", effort="medium",
            cluster_keys=[r["key"]],
        ))
    if praises:
        p = praises[0]
        opps.append(OpportunityItem(
            title=f"Lead marketing with '{p['label'].lower()}'",
            description=f"{p['count']} reviews praise this — it is a proven differentiator.",
            recommendation="Feature this strength in ads, landing pages and review-response templates.",
            opportunity_type="positioning", impact="medium", effort="low", cluster_keys=[p["key"]],
        ))
    top = complaints[0]["label"].lower() if complaints else "no dominant complaint"
    summary = (f"Across {stats.get('total', 0)} reviews, sentiment is {stats.get('positive_pct', 0)}% positive and "
               f"{stats.get('negative_pct', 0)}% negative. The most significant recurring issue is {top}."
               + (f" Customers consistently value {praises[0]['label'].lower()}." if praises else ""))
    return ProjectInsights(executive_summary=summary, key_findings=findings, opportunities=opps)


def outreach_pack(business: str, city: str | None, industry: str | None, issues: list[dict], stats: dict,
                  sender_company: str | None) -> OutreachPack:
    """issues: ranked clusters [{key, label, category, count, severity, avg_rating}]"""
    where = f" in {city}" if city else ""
    top = issues[:4]
    ranked = [RankedIssue(cluster_key=i["key"], title=i["label"],
                          why_it_matters=f"Mentioned in {i['count']} reviews (avg rating {i['avg_rating'] or 'n/a'}); "
                                         f"severity {round(i['severity'])}/100.") for i in top]
    solutions = [SolutionItem(title=RECOMMENDATIONS.get(i["category"], RECOMMENDATIONS["other"])[0],
                              description=RECOMMENDATIONS.get(i["category"], RECOMMENDATIONS["other"])[1]) for i in top]
    opps = [SolutionItem(title=f"Turn '{i['label'].lower()}' into a strength",
                         description=f"Fixing this addresses {i['count']} public complaints and can lift ratings.")
            for i in top[:3]]
    issue_lines = "\n".join(f"  • {i['label']} — {i['count']} reviews" for i in top) or "  • (no recurring issues found)"
    sender = sender_company or "our team"
    first_issue = top[0]["label"].lower() if top else "customer experience"
    email = (
        f"Hi {{first_name}},\n\nI was reading through recent public reviews of {business}{where} and noticed a few "
        f"recurring themes customers mention:\n\n{issue_lines}\n\nThese are very fixable, and addressing "
        f"{first_issue} alone could noticeably improve your ratings. At {sender}, we help "
        f"{industry or 'businesses'} like yours turn this kind of feedback into concrete improvements.\n\n"
        f"Would you be open to a 15-minute call next week? I'm happy to share the full review analysis.\n\n"
        f"Best regards,\n{{sender_name}}"
    )
    linkedin = (f"Hi {{first_name}} — I analyzed recent reviews of {business} and found {len(top)} recurring themes "
                f"(top one: {first_issue}). I put together a short summary with suggested fixes — happy to share it "
                f"if useful?")
    follow = (f"Hi {{first_name}},\n\nFollowing up on my note about {business}'s customer reviews. I've attached a "
              f"one-page summary of the main themes and quick wins. Even one change on {first_issue} tends to show "
              f"up in ratings within weeks.\n\nWorth a quick chat?\n\n{{sender_name}}")
    summary = (f"{business}{where} has {stats.get('total', 0)} reviews in this dataset with an average rating of "
               f"{stats.get('avg_rating') or 'n/a'} and {stats.get('negative_pct', 0)}% negative sentiment. "
               + (f"The top recurring issue is {first_issue}." if top else "No recurring issues were detected."))
    return OutreachPack(executive_summary=summary, issues=ranked, opportunities=opps, solutions=solutions,
                        cold_email_subject=f"Quick idea for {business} based on your reviews",
                        cold_email=email, linkedin_message=linkedin, follow_up_email=follow)


def gap_report(product: str, reviews: list[dict], competitor_reviews: list[dict], categories: dict[str, list[str]]) -> GapReport:
    """reviews: [{ref, text, rating}] — typically the 3-star subset; competitor_reviews likewise."""
    likes: dict[str, list[str]] = {}
    dislikes: dict[str, list[str]] = {}
    wishes: list[EvidencedPoint] = []
    quality: list[str] = []
    price: list[str] = []
    for r in reviews:
        item = classify_review(r["ref"], r["text"], r.get("rating"), categories)
        for p in item.praises:
            likes.setdefault(p.label, []).append(r["ref"])
        for c in item.complaints:
            dislikes.setdefault(c.label, []).append(r["ref"])
            if c.category == "product_quality":
                quality.append(r["ref"])
            if c.category == "pricing":
                price.append(r["ref"])
        for f in item.feature_requests:
            wishes.append(EvidencedPoint(point=f.label, evidence_refs=[r["ref"]]))
    comp_likes: dict[str, list[str]] = {}
    for r in competitor_reviews:
        item = classify_review(r["ref"], r["text"], r.get("rating"), categories)
        for p in item.praises:
            comp_likes.setdefault(p.label, []).append(r["ref"])

    def top(d: dict[str, list[str]], n: int = 5) -> list[EvidencedPoint]:
        return [EvidencedPoint(point=f"{k} ({len(v)} reviews)", evidence_refs=v[:5])
                for k, v in sorted(d.items(), key=lambda kv: -len(kv[1]))[:n]]

    own_dislike_labels = {k for k in dislikes}
    comp_adv = {k: v for k, v in comp_likes.items()
                if any(k.split()[0] in d for d in own_dislike_labels) or k not in likes}
    n = max(1, len(reviews))
    pain = sum(len(v) for v in dislikes.values())
    score = int(min(100, 25 + 60 * min(1.0, pain / (n * 1.5)) + 3 * min(5, len(wishes))))
    recs = [FeatureRecommendation(title=RECOMMENDATIONS.get(_cat_from_label(k), RECOMMENDATIONS["other"])[0],
                                  rationale=f"{len(v)} three-star reviews mention '{k.lower()}'.",
                                  priority="high" if len(v) >= max(2, n // 5) else "medium")
            for k, v in sorted(dislikes.items(), key=lambda kv: -len(kv[1]))[:4]]
    recs += [FeatureRecommendation(title=w.point[:80], rationale="Explicitly requested by a customer.", priority="medium")
             for w in wishes[:2]]
    positioning = [PositioningAngle(angle=f"Own '{k.lower()}'", rationale=f"Already praised in {len(v)} reviews.")
                   for k, v in sorted(likes.items(), key=lambda kv: -len(kv[1]))[:2]]
    if dislikes:
        worst = max(dislikes.items(), key=lambda kv: len(kv[1]))[0]
        positioning.append(PositioningAngle(angle=f"The {product.split(' ')[0]} that fixes '{worst.lower()}'",
                                            rationale="The most common frustration among undecided (3-star) buyers."))
    roadmap = [
        RoadmapPhase(phase="Now (0-30 days)", items=[r.title for r in recs[:2]] or ["Collect more reviews"]),
        RoadmapPhase(phase="Next (1-3 months)", items=[r.title for r in recs[2:4]] or ["Validate feature requests"]),
        RoadmapPhase(phase="Later (3-6 months)", items=[w.point[:80] for w in wishes[:2]] or ["Re-run gap analysis"]),
    ]
    summary = (f"Analyzed {len(reviews)} three-star reviews of {product}"
               + (f" and {len(competitor_reviews)} competitor reviews" if competitor_reviews else "")
               + f". Customers most often like {next(iter(sorted(likes, key=lambda k: -len(likes[k]))), 'n/a').lower()}"
               + f" but are held back by {next(iter(sorted(dislikes, key=lambda k: -len(dislikes[k]))), 'n/a').lower()}."
               + " (Built-in keyword engine — configure an AI provider for richer analysis.)")
    return GapReport(
        summary=summary, opportunity_score=score, likes=top(likes), dislikes=top(dislikes), wishes=wishes[:6],
        missing_features=wishes[:4], quality_complaints=[EvidencedPoint(point="Product quality concerns", evidence_refs=quality[:5])] if quality else [],
        price_value=[EvidencedPoint(point="Price vs. value concerns", evidence_refs=price[:5])] if price else [],
        unmet_expectations=top(dislikes, 3), competitor_advantages=top(comp_adv, 4),
        feature_recommendations=recs, positioning=positioning, roadmap=roadmap,
    )


def _cat_from_label(label: str) -> str:
    for slug, (c, _p) in CATEGORY_LABELS.items():
        if c == label:
            return slug
    return "other"


def competitor_analysis(businesses: list[dict]) -> CompetitorAnalysis:
    """businesses: [{key, name, avg_rating, positive_pct, negative_pct, praise_labels[], complaint_labels[]}]"""
    profiles = [CompetitorProfile(business_key=b["key"], strengths=b["praise_labels"][:4] or ["No clear strengths yet"],
                                  weaknesses=b["complaint_labels"][:4] or ["No recurring complaints"]) for b in businesses]
    ranked = sorted(businesses, key=lambda b: -(b["avg_rating"] or 0))
    leader = ranked[0]["name"] if ranked else "n/a"
    common_weak = Counter(w for b in businesses for w in b["complaint_labels"][:4]).most_common(3)
    opps = [SolutionItem(title=f"Win on '{w.lower()}'",
                         description=f"{n} of {len(businesses)} businesses are criticised for this — a market-wide gap.")
            for w, n in common_weak if n >= 1]
    return CompetitorAnalysis(
        summary=f"{leader} leads on average rating. Compared {len(businesses)} businesses on sentiment, ratings and "
                "recurring complaint themes. (Built-in engine.)",
        profiles=profiles,
        market_positioning="Position against the weaknesses most competitors share while protecting your top-rated strengths.",
        opportunities=opps,
    )


def report_narrative(report_type: str, stats: dict, clusters: list[dict]) -> ReportNarrative:
    insights = project_insights(clusters, stats)
    return ReportNarrative(executive_summary=insights.executive_summary, key_findings=insights.key_findings,
                           recommendations=[f"{o.title}: {o.recommendation}" for o in insights.opportunities[:5]])
