"""Professional PDF rendering for AI reports (ReportLab): branded cover, KPI tiles, charts, findings, evidence."""

from __future__ import annotations

import io
from datetime import UTC, datetime
from typing import Any
from xml.sax.saxutils import escape

from reportlab.graphics.charts.barcharts import HorizontalBarChart, VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

NAVY = colors.HexColor("#0B1033")
INDIGO = colors.HexColor("#4F46E5")
VIOLET = colors.HexColor("#7C3AED")
MUTED = colors.HexColor("#6B7280")
BORDER = colors.HexColor("#E5E7EB")
SOFT = colors.HexColor("#F5F6FB")
POS, NEU, NEG = colors.HexColor("#10B981"), colors.HexColor("#94A3B8"), colors.HexColor("#EF4444")

_base = getSampleStyleSheet()
S = {
    "h1": ParagraphStyle("h1", parent=_base["Heading1"], fontName="Helvetica-Bold", fontSize=18, textColor=NAVY,
                         spaceAfter=8, spaceBefore=6),
    "h2": ParagraphStyle("h2", parent=_base["Heading2"], fontName="Helvetica-Bold", fontSize=13, textColor=NAVY,
                         spaceAfter=6, spaceBefore=12),
    "body": ParagraphStyle("body", parent=_base["BodyText"], fontName="Helvetica", fontSize=9.5, leading=14,
                           textColor=colors.HexColor("#1F2937"), alignment=TA_LEFT),
    "small": ParagraphStyle("small", parent=_base["BodyText"], fontName="Helvetica", fontSize=8, leading=11,
                            textColor=MUTED),
    "quote": ParagraphStyle("quote", parent=_base["BodyText"], fontName="Helvetica-Oblique", fontSize=9, leading=13,
                            textColor=colors.HexColor("#374151"), leftIndent=8),
    "bullet": ParagraphStyle("bullet", parent=_base["BodyText"], fontName="Helvetica", fontSize=9.5, leading=14,
                             leftIndent=12, bulletIndent=2),
}


def p(text: Any, style: str = "body") -> Paragraph:
    return Paragraph(escape(str(text if text is not None else "")).replace("\n", "<br/>"), S[style])


def _color(hex_value: str | None) -> colors.Color:
    try:
        return colors.HexColor(hex_value) if hex_value else INDIGO
    except Exception:  # noqa: BLE001
        return INDIGO


def _kpi_table(items: list[tuple[str, str]], accent: colors.Color) -> Table:
    hex_color = "#" + accent.hexval()[2:]
    cells = [[Paragraph(f'<font size="16" color="{hex_color}"><b>{escape(v)}</b></font>'
                        f'<br/><font size="7.5" color="#6B7280">{escape(k.upper())}</font>', S["body"]) for k, v in items]]
    t = Table(cells, colWidths=[(170 * mm) / len(items)] * len(items))
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.5, BORDER), ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
                           ("BACKGROUND", (0, 0), (-1, -1), SOFT), ("TOPPADDING", (0, 0), (-1, -1), 8),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 8), ("LEFTPADDING", (0, 0), (-1, -1), 8)]))
    return t


def _sentiment_pie(kpis: dict) -> Drawing:
    d = Drawing(240, 150)
    data = [kpis.get("positive", 0), kpis.get("neutral", 0), kpis.get("negative", 0)]
    if sum(data) == 0:
        d.add(String(10, 70, "No analyzed reviews in range", fontSize=9, fillColor=MUTED))
        return d
    pie = Pie()
    pie.x, pie.y, pie.width, pie.height = 10, 15, 120, 120
    pie.data = data
    pie.labels = None
    pie.slices.strokeColor = colors.white
    for i, c in enumerate((POS, NEU, NEG)):
        pie.slices[i].fillColor = c
    d.add(pie)
    for i, (label, c, v) in enumerate(zip(("Positive", "Neutral", "Negative"), (POS, NEU, NEG), data, strict=True)):
        y = 110 - i * 22
        from reportlab.graphics.shapes import Rect

        d.add(Rect(145, y, 8, 8, fillColor=c, strokeColor=None))
        d.add(String(158, y + 1, f"{label}  {v}", fontSize=8.5, fillColor=NAVY))
    return d


def _rating_bars(dist: list[dict], accent: colors.Color) -> Drawing:
    d = Drawing(250, 150)
    chart = VerticalBarChart()
    chart.x, chart.y, chart.width, chart.height = 30, 25, 200, 110
    chart.data = [[r["count"] for r in dist]] or [[0]]
    chart.categoryAxis.categoryNames = [f"{r['rating']}★" for r in dist]
    chart.bars[0].fillColor = accent
    chart.bars[0].strokeColor = None
    chart.valueAxis.valueMin = 0
    chart.valueAxis.labels.fontSize = 7
    chart.categoryAxis.labels.fontSize = 8
    d.add(chart)
    return d


def _category_bars(cats: list[dict], accent: colors.Color) -> Drawing:
    cats = cats[:8]
    d = Drawing(480, 30 + 18 * max(1, len(cats)))
    if not cats:
        d.add(String(0, 10, "No complaints detected", fontSize=9, fillColor=MUTED))
        return d
    chart = HorizontalBarChart()
    chart.x, chart.y, chart.width, chart.height = 130, 10, 330, 18 * len(cats)
    chart.data = [[c["count"] for c in reversed(cats)]]
    chart.categoryAxis.categoryNames = [c["category"].replace("_", " ").capitalize() for c in reversed(cats)]
    chart.bars[0].fillColor = accent
    chart.bars[0].strokeColor = None
    chart.valueAxis.valueMin = 0
    chart.categoryAxis.labels.fontSize = 8
    chart.valueAxis.labels.fontSize = 7
    d.add(chart)
    return d


def _table(header: list[str], rows: list[list[Any]], widths: list[float]) -> Table:
    data = [[p(h, "small") for h in header]] + [[p(c) for c in r] for r in rows]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), SOFT), ("LINEBELOW", (0, 0), (-1, -1), 0.4, BORDER),
                           ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 5),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    return t


def render_report_pdf(content: dict) -> bytes:
    """content: the report.content JSON produced by report_service."""
    buf = io.BytesIO()
    accent = _color(content.get("branding", {}).get("primary_color"))
    workspace = content.get("workspace_name", "")
    is_demo = content.get("contains_demo_data", False)
    title = content.get("title", "Report")

    def on_page(canvas, doc):  # noqa: ANN001
        canvas.saveState()
        if doc.page == 1:
            canvas.setFillColor(NAVY)
            canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
            canvas.setFillColor(accent)
            canvas.rect(0, A4[1] - 12 * mm, A4[0], 12 * mm, fill=1, stroke=0)
            canvas.setFillColor(colors.white)
            canvas.setFont("Helvetica-Bold", 11)
            canvas.drawString(20 * mm, A4[1] - 30 * mm, (workspace or "CustomerSignal AI").upper())
            canvas.setFont("Helvetica-Bold", 26)
            y = A4[1] / 2 + 20 * mm
            words, line = title.split(), ""
            for w in words:
                if canvas.stringWidth(line + " " + w, "Helvetica-Bold", 26) > A4[0] - 40 * mm:
                    canvas.drawString(20 * mm, y, line.strip())
                    y -= 11 * mm
                    line = w
                else:
                    line += " " + w
            canvas.drawString(20 * mm, y, line.strip())
            canvas.setFont("Helvetica", 11)
            canvas.setFillColor(colors.HexColor("#C7D2FE"))
            canvas.drawString(20 * mm, y - 12 * mm, content.get("subtitle", ""))
            canvas.drawString(20 * mm, y - 19 * mm, content.get("period_label", ""))
            canvas.setFont("Helvetica", 9)
            canvas.drawString(20 * mm, 22 * mm, f"Generated {datetime.now(UTC).strftime('%d %B %Y')} · CustomerSignal AI")
            canvas.drawString(20 * mm, 16 * mm, f"Analysis engine: {content.get('provider_label', '')}")
            if is_demo:
                canvas.setFillColor(colors.HexColor("#FBBF24"))
                canvas.setFont("Helvetica-Bold", 10)
                canvas.drawString(20 * mm, 34 * mm, "DEMO DATA — contains synthetic sample reviews, not real customer feedback")
        else:
            canvas.setStrokeColor(BORDER)
            canvas.line(20 * mm, 15 * mm, A4[0] - 20 * mm, 15 * mm)
            canvas.setFont("Helvetica", 7.5)
            canvas.setFillColor(MUTED)
            canvas.drawString(20 * mm, 10 * mm, f"{workspace} · {title}"[:110])
            canvas.drawRightString(A4[0] - 20 * mm, 10 * mm, f"Page {doc.page}")
            if is_demo:
                canvas.setFillColor(colors.HexColor("#B45309"))
                canvas.drawCentredString(A4[0] / 2, 10 * mm, "DEMO DATA")
        canvas.restoreState()

    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm,
                            bottomMargin=22 * mm, title=title, author="CustomerSignal AI")
    story: list = [PageBreak()]
    narrative = content.get("narrative", {})
    kpis = content.get("kpis", {})

    story += [p("Executive summary", "h1"), p(narrative.get("executive_summary", "")), Spacer(1, 8)]
    if kpis:
        story.append(_kpi_table([
            ("Reviews", f"{kpis.get('total_reviews', 0):,}"),
            ("Avg rating", f"{kpis['avg_rating']:.2f}" if kpis.get("avg_rating") is not None else "—"),
            ("Positive", f"{kpis.get('positive_pct', 0)}%"),
            ("Negative", f"{kpis.get('negative_pct', 0)}%"),
        ], accent))
        story.append(Spacer(1, 10))
        charts = Table([[_sentiment_pie(kpis), _rating_bars(content.get("rating_distribution", []), accent)]],
                       colWidths=[85 * mm, 85 * mm])
        story += [p("Sentiment & ratings", "h2"), charts]

    if narrative.get("key_findings"):
        story.append(p("Key findings", "h2"))
        story += [Paragraph(escape(f), S["bullet"], bulletText="•") for f in narrative["key_findings"]]

    if content.get("complaint_categories"):
        story += [p("Complaint categories", "h2"), _category_bars(content["complaint_categories"], accent)]

    themes = content.get("themes", [])
    if themes:
        story.append(p("Recurring themes", "h2"))
        story.append(_table(["Theme", "Reviews", "Avg ★", "Severity", "Trend"],
                            [[t["label"], t["review_count"], t.get("avg_rating") or "—", round(t["severity_score"]),
                              t["trend"]] for t in themes[:12]], [80, 20, 18, 22, 25]))

    evidence = content.get("evidence", [])
    if evidence:
        story.append(p("Evidence from reviews", "h2"))
        story.append(p("Representative excerpts from the analyzed dataset, with source references.", "small"))
        for block in evidence[:8]:
            items = [p(block["theme"], "body")]
            for e in block["items"][:3]:
                ref = " · ".join(str(x) for x in [e.get("platform"), e.get("date"),
                                                   f"{e['rating']:g}★" if e.get("rating") is not None else None,
                                                   "DEMO" if e.get("is_demo") else None] if x)
                items += [p(f"“{e['excerpt']}”", "quote"), p(f"Source: {ref or 'uploaded dataset'} · ref {e['review_id'][:8]}", "small")]
            story.append(KeepTogether(items + [Spacer(1, 6)]))

    comparison = content.get("competitor_comparison", [])
    if comparison:
        story.append(p("Competitor comparison", "h2"))
        story.append(_table(["Business", "Reviews", "Avg ★", "Positive", "Negative", "Top complaint"],
                            [[("★ " if c["is_primary"] else "") + c["name"], c["review_count"], c.get("avg_rating") or "—",
                              f"{c['positive_pct']}%", f"{c['negative_pct']}%", (c.get("top_complaints") or ["—"])[0]]
                             for c in comparison], [42, 18, 16, 20, 20, 54]))

    gap = content.get("gap_report")
    if gap:
        story.append(p("Product gap analysis", "h2"))
        story.append(p(f"Opportunity score: {gap.get('opportunity_score', 0)}/100"))
        for key, label in (("likes", "What customers like"), ("dislikes", "What customers dislike"),
                           ("wishes", "What customers wish existed"), ("unmet_expectations", "Unmet expectations"),
                           ("competitor_advantages", "Competitor advantages")):
            pts = gap.get(key) or []
            if pts:
                story.append(p(label, "body"))
                story += [Paragraph(escape(x["point"]), S["bullet"], bulletText="•") for x in pts[:5]]
        if gap.get("roadmap"):
            story.append(p("Suggested roadmap", "h2"))
            for ph in gap["roadmap"]:
                story.append(p(f"{ph['phase']}: " + "; ".join(ph["items"])))

    outreach = content.get("outreach")
    if outreach:
        story.append(p("Outreach", "h2"))
        story += [p("Cold email — " + (outreach.get("cold_email_subject") or ""), "body"),
                  p(outreach.get("cold_email", ""), "quote"), Spacer(1, 6),
                  p("LinkedIn message", "body"), p(outreach.get("linkedin_message", ""), "quote")]

    opps = content.get("opportunities", [])
    if opps:
        story.append(p("Opportunities", "h2"))
        story.append(_table(["Opportunity", "Impact", "Effort", "Score"],
                            [[f"{o['title']}\n{o.get('recommendation') or o.get('description', '')}", o["impact"],
                              o["effort"], round(o["score"])] for o in opps[:8]], [110, 20, 20, 20]))

    if narrative.get("recommendations"):
        story.append(p("Recommendations", "h2"))
        story += [Paragraph(escape(r), S["bullet"], bulletText="→") for r in narrative["recommendations"]]

    story += [Spacer(1, 14), p(
        "Methodology: insights are derived from the review dataset in this workspace. Quotes are verbatim excerpts. "
        "Severity combines frequency, recency and ratings. " + (
            "This report contains DEMO data generated for illustration." if is_demo else ""), "small")]
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buf.getvalue()
