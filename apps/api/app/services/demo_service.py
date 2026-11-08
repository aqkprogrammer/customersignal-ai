"""DEMO workspace generator. All reviews here are SYNTHETIC sample data and are flagged is_demo=True everywhere.

Analysis of demo data runs on the built-in deterministic engine so it is free, instant and reproducible.
"""

from __future__ import annotations

import random
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.engine import AIEngine
from app.ai.registry import HeuristicProvider
from app.models import (
    Business,
    Competitor,
    Lead,
    MonitoringRule,
    Project,
    Report,
    ReviewSource,
    User,
    Workspace,
)
from app.services import intelligence, monitoring_service, report_service
from app.services.analysis_service import run_full_analysis
from app.services.ingestion import NormalizedReview, insert_reviews
from app.services.workspace_service import create_workspace

DEMO_NAME = "Demo Workspace (sample data)"

# (rating band) -> sentence pools. {neg, pos, wish, neutral}
CLINIC = {
    "neg": {
        "waiting_time": ["I waited over 45 minutes past my appointment time.",
                         "Even with a booking, the wait in reception was more than an hour.",
                         "Waiting time is getting worse every visit.",
                         "We sat in the waiting area forever before anyone called us."],
        "pricing": ["The final bill was much higher than the price quoted on the phone.",
                    "Prices aren't listed anywhere and the consultation fee was a surprise.",
                    "Hidden charges for products they used during the facial."],
        "appointment_management": ["Booking an appointment was a nightmare, I had to call three times.",
                                   "They cancelled my appointment the same morning without explanation.",
                                   "No online booking, and the phone line is always busy."],
        "communication": ["Nobody called me back about my follow-up results.",
                          "WhatsApp messages go unanswered for days.",
                          "I was never informed that my doctor had changed."],
        "customer_service": ["The receptionist was dismissive when I raised a complaint.",
                             "Customer service did not help with my refund request."],
    },
    "pos": ["Dr. Layla was professional and explained every step.", "The therapist was gentle and friendly.",
            "My skin results were excellent after two sessions.", "Very clean and modern clinic.",
            "Staff were polite and made me feel comfortable.", "Great results, I would recommend them."],
    "wish": ["I wish they had online booking with instant confirmation.",
             "It would be great if they offered evening appointments.",
             "Please add a way to see prices before booking."],
    "neutral": ["Visited for a laser session.", "Second visit this year.", "Went in for a consultation."],
}
CLINIC_COMP_1 = {
    "neg": {"pricing": ["Quite expensive compared to other clinics."],
            "staff_behavior": ["One of the staff was a bit unprofessional."]},
    "pos": ["Booking online was easy and quick.", "They were on time for my appointment.",
            "Clear price list and no surprises.", "Friendly receptionist and clean rooms."],
    "wish": ["Would love more parking options."], "neutral": ["Came for a skin consultation."],
}
CLINIC_COMP_2 = {
    "neg": {"waiting_time": ["Waited 30 minutes even though I was early."],
            "product_quality": ["Results were disappointing after the peel."],
            "cleanliness": ["The treatment room was not very clean."]},
    "pos": ["Affordable packages.", "Nice relaxing atmosphere."], "wish": [], "neutral": ["Tried their hydrafacial."],
}
RESTAURANT = {
    "neg": {"waiting_time": ["Our food took 50 minutes to arrive at the table.", "Service was slow on a quiet night."],
            "delivery": ["The delivery order arrived cold and late.", "Delivery was missing the bread and dips.",
                         "Courier took over an hour to arrive."],
            "product_quality": ["The hummus tasted stale.", "The chicken was dry and overcooked."],
            "pricing": ["Overpriced for the portion size.", "Too expensive for what you get."],
            "staff_behavior": ["The waiter was rude when we asked for the bill."]},
    "pos": ["The lamb biryani was absolutely delicious.", "Staff were warm and attentive.",
            "Beautiful terrace with a great view.", "Fresh ingredients and generous portions.",
            "Excellent mixed grill, highly recommend."],
    "wish": ["Would be nice to have more vegan options.", "I wish they offered a kids menu."],
    "neutral": ["Ordered for a family dinner.", "Came here for lunch with colleagues."],
}
REST_COMP_1 = {
    "neg": {"delivery": ["Delivery packaging leaked all over the bag."],
            "customer_service": ["Nobody answered the phone when the order was wrong."],
            "waiting_time": ["We waited forever for a table despite a reservation."]},
    "pos": ["Great grilled fish.", "Friendly staff."], "wish": [], "neutral": ["Dinner on a Friday."],
}
REST_COMP_2 = {
    "neg": {"pricing": ["A little pricey."]},
    "pos": ["Quick service and hot food.", "Delivery always arrives on time.", "Lovely pasta and fresh salads.",
            "Clean and cozy place."],
    "wish": ["Wish they opened earlier for breakfast."], "neutral": ["Ordered delivery."],
}
PRODUCT = {
    "neg": {"reliability": ["The battery dies after three shots.", "Stopped working after two months."],
            "product_quality": ["Build feels flimsy for the price.", "The water tank cracked after a week."],
            "usability": ["Cleaning the portafilter is difficult.", "The instructions were confusing."],
            "pricing": ["Not great value for money at this price."]},
    "pos": ["Love how compact it is.", "Pressure is great for the size.", "Makes decent espresso with good crema.",
            "Easy to use on camping trips."],
    "wish": ["Wish it came with a carrying case.", "It would be nice to have USB-C charging instead of the proprietary cable.",
             "I wish the water tank was bigger.", "Would love a double-shot basket."],
    "neutral": ["Bought this for travel.", "Using it at the office."],
}
PRODUCT_COMP = {
    "neg": {"product_quality": ["The coffee is a bit weak."], "pricing": ["Expensive."]},
    "pos": ["Battery lasts all week, which is great.", "Comes with a nice travel case.", "USB-C charging is so convenient.",
            "Feels solid and well built."],
    "wish": ["Wish the pressure was higher."], "neutral": ["Use it daily."],
}
NAMES = ["Aisha K.", "Omar H.", "Fatima R.", "Rahul S.", "Sarah M.", "Mohammed A.", "Elena P.", "James W.", "Noura S.",
         "Priya N.", "Khalid B.", "Hannah L.", "Yousef T.", "Maria G.", "Ali R.", "Chen W.", "Layla F.", "Daniel O."]
ARABIC = [("انتظرت أكثر من ساعة رغم وجود موعد. الخدمة بطيئة جدا.", "I waited more than an hour despite having an appointment. "
           "The service is very slow.", 2),
          ("الطاقم ممتاز والنتائج رائعة.", "The staff are excellent and the results are wonderful.", 5)]


def _review(rng: random.Random, pools: dict, rating: int, recent_bias: dict[str, float], days_back: int) -> NormalizedReview:
    parts: list[str] = []
    if rating <= 2:
        cats = list(pools["neg"].keys())
        weights = [recent_bias.get(c, 1.0) for c in cats]
        chosen = {rng.choices(cats, weights=weights)[0]}
        if rng.random() < 0.35 and len(cats) > 1:
            chosen.add(rng.choice(cats))
        for c in chosen:
            parts.append(rng.choice(pools["neg"][c]))
        if rng.random() < 0.25 and pools["wish"]:
            parts.append(rng.choice(pools["wish"]))
    elif rating == 3:
        if pools["pos"]:
            parts.append(rng.choice(pools["pos"]))
        cats = list(pools["neg"].keys())
        sentence = rng.choice(pools["neg"][rng.choices(cats, weights=[recent_bias.get(c, 1.0) for c in cats])[0]])
        parts.append("But " + sentence[0].lower() + sentence[1:])
        if rng.random() < 0.5 and pools["wish"]:
            parts.append(rng.choice(pools["wish"]))
    else:
        parts += rng.sample(pools["pos"], k=min(len(pools["pos"]), rng.choice([1, 2])))
        if rng.random() < 0.15 and pools["wish"]:
            parts.append(rng.choice(pools["wish"]))
    if rng.random() < 0.2 and pools["neutral"]:
        parts.insert(0, rng.choice(pools["neutral"]))
    return NormalizedReview(
        text=" ".join(dict.fromkeys(parts)), rating=float(rating), review_date=date.today() - timedelta(days=days_back),
        reviewer_name=rng.choice(NAMES), platform=rng.choice(["Google (demo)", "Google (demo)", "Website (demo)"]),
        verified=rng.random() < 0.7,
    )


def _dataset(rng: random.Random, pools: dict, n: int, ratings: list[int], weights: list[float],
             rising: str | None = None, product: str | None = None) -> list[NormalizedReview]:
    out = []
    for _ in range(n):
        days = int(rng.triangular(0, 180, 20))
        bias = {rising: 4.0} if rising and days <= 30 else {}
        r = _review(rng, pools, rng.choices(ratings, weights=weights)[0], bias, days)
        if product:
            r.product_name = product
            r.platform = "Amazon (demo)"
        out.append(r)
    return out


async def _project(db: AsyncSession, ws: Workspace, user: User, **fields) -> Project:
    p = Project(workspace_id=ws.id, created_by_id=user.id, is_demo=True, data_source="csv", **fields)
    db.add(p)
    await db.flush()
    return p


async def _load(db: AsyncSession, project: Project, business_name: str, rows: list[NormalizedReview], *,
                primary: bool, entity_type: str = "business") -> Business:
    biz = Business(workspace_id=project.workspace_id, project_id=project.id, name=business_name, is_primary=primary,
                   entity_type=entity_type, city=project.city, country=project.country, industry=project.industry,
                   is_demo=True)
    db.add(biz)
    await db.flush()
    if not primary:
        db.add(Competitor(workspace_id=project.workspace_id, project_id=project.id, business_id=biz.id, is_demo=True,
                          notes="DEMO competitor with synthetic reviews"))
    src = ReviewSource(workspace_id=project.workspace_id, project_id=project.id, source_type="demo",
                       name=f"{business_name} — DEMO sample reviews.csv", status="completed", rows_total=len(rows),
                       rows_imported=len(rows), is_demo=True)
    db.add(src)
    await db.flush()
    await insert_reviews(db, project, rows, source_id=src.id, business_id=biz.id, is_demo=True)
    return biz


async def create_demo_workspace(db: AsyncSession, user: User) -> Workspace:
    existing = await db.scalar(select(Workspace).where(Workspace.owner_id == user.id, Workspace.is_demo.is_(True),
                                                       Workspace.deleted_at.is_(None)))
    if existing:
        return existing
    rng = random.Random(42)
    ws = await create_workspace(db, user, DEMO_NAME, is_demo=True, industry="Multiple (demo)", country="United Arab Emirates",
                                city="Dubai")

    clinic = await _project(db, ws, user, name="Marina Glow Aesthetics", business_name="Marina Glow Aesthetics (demo)",
                            industry="Beauty & wellness", country="United Arab Emirates", city="Dubai",
                            description="DEMO: synthetic reviews for a fictional aesthetics clinic.")
    clinic_rows = _dataset(rng, CLINIC, 52, [1, 2, 3, 4, 5], [12, 14, 10, 24, 40], rising="waiting_time")
    for text, _translation, rating in ARABIC:
        r = NormalizedReview(text=text, rating=float(rating), review_date=date.today() - timedelta(days=rng.randint(3, 60)),
                             reviewer_name=rng.choice(NAMES), platform="Google (demo)")
        clinic_rows.append(r)
    await _load(db, clinic, "Marina Glow Aesthetics (demo)", clinic_rows, primary=True)
    await _load(db, clinic, "Jumeirah Skin Studio (demo)", _dataset(rng, CLINIC_COMP_1, 16, [2, 3, 4, 5], [1, 2, 5, 8]), primary=False)
    await _load(db, clinic, "Palm Beauty Lounge (demo)", _dataset(rng, CLINIC_COMP_2, 16, [1, 2, 3, 4, 5], [3, 4, 3, 3, 3]), primary=False)

    rest = await _project(db, ws, user, name="Saffron & Sage Kitchen", business_name="Saffron & Sage Kitchen (demo)",
                          industry="Restaurants", country="United Arab Emirates", city="Abu Dhabi",
                          description="DEMO: synthetic reviews for a fictional restaurant.")
    await _load(db, rest, "Saffron & Sage Kitchen (demo)", _dataset(rng, RESTAURANT, 46, [1, 2, 3, 4, 5], [8, 12, 10, 26, 44],
                                                                    rising="delivery"), primary=True)
    await _load(db, rest, "Corniche Grill House (demo)", _dataset(rng, REST_COMP_1, 16, [1, 2, 3, 4, 5], [3, 3, 3, 3, 4]), primary=False)
    await _load(db, rest, "Olive Leaf Bistro (demo)", _dataset(rng, REST_COMP_2, 16, [2, 3, 4, 5], [1, 2, 5, 8]), primary=False)

    prod = await _project(db, ws, user, name="Gap Finder: AeroBrew Portable Espresso (demo)", kind="gap_finder",
                          business_name="AeroBrew Portable Espresso Maker (demo)", industry="Ecommerce",
                          description="DEMO: synthetic product reviews for a fictional espresso maker.")
    await _load(db, prod, "AeroBrew Portable Espresso Maker (demo)",
                _dataset(rng, PRODUCT, 44, [1, 2, 3, 4, 5], [4, 6, 18, 8, 8], product="AeroBrew Portable Espresso Maker"),
                primary=True, entity_type="product")
    await _load(db, prod, "BrewGo Mini (demo)", _dataset(rng, PRODUCT_COMP, 20, [2, 3, 4, 5], [2, 6, 6, 6], product="BrewGo Mini"),
                primary=False, entity_type="product")
    await db.flush()

    engine = AIEngine(db, HeuristicProvider(), workspace_id=ws.id, user_id=user.id)

    async def _noop(*_a, **_k) -> bool:
        return True

    for p in (clinic, rest, prod):
        await run_full_analysis(db, p, engine, _noop, None, commit=False)

    lead = Lead(workspace_id=ws.id, project_id=clinic.id, business_name="Marina Glow Aesthetics (demo)", city="Dubai",
                country="United Arab Emirates", industry="Beauty & wellness", contact_name="Clinic Manager (demo)",
                competitor_names=["Jumeirah Skin Studio (demo)", "Palm Beauty Lounge (demo)"], created_by_id=user.id,
                is_demo=True)
    db.add(lead)
    await db.flush()
    await intelligence.generate_outreach(db, lead, engine, None)
    await intelligence.run_gap_finder(db, prod, engine, None)
    await intelligence.run_competitor_analysis(db, rest, engine, None)

    db.add(MonitoringRule(workspace_id=ws.id, project_id=clinic.id, name="Negative sentiment above 30%",
                          rule_type="negative_sentiment_above", threshold=30, window_days=30, channels=["in_app"],
                          created_by_id=user.id))
    db.add(MonitoringRule(workspace_id=ws.id, project_id=clinic.id, name="New recurring complaint",
                          rule_type="new_recurring_complaint", threshold=3, window_days=30, channels=["in_app"],
                          created_by_id=user.id))
    await db.flush()
    await monitoring_service.evaluate_workspace(db, workspace_id=ws.id)

    for rtype, proj in (("customer_sentiment", clinic), ("competitor_intelligence", rest), ("gap_finder", prod)):
        rep = Report(workspace_id=ws.id, project_id=proj.id, created_by_id=user.id, report_type=rtype,
                     title=report_service.default_title(rtype, proj.business_name) + " (DEMO)", status="pending",
                     is_demo=True)
        db.add(rep)
        await db.flush()
        await report_service.generate_report(db, rep, engine)
    await db.flush()
    return ws
