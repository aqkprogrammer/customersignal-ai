"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { FileBarChart, FolderKanban, Globe2, Languages, Star } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { CardSkeleton, DemoBadge, EmptyState, ErrorState } from "@/components/shared/states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDebounced, usePaging } from "@/hooks/use-admin"
import { adminApi, formatDateTime } from "@/lib/admin-api"
import type { AdminProjectRow, AdminReportRow, Paged, ReviewAnalytics } from "@/lib/admin-types"
import { formatBytes, formatCompact, formatDate, formatNumber, titleCase } from "@/lib/utils"
import { BarsChart, DonutChart, TrendChart } from "../charts"
import { FilterBar, KpiGrid, KpiSkeleton, KpiTile, PageHeader, Pager, Panel, SearchBox, TableCard, TableRowsSkeleton } from "../ui"

// ------------------------------------------------------------------------------------------ review analytics
export function AdminReviewAnalytics() {
  const q = useQuery({ queryKey: ["admin", "review-analytics"], queryFn: () => adminApi<ReviewAnalytics>("/review-analytics") })
  return (
    <>
      <PageHeader eyebrow="Product" title="Review analytics" description="Platform-wide review ingestion, sentiment mix and sources." />
      {q.isPending ? (
        <div className="space-y-4"><KpiSkeleton /><CardSkeleton rows={8} /></div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <ReviewAnalyticsBody d={q.data} />
      )}
    </>
  )
}

function ReviewAnalyticsBody({ d }: { d: ReviewAnalytics }) {
  const analyzed = Object.values(d.sentiment).reduce((s, n) => s + n, 0)
  const pos = d.sentiment.positive || 0
  const neg = d.sentiment.negative || 0
  const last30 = d.ingested_30d.reduce((s, r) => s + r.reviews, 0)
  return (
    <div className="space-y-4">
      <KpiGrid>
        <KpiTile label="Total reviews" value={formatCompact(d.total_reviews)} icon={Star} hint={`${formatCompact(d.demo_reviews)} demo`} />
        <KpiTile label="Ingested (30d)" value={formatCompact(last30)} icon={Star} tone="sky" spark={d.ingested_30d.map((r) => r.reviews)} />
        <KpiTile label="Analyzed" value={formatCompact(analyzed)} tone="ice" hint={d.total_reviews ? `${Math.round((100 * analyzed) / d.total_reviews)}% coverage` : undefined} />
        <KpiTile label="Net sentiment" value={analyzed ? `${(((pos - neg) / analyzed) * 100).toFixed(0)}` : "—"} tone={pos >= neg ? "emerald" : "rose"} hint="% positive − % negative" />
      </KpiGrid>
      <Panel title="Reviews ingested" description="Per day, last 30 days">
        <TrendChart data={d.ingested_30d} xKey="date" series={[{ key: "reviews", label: "Reviews", color: "#5FA8F0" }]} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Sentiment mix">
          <DonutChart data={Object.entries(d.sentiment).map(([name, value]) => ({ name, value }))} format={formatNumber} />
        </Panel>
        <Panel title="Analysis provider" description="Which engine produced the sentiment">
          <DonutChart data={Object.entries(d.by_provider).map(([name, value]) => ({ name: name || "unknown", value }))} format={formatNumber} />
        </Panel>
        <Panel title={<span className="inline-flex items-center gap-1.5"><Globe2 className="size-3.5" /> Top platforms</span>}>
          <BarsChart data={d.by_platform} xKey="platform" horizontal periodLabels={false} labelFormat={titleCase} series={[{ key: "count", label: "Reviews" }]} height={Math.max(160, d.by_platform.length * 28)} />
        </Panel>
        <Panel title={<span className="inline-flex items-center gap-1.5"><Languages className="size-3.5" /> Top languages</span>}>
          <BarsChart data={d.by_language} xKey="language" horizontal periodLabels={false} series={[{ key: "count", label: "Reviews", color: "#5FA8F0" }]} height={Math.max(160, d.by_language.length * 28)} />
        </Panel>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------- projects
export function AdminProjects() {
  const [q, setQ] = useState("")
  const search = useDebounced(q)
  const { page, pageSize, setPage, setPageSize } = usePaging()
  const query = useQuery({
    queryKey: ["admin", "projects", { search, page, pageSize }],
    queryFn: () => adminApi<Paged<AdminProjectRow>>("/projects", { query: { q: search, page, page_size: pageSize } }),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <PageHeader eyebrow="Product" title="Projects" description="Every project across all workspaces." />
      <FilterBar>
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search project or workspace…" />
      </FilterBar>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <TableCard footer={query.data && <Pager page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} onPageSize={setPageSize} fetching={query.isFetching} />}>
          {query.isPending ? (
            <TableRowsSkeleton cols={6} />
          ) : query.data.items.length === 0 ? (
            <div className="p-4"><EmptyState icon={FolderKanban} title="No projects found" className="border-0" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Kind / source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                  <TableHead>Last analyzed</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-[240px]">
                      <div className="flex items-center gap-1.5 truncate font-medium text-foreground">{p.name}{p.is_demo && <DemoBadge />}</div>
                      <div className="truncate text-xs text-muted-foreground">{p.business_name || [p.industry, p.country].filter(Boolean).join(" · ") || "—"}</div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      <Link href={`/admin/workspaces/${p.workspace_id}`} className="text-xs text-signal-700 hover:underline">{p.workspace_name}</Link>
                    </TableCell>
                    <TableCell className="text-xs">{[titleCase(p.kind), titleCase(p.data_source)].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell>{p.archived_at ? <Pill>Archived</Pill> : <StatusBadge status={p.status} />}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.stats?.total ?? 0)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(p.last_analyzed_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}
    </>
  )
}

// ----------------------------------------------------------------------------------------------- reports
export function AdminReports() {
  const { page, pageSize, setPage, setPageSize } = usePaging()
  const query = useQuery({
    queryKey: ["admin", "reports", { page, pageSize }],
    queryFn: () => adminApi<Paged<AdminReportRow>>("/reports", { query: { page, page_size: pageSize } }),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <PageHeader eyebrow="Product" title="Reports" description="Generated AI reports across all workspaces." />
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <TableCard footer={query.data && <Pager page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} onPageSize={setPageSize} fetching={query.isFetching} />}>
          {query.isPending ? (
            <TableRowsSkeleton cols={6} />
          ) : query.data.items.length === 0 ? (
            <div className="p-4"><EmptyState icon={FileBarChart} title="No reports yet" className="border-0" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>PDF</TableHead>
                  <TableHead className="text-right">Downloads</TableHead>
                  <TableHead>Generated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[260px]">
                      <div className="flex items-center gap-1.5 truncate font-medium text-foreground">{r.title}{r.is_demo && <DemoBadge />}</div>
                      {r.error && <div className="truncate text-xs text-rose-700" title={r.error}>{r.error}</div>}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs">{r.workspace_name}</TableCell>
                    <TableCell className="text-xs">{titleCase(r.report_type)}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-xs">{r.provider || "—"}</TableCell>
                    <TableCell className="text-xs">{r.has_pdf ? formatBytes(r.file_size) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.download_count)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.generated_at || r.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}
    </>
  )
}
