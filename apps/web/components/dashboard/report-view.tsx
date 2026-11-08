"use client"

import { CategoryBars, RatingBars, SentimentDonut } from "@/components/charts/charts"
import { Panel, StatCard } from "@/components/dashboard/primitives"
import { SeverityMeter, TrendBadge } from "@/components/shared/badges"
import { formatDate, formatNumber } from "@/lib/utils"

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Renders report.content (the same JSON the PDF is built from). Used in-app and on public share links. */
export function ReportView({ content }: { content: Record<string, any> }) {
  const k = content.kpis || {}
  const n = content.narrative || {}
  return (
    <div className="space-y-4">
      {content.contains_demo_data && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          This report contains DEMO data — synthetic sample reviews, not real customer feedback.
        </div>
      )}
      <Panel title="Executive summary" description={`${content.subtitle || ""} · ${content.period_label || ""}`}>
        <p className="text-sm leading-relaxed">{n.executive_summary}</p>
      </Panel>
      {k.total_reviews !== undefined && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Reviews" value={formatNumber(k.total_reviews)} />
          <StatCard label="Average rating" value={k.avg_rating ? `${k.avg_rating}★` : "—"} tone="amber" />
          <StatCard label="Positive" value={`${k.positive_pct}%`} tone="green" />
          <StatCard label="Negative" value={`${k.negative_pct}%`} tone="red" />
        </div>
      )}
      {k.total_reviews > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Sentiment"><SentimentDonut positive={k.positive} neutral={k.neutral} negative={k.negative} height={160} /></Panel>
          <Panel title="Ratings"><RatingBars data={content.rating_distribution || []} height={180} /></Panel>
          <Panel title="Complaint categories"><CategoryBars data={content.complaint_categories || []} color="var(--negative)" /></Panel>
        </div>
      )}
      {!!n.key_findings?.length && (
        <Panel title="Key findings"><ul className="list-inside list-disc space-y-1.5 text-sm">{n.key_findings.map((f: string) => <li key={f}>{f}</li>)}</ul></Panel>
      )}
      {!!content.themes?.length && (
        <Panel title="Recurring themes">
          <ul className="divide-y">
            {content.themes.map((t: any) => (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 text-sm">{t.label} <span className="text-xs text-muted-foreground">· {t.review_count} reviews</span></span>
                <TrendBadge trend={t.trend} /><SeverityMeter value={t.severity_score} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {!!content.evidence?.length && (
        <Panel title="Evidence from reviews">
          <div className="grid gap-4 md:grid-cols-2">
            {content.evidence.map((b: any) => (
              <div key={b.theme}>
                <p className="mb-2 text-sm font-medium">{b.theme}</p>
                <ul className="space-y-2">
                  {b.items.map((e: any) => (
                    <li key={e.review_id} className="border-l-2 border-primary/40 pl-3 text-sm">
                      <p className="italic">“{e.excerpt}”</p>
                      <p className="text-[11px] text-muted-foreground">{[e.rating ? `${e.rating}★` : null, e.platform, formatDate(e.date), `ref ${e.review_id.slice(0, 8)}`].filter(Boolean).join(" · ")}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {!!content.competitor_comparison?.length && (
        <Panel title="Competitor comparison">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-2">Business</th><th>Reviews</th><th>Avg ★</th><th>Positive</th><th>Negative</th></tr></thead>
              <tbody>{content.competitor_comparison.map((c: any) => (
                <tr key={c.business_id} className="border-t"><td className="py-2 font-medium">{c.name}{c.is_primary ? " (you)" : ""}</td><td>{c.review_count}</td><td>{c.avg_rating ?? "—"}</td><td>{c.positive_pct}%</td><td>{c.negative_pct}%</td></tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
      )}
      {content.gap_report && (
        <Panel title={`Product gap analysis · score ${content.gap_report.opportunity_score}/100`}>
          <p className="text-sm">{content.gap_report.summary}</p>
        </Panel>
      )}
      {content.outreach && (
        <Panel title="Outreach">
          <p className="text-sm font-medium">{content.outreach.cold_email_subject}</p>
          <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{content.outreach.cold_email}</p>
        </Panel>
      )}
      {!!content.opportunities?.length && (
        <Panel title="Opportunities">
          <ul className="space-y-3">{content.opportunities.map((o: any) => (
            <li key={o.title}><p className="text-sm font-medium">{o.title} <span className="text-xs text-muted-foreground">· score {Math.round(o.score)}</span></p><p className="text-xs text-muted-foreground">{o.recommendation || o.description}</p></li>
          ))}</ul>
        </Panel>
      )}
      {!!n.recommendations?.length && (
        <Panel title="Recommendations"><ol className="list-inside list-decimal space-y-1.5 text-sm">{n.recommendations.map((r: string) => <li key={r}>{r}</li>)}</ol></Panel>
      )}
      <p className="text-xs text-muted-foreground">Analysis engine: {content.provider_label}. Quotes are verbatim excerpts from the analyzed dataset.</p>
    </div>
  )
}
