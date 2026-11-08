"use client"

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"
import { Download, Loader2, MessageSquareText, PenLine, Play, Search, Sparkles, Upload, X } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { CategoryBars, EmotionRadar, RatingBars, RatingTrendChart, SentimentDonut, SentimentTrendChart } from "@/components/charts/charts"
import { JobProgress, PageHeader, Pagination, Panel, ProjectSelect, StatCard, useJob } from "@/components/dashboard/primitives"
import { ClusterSheet, ManualReviewDialog, ReviewSheet, UploadDialog } from "@/components/dashboard/review-dialogs"
import { Pill, SentimentBadge, SeverityMeter, Stars, TrendBadge } from "@/components/shared/badges"
import { CardSkeleton, DemoBadge, EmptyState, ErrorState, TableSkeleton } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWorkspace } from "@/hooks/use-session"
import { api, download, errorMessage } from "@/lib/api"
import { CATEGORY_LABELS, categoryLabel } from "@/lib/site"
import { formatDate, formatNumber } from "@/lib/utils"
import type { Cluster, Job, Kpis, Page, Review, TimePoint } from "@/types/api"

interface Analytics {
  kpis: Kpis
  over_time: TimePoint[]
  rating_distribution: { rating: number; count: number }[]
  complaints: { category: string; count: number }[]
  praise: { category: string; count: number }[]
  emotions: { emotion: string; count: number }[]
  keywords: { keyword: string; count: number; negative_share: number }[]
  complaint_clusters: Cluster[]
  praise_clusters: Cluster[]
  feature_requests: Cluster[]
  trending: Cluster[]
  platforms: string[]
}

function ClusterList({ items, onOpen, empty }: { items: Cluster[]; onOpen: (id: string) => void; empty: string }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="divide-y">
      {items.map((c) => (
        <li key={c.id}>
          <button onClick={() => onOpen(c.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/40">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">{c.label}</p>
              <p className="text-xs text-muted-foreground">{categoryLabel(c.category)} · {c.review_count} reviews{c.avg_rating ? ` · ${c.avg_rating}★` : ""}</p>
            </div>
            <TrendBadge trend={c.trend} positive={c.kind !== "complaint"} />
            {c.kind === "complaint" && <SeverityMeter value={c.severity_score} />}
          </button>
        </li>
      ))}
    </ul>
  )
}

export function ReviewsPage() {
  const params = useSearchParams()
  const { workspace, can } = useWorkspace()
  const [projectId, setProjectId] = useState<string | null>(params.get("project"))
  const [tab, setTab] = useState(params.get("tab") || (params.get("cluster") || params.get("q") || params.get("category") ? "explorer" : "overview"))
  const [uploadOpen, setUploadOpen] = useState(params.get("import") === "1")
  const [manualOpen, setManualOpen] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [clusterSheet, setClusterSheet] = useState<string | null>(null)
  const [analysisJob, setAnalysisJob] = useState<string | null>(null)

  // Explorer filters
  const [q, setQ] = useState(params.get("q") || "")
  const [debouncedQ, setDebouncedQ] = useState(q)
  const [semantic, setSemantic] = useState(false)
  const [sentiment, setSentiment] = useState("all")
  const [category, setCategory] = useState(params.get("category") || "all")
  const [rating, setRating] = useState("all")
  const [platform, setPlatform] = useState("all")
  const [clusterId, setClusterId] = useState<string | null>(params.get("cluster"))
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sort, setSort] = useState("date_desc")
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [q])

  const filters = useMemo(() => ({
    project_id: projectId, sentiment: sentiment === "all" ? undefined : sentiment, category: category === "all" ? undefined : category,
    rating: rating === "all" ? undefined : rating, platform: platform === "all" ? undefined : platform, cluster_id: clusterId,
    date_from: dateFrom || undefined, date_to: dateTo || undefined, q: debouncedQ || undefined,
  }), [projectId, sentiment, category, rating, platform, clusterId, dateFrom, dateTo, debouncedQ])

  const analytics = useQuery({
    queryKey: ["review-analytics", workspace?.id, projectId, dateFrom, dateTo, platform],
    queryFn: () => api<Analytics>("/reviews/analytics", { query: { project_id: projectId, date_from: dateFrom || undefined, date_to: dateTo || undefined, platform: platform === "all" ? undefined : platform } }),
    enabled: !!workspace,
  })
  const reviews = useQuery({
    queryKey: ["reviews", workspace?.id, filters, sort, page],
    queryFn: () => api<Page<Review>>("/reviews", { query: { ...filters, sort, page, page_size: 25 } }),
    enabled: !!workspace && !(semantic && debouncedQ.length >= 3),
    placeholderData: keepPreviousData,
  })
  const semanticResults = useQuery({
    queryKey: ["reviews", "semantic", workspace?.id, projectId, debouncedQ],
    queryFn: () => api<Review[]>("/reviews/semantic-search", { query: { q: debouncedQ, project_id: projectId, limit: 25 } }),
    enabled: !!workspace && semantic && debouncedQ.length >= 3,
  })
  const job = useJob(analysisJob, { invalidate: [["reviews"], ["review-analytics"], ["dashboard"]] })

  const run = useMutation({
    mutationFn: () => api<Job>("/analysis/run", { method: "POST", body: { project_id: projectId, reanalyze: false } }),
    onSuccess: (j) => setAnalysisJob(j.id),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const exporting = useMutation({
    mutationFn: () => download("/reviews/export", `reviews-${new Date().toISOString().slice(0, 10)}.csv`, filters),
    onError: (e) => toast.error(errorMessage(e)),
  })

  const a = analytics.data
  const rows = semantic && debouncedQ.length >= 3 ? semanticResults.data : reviews.data?.items
  const pending = a ? a.kpis.total_reviews - a.kpis.analyzed_reviews : 0
  const activeFilters = [sentiment, category, rating, platform].some((v) => v !== "all") || clusterId || dateFrom || dateTo || debouncedQ

  const clearFilters = () => {
    setSentiment("all"); setCategory("all"); setRating("all"); setPlatform("all"); setClusterId(null); setDateFrom(""); setDateTo(""); setQ(""); setPage(1)
  }
  const openClusterReviews = (id: string) => {
    setClusterSheet(null); setClusterId(id); setTab("explorer"); setPage(1)
  }

  return (
    <>
      <PageHeader
        title="Review Intelligence"
        description="Sentiment, recurring themes and every review — with the AI's reasoning one click away."
        actions={
          <>
            <ProjectSelect value={projectId} onChange={(v) => { setProjectId(v); setPage(1) }} />
            {can("analyst") && (
              <>
                <Button variant="outline" onClick={() => setManualOpen(true)}><PenLine /> Add review</Button>
                {projectId && pending > 0 && (
                  <Button variant="outline" onClick={() => run.mutate()} disabled={run.isPending}><Play /> Analyze {formatNumber(pending)}</Button>
                )}
                <Button onClick={() => setUploadOpen(true)}><Upload /> Upload reviews</Button>
              </>
            )}
          </>
        }
      />
      {analysisJob && <JobProgress job={job.data} className="mb-4" />}

      {analytics.error ? (
        <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />
      ) : !a ? (
        <div className="grid gap-4 lg:grid-cols-3"><CardSkeleton rows={6} /><CardSkeleton rows={6} /><CardSkeleton rows={6} /></div>
      ) : a.kpis.total_reviews === 0 && !dateFrom && !dateTo && platform === "all" ? (
        <EmptyState icon={MessageSquareText} title="No reviews analyzed yet"
          description="Upload a CSV or Excel export of reviews you're authorized to use. We'll detect sentiment, complaints, praise, feature requests and recurring themes."
          action={can("analyst") && <Button onClick={() => setUploadOpen(true)}><Upload /> Upload your first review dataset</Button>} />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="themes">Themes</TabsTrigger>
            <TabsTrigger value="explorer">Review explorer</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Reviews" value={formatNumber(a.kpis.total_reviews)} hint={`${formatNumber(a.kpis.analyzed_reviews)} analyzed`} />
              <StatCard label="Average rating" value={a.kpis.avg_rating ? `${a.kpis.avg_rating}★` : "—"} tone="amber" />
              <StatCard label="Positive / Negative" value={`${a.kpis.positive_pct}% / ${a.kpis.negative_pct}%`} tone="green" />
              <StatCard label="Avg sentiment score" value={a.kpis.avg_sentiment?.toFixed(2) ?? "—"} hint="-1 (negative) to +1 (positive)" tone="violet" />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Sentiment over time" className="lg:col-span-2"><SentimentTrendChart data={a.over_time} /></Panel>
              <Panel title="Sentiment split"><SentimentDonut positive={a.kpis.positive} neutral={a.kpis.neutral} negative={a.kpis.negative} height={170} /></Panel>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Rating distribution"><RatingBars data={a.rating_distribution} /></Panel>
              <Panel title="Average rating trend"><RatingTrendChart data={a.over_time} height={200} /></Panel>
              <Panel title="Customer emotions"><EmotionRadar data={a.emotions} height={200} /></Panel>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Complaint breakdown" description="Click a bar to filter reviews">
                <CategoryBars data={a.complaints} color="var(--negative)" onSelect={(c) => { setCategory(c); setTab("explorer") }} />
              </Panel>
              <Panel title="Positive feedback breakdown"><CategoryBars data={a.praise} color="var(--positive)" /></Panel>
              <Panel title="Trending keywords">
                <div className="flex flex-wrap gap-1.5">
                  {a.keywords.map((k) => (
                    <button key={k.keyword} onClick={() => { setQ(k.keyword); setSemantic(false); setTab("explorer") }}>
                      <Pill color={k.negative_share >= 0.5 ? "red" : k.negative_share >= 0.25 ? "amber" : "indigo"}>{k.keyword} <span className="opacity-60">{k.count}</span></Pill>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          </TabsContent>

          <TabsContent value="themes" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Recurring complaints" description="Clustered by meaning; severity combines frequency, recency and ratings">
                <ClusterList items={a.complaint_clusters} onOpen={setClusterSheet} empty="No recurring complaints." />
              </Panel>
              <div className="space-y-4">
                <Panel title="Emerging trends"><ClusterList items={a.trending} onOpen={setClusterSheet} empty="Nothing rising right now." /></Panel>
                <Panel title="What customers love"><ClusterList items={a.praise_clusters} onOpen={setClusterSheet} empty="No praise themes yet." /></Panel>
                <Panel title="Feature requests"><ClusterList items={a.feature_requests} onOpen={setClusterSheet} empty="No feature requests detected." /></Panel>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="explorer">
            <div className="surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full md:w-80">
                  <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={semantic ? "Describe what you're looking for…" : "Search review text or reviewer…"} className="pl-8" aria-label="Search reviews" />
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={semantic} onCheckedChange={setSemantic} aria-label="Semantic search" /> <Sparkles className="size-3.5" /> Semantic
                </label>
                <Select value={sentiment} onValueChange={(v) => { setSentiment(v); setPage(1) }}>
                  <SelectTrigger className="w-[130px]" aria-label="Sentiment"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any sentiment</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1) }}>
                  <SelectTrigger className="w-[160px]" aria-label="Complaint category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any category</SelectItem>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={rating} onValueChange={(v) => { setRating(v); setPage(1) }}>
                  <SelectTrigger className="w-[110px]" aria-label="Rating"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any rating</SelectItem>
                    {[5, 4, 3, 2, 1].map((r) => <SelectItem key={r} value={String(r)}>{r}★</SelectItem>)}
                  </SelectContent>
                </Select>
                {a.platforms.length > 0 && (
                  <Select value={platform} onValueChange={(v) => { setPlatform(v); setPage(1) }}>
                    <SelectTrigger className="w-[150px]" aria-label="Source"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any source</SelectItem>
                      {a.platforms.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="w-[150px]" aria-label="From date" />
                <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="w-[150px]" aria-label="To date" />
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="w-[150px]" aria-label="Sort"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">Newest</SelectItem>
                    <SelectItem value="date_asc">Oldest</SelectItem>
                    <SelectItem value="rating_asc">Lowest rating</SelectItem>
                    <SelectItem value="rating_desc">Highest rating</SelectItem>
                  </SelectContent>
                </Select>
                <div className="ml-auto flex gap-2">
                  {activeFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X /> Clear</Button>}
                  <Button variant="outline" size="sm" onClick={() => exporting.mutate()} disabled={exporting.isPending}>
                    {exporting.isPending ? <Loader2 className="animate-spin" /> : <Download />} Export CSV
                  </Button>
                </div>
              </div>
              {clusterId && (
                <div className="mt-3"><Pill color="violet">Filtered to one theme <button onClick={() => setClusterId(null)} aria-label="Remove theme filter"><X className="size-3" /></button></Pill></div>
              )}
            </div>

            <div className="mt-3">
              {(reviews.isLoading || semanticResults.isLoading) && !rows ? (
                <TableSkeleton />
              ) : (reviews.error || semanticResults.error) ? (
                <ErrorState error={reviews.error || semanticResults.error} />
              ) : !rows?.length ? (
                <EmptyState title="No reviews match these filters" action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>} />
              ) : (
                <div className="surface overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">Rating</TableHead>
                        <TableHead>Review</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead>Sentiment</TableHead>
                        <TableHead className="hidden lg:table-cell">Category</TableHead>
                        <TableHead className="hidden lg:table-cell">Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id} className="cursor-pointer" onClick={() => setReviewId(r.id)}>
                          <TableCell><Stars rating={r.rating} /></TableCell>
                          <TableCell className="max-w-md">
                            <p className="line-clamp-2 text-sm whitespace-normal">{r.text}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              {r.reviewer_name}{r.is_demo && <DemoBadge />}
                              {r.similarity !== undefined && <span>· {Math.round(r.similarity * 100)}% match</span>}
                            </p>
                          </TableCell>
                          <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatDate(r.review_date)}</TableCell>
                          <TableCell><SentimentBadge sentiment={r.sentiment} /></TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">{r.categories.slice(0, 2).map((c) => <Pill key={c} color="red">{categoryLabel(c)}</Pill>)}</div>
                          </TableCell>
                          <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{r.platform || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {!semantic && reviews.data && <Pagination page={page} pageSize={reviews.data.page_size} total={reviews.data.total} onPage={setPage} />}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} projectId={projectId} key={`up-${projectId}`} />
      <ManualReviewDialog open={manualOpen} onOpenChange={setManualOpen} projectId={projectId} key={`man-${projectId}`} />
      <ReviewSheet reviewId={reviewId} onOpenChange={(o) => !o && setReviewId(null)} />
      <ClusterSheet clusterId={clusterSheet} onOpenChange={(o) => !o && setClusterSheet(null)} onShowReviews={openClusterReviews} />
    </>
  )
}
