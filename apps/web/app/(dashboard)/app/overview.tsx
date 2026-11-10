"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  Bot,
  FileText,
  Frown,
  Lightbulb,
  Loader2,
  Meh,
  MessageSquareText,
  Smile,
  Sparkles,
  Star,
  Upload,
} from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { CategoryBars, CompetitorBars, RatingBars, SentimentDonut, SentimentTrendChart } from "@/components/charts/charts"
import { PageHeader, Panel, ProjectSelect, StatCard } from "@/components/dashboard/primitives"
import { IntelligenceStatus, ReputationIntelligenceCore, SentimentVisualization, StatusDot, TechnicalLabel } from "@/components/signal"
import { ProductTour } from "@/components/dashboard/product-tour"
import { Pill, SeverityMeter, StatusBadge, TrendBadge } from "@/components/shared/badges"
import { CardSkeleton, DemoBadge, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSession, useWorkspace } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { categoryLabel } from "@/lib/site"
import { formatCompact, formatNumber, timeAgo, titleCase } from "@/lib/utils"
import type { Dashboard, Workspace } from "@/types/api"

const RANGES: Record<string, number | null> = { "30": 30, "90": 90, "180": 180, "365": 365, all: null }

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (100 * used) / limit) : 0
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {formatNumber(used)} / {limit === null ? "∞" : formatNumber(limit)}
        </span>
      </div>
      <Progress value={limit === null ? 4 : pct} className="mt-1.5 h-1.5" />
    </div>
  )
}

/** Live summary of this workspace's intelligence pipeline — every figure comes from the dashboard API. */
function IntelligenceHeader({ data }: { data: Dashboard }) {
  const k = data.kpis
  const themes = data.top_complaints.length + data.trending_issues.length
  const running = data.activity.some((a) => a.status === "pending" || a.status === "processing")
  const stage = k.analyzed_reviews < k.total_reviews ? 1 : data.opportunities.length ? 3 : themes ? 2 : 1
  return (
    <section className="surface relative mb-4 overflow-hidden dark:surface-lit" aria-label="Intelligence summary">
      <div aria-hidden className="bg-tech-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_60%_90%_at_12%_50%,#000,transparent)]" />
      <div className="relative grid items-center gap-6 p-5 md:grid-cols-[200px_1fr] lg:grid-cols-[220px_1fr_260px] lg:gap-8">
        <div className="mx-auto w-[180px] md:w-full">
          <ReputationIntelligenceCore detail="lite" pedestal={false} centerValue={formatCompact(k.analyzed_reviews)} centerLabel="Analyzed" title={`${k.analyzed_reviews} reviews analyzed`} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <TechnicalLabel tone={data.ai_provider.is_llm ? "signal" : "ember"}>
              <span className="inline-flex items-center gap-2">
                <StatusDot tone={data.ai_provider.is_llm ? "signal" : "ember"} pulse={running} />
                {running ? "Analysis running" : data.ai_provider.is_llm ? "Intelligence active" : "Built-in engine"}
              </span>
            </TechnicalLabel>
            <span className="text-xs text-muted-foreground">
              <Bot className="mr-1 inline size-3.5 align-[-2px]" />
              {data.ai_provider.label}
              {!data.ai_provider.is_llm && " — configure an AI provider for deeper, multilingual analysis."}
            </span>
          </div>
          <IntelligenceStatus
            className="mt-4"
            active={stage}
            stages={["Ingested", "Analyzed", "Themes", "Opportunities"]}
            counts={[formatNumber(k.total_reviews), formatNumber(k.analyzed_reviews), themes, data.opportunities.length]}
          />
        </div>
        <div className="text-[13px] md:col-span-2 lg:col-span-1">
          <p className="micro-label mb-2.5">Sentiment · in scope</p>
          <SentimentVisualization positive={k.positive_pct} neutral={k.neutral_pct} negative={k.negative_pct} />
        </div>
      </div>
    </section>
  )
}

export function OverviewPage() {
  const params = useSearchParams()
  const router = useRouter()
  const qc = useQueryClient()
  const { data: session } = useSession()
  const { workspace, switchWorkspace, workspaces } = useWorkspace()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [range, setRange] = useState("all")
  const days = RANGES[range]

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard", workspace?.id, projectId, range],
    queryFn: () => api<Dashboard>("/analysis/dashboard", { query: { project_id: projectId, date_from: days ? isoDaysAgo(days) : undefined } }),
    enabled: !!workspace,
  })

  const demo = useMutation({
    mutationFn: () => api<Workspace>("/workspaces/demo", { method: "POST", noWorkspace: true }),
    onSuccess: async (ws) => {
      await qc.invalidateQueries({ queryKey: ["session"] })
      await switchWorkspace(ws.id)
      toast.success("Demo workspace ready — synthetic sample data.")
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const firstName = (session?.user.full_name || "").split(" ")[0]
  const hasDemo = workspaces.some((w) => w.is_demo)

  const header = (
    <PageHeader
      title={`Welcome back${firstName ? `, ${firstName}` : ""}`}
      description="Your customer intelligence at a glance — every number is computed from your analyzed reviews."
      badge={workspace?.is_demo ? <DemoBadge /> : undefined}
      actions={
        <>
          <ProjectSelect value={projectId} onChange={setProjectId} className="w-[200px]" />
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[150px]" aria-label="Date range"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last 12 months</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild>
            <Link href="/app/reviews?import=1"><Upload /> Upload reviews</Link>
          </Button>
        </>
      }
    />
  )

  if (error) return <>{header}<ErrorState error={error} onRetry={() => refetch()} /></>
  if (isLoading || !data)
    return (
      <>
        {header}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} rows={1} />)}</div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3"><CardSkeleton rows={8} className="lg:col-span-2" /><CardSkeleton rows={8} /></div>
      </>
    )

  const k = data.kpis
  if (k.total_reviews === 0 && !projectId && range === "all") {
    return (
      <>
        {header}
        <ProductTour open={params.get("tour") === "1"} onClose={() => router.replace("/app")} />
        <EmptyState
          icon={MessageSquareText}
          title="No reviews analyzed yet"
          description="Upload a CSV or Excel export of your reviews and CustomerSignal AI will surface sentiment, recurring complaints, trends and opportunities. Or explore a fully analyzed demo workspace first."
          action={
            <>
              <Button asChild><Link href="/app/reviews?import=1"><Upload /> Upload your first review dataset</Link></Button>
              {hasDemo ? (
                <Button variant="outline" onClick={() => switchWorkspace(workspaces.find((w) => w.is_demo)!.id)}><Sparkles /> Open demo workspace</Button>
              ) : (
                <Button variant="outline" onClick={() => demo.mutate()} disabled={demo.isPending}>
                  {demo.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Explore demo workspace
                </Button>
              )}
            </>
          }
        />
      </>
    )
  }

  return (
    <>
      {header}
      <ProductTour open={params.get("tour") === "1"} onClose={() => router.replace("/app")} />
      <IntelligenceHeader data={data} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Reviews analyzed" value={formatCompact(k.analyzed_reviews)} hint={`${formatNumber(k.total_reviews)} total in scope`} icon={MessageSquareText} />
        <StatCard label="Positive" value={`${k.positive_pct}%`} hint={`${formatNumber(k.positive)} reviews`} icon={Smile} tone="green" />
        <StatCard label="Neutral" value={`${k.neutral_pct}%`} hint={`${formatNumber(k.neutral)} reviews`} icon={Meh} tone="gray" />
        <StatCard label="Negative" value={`${k.negative_pct}%`} hint={`${formatNumber(k.negative)} reviews`} icon={Frown} tone="red" />
        <StatCard label="Avg sentiment / rating" value={k.avg_sentiment === null ? "—" : k.avg_sentiment.toFixed(2)}
          hint={k.avg_rating === null ? "No ratings" : `${k.avg_rating.toFixed(2)}★ average rating`} icon={Star} tone="amber" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Review volume & sentiment over time" className="lg:col-span-2">
          <SentimentTrendChart data={data.sentiment_over_time} />
        </Panel>
        <Panel title="Sentiment distribution">
          <SentimentDonut positive={k.positive} neutral={k.neutral} negative={k.negative} />
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Rating distribution</p>
            <RatingBars data={data.rating_distribution} height={150} />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Top recurring complaints" className="lg:col-span-2"
          actions={<Button variant="ghost" size="sm" asChild><Link href="/app/reviews?tab=themes">All themes <ArrowRight /></Link></Button>}>
          {data.top_complaints.length ? (
            <ul className="divide-y">
              {data.top_complaints.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/reviews?project=${c.project_id}&cluster=${c.id}`} className="flex items-center gap-4 py-2.5 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{categoryLabel(c.category)} · {c.review_count} reviews{c.avg_rating ? ` · ${c.avg_rating}★ avg` : ""}</p>
                    </div>
                    <TrendBadge trend={c.trend} />
                    <SeverityMeter value={c.severity_score} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No recurring complaints detected.</p>
          )}
        </Panel>
        <Panel title="Complaint categories">
          <CategoryBars data={data.complaint_categories} color="var(--negative)"
            onSelect={(cat) => router.push(`/app/reviews?category=${cat}${projectId ? `&project=${projectId}` : ""}`)} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Trending customer issues" description="Rising or newly appeared in the last 30 days of data">
          {data.trending_issues.length ? (
            <ul className="space-y-3">
              {data.trending_issues.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.recent_count} recent vs {c.previous_count} prior</p>
                  </div>
                  <TrendBadge trend={c.trend} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No rising issues — nice.</p>
          )}
        </Panel>
        <Panel title="Competitor comparison" className="lg:col-span-2"
          actions={<Button variant="ghost" size="sm" asChild><Link href="/app/competitors">Compare <ArrowRight /></Link></Button>}>
          {data.competitor_comparison.length ? (
            <CompetitorBars data={data.competitor_comparison} height={220} />
          ) : (
            <EmptyState className="py-8" title="No competitors added" description="Add competitors and their reviews to benchmark sentiment."
              action={<Button size="sm" asChild><Link href="/app/competitors">Add your first competitor</Link></Button>} />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Newly discovered opportunities"
          actions={<Button variant="ghost" size="sm" asChild><Link href="/app/opportunities">View all <ArrowRight /></Link></Button>}>
          {data.opportunities.length ? (
            <ul className="space-y-3">
              {data.opportunities.map((o) => (
                <li key={o.id} className="flex gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-ice-50 text-ice-600 dark:bg-ice-500/15 dark:text-ice-300">
                    <Lightbulb className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <Link href={`/app/opportunities?id=${o.id}`} className="text-sm font-medium hover:underline">{o.title}</Link>
                    <p className="text-xs text-muted-foreground">Score {Math.round(o.score)} · {titleCase(o.impact)} impact</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Run an analysis to discover opportunities.</p>
          )}
        </Panel>
        <Panel title="Top recurring keywords">
          {data.top_keywords.length ? (
            <div className="flex flex-wrap gap-1.5">
              {data.top_keywords.map((kw) => (
                <Link key={kw.keyword} href={`/app/reviews?q=${encodeURIComponent(kw.keyword)}`}>
                  <Pill color={kw.negative_share >= 0.5 ? "red" : kw.negative_share >= 0.25 ? "amber" : "signal"} className="hover:opacity-80">
                    {kw.keyword} <span className="opacity-60">{kw.count}</span>
                  </Pill>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No keywords yet.</p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">Red = mostly in negative reviews.</p>
        </Panel>
        <div className="space-y-4">
          <Panel title="Monthly usage" actions={<Pill color="signal">{data.usage.plan.plan_name}</Pill>}>
            <div className="space-y-3">
              <UsageBar label="Reviews analyzed" {...data.usage.reviews_analyzed} />
              <UsageBar label="AI reports" {...data.usage.reports_generated} />
              <UsageBar label="Projects" {...data.usage.projects} />
            </div>
            <Button variant="outline" size="sm" className="mt-4 w-full" asChild><Link href="/app/billing">Manage plan</Link></Button>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Recent AI reports" actions={<Button variant="ghost" size="sm" asChild><Link href="/app/reports">All reports <ArrowRight /></Link></Button>}>
          {data.recent_reports.length ? (
            <ul className="divide-y">
              {data.recent_reports.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/reports/${r.id}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/40">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
                    <StatusBadge status={r.status} />
                    <span className="w-16 text-right text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="py-8" title="No reports generated" action={<Button size="sm" asChild><Link href="/app/reports?new=1">Generate your first AI report</Link></Button>} />
          )}
        </Panel>
        <Panel title="Analysis activity">
          {data.activity.length ? (
            <ul className="divide-y">
              {data.activity.map((j) => (
                <li key={j.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm">{titleCase(j.job_type)}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{j.stage}</span>
                  <StatusBadge status={j.status} />
                  <span className="w-16 text-right text-xs text-muted-foreground">{timeAgo(j.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No analysis jobs yet.</p>
          )}
        </Panel>
      </div>
    </>
  )
}
