"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronRight, KeyRound, Plug, RefreshCw, RotateCcw, Workflow, XCircle } from "lucide-react"
import { Fragment, useState } from "react"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAdminMutation, useCan, usePaging } from "@/hooks/use-admin"
import { adminApi, formatDateTime } from "@/lib/admin-api"
import type { AdminJob, IntegrationLog, IntegrationsResponse, JobsResponse } from "@/lib/admin-types"
import { cn, formatNumber, timeAgo, titleCase } from "@/lib/utils"
import { BoolDot, ConfirmDialog, FilterBar, FilterSelect, JsonBlock, KpiGrid, KpiTile, PageHeader, Pager, Panel, TableCard, TableRowsSkeleton } from "../ui"

// ------------------------------------------------------------------------------------------- integrations
const CREDENTIAL_LABELS: Record<string, string> = {
  google_oauth: "Google OAuth",
  stripe: "Stripe",
  resend: "Resend (email)",
  anthropic: "Anthropic",
  openai: "OpenAI",
  s3: "S3 storage",
}

export function AdminIntegrations() {
  const can = useCan()
  const [pendingProvider, setPendingProvider] = useState<string | null>(null)
  const q = useQuery({ queryKey: ["admin", "integrations"], queryFn: () => adminApi<IntegrationsResponse>("/integrations") })
  const toggle = useAdminMutation<{ provider: string; enabled: boolean }>({
    fn: (body) => adminApi("/integrations/toggle", { method: "PUT", body }),
    success: (_d, v) => `${titleCase(v.provider)} ${v.enabled ? "enabled" : "disabled"}`,
    invalidate: [["admin", "integrations"]],
  })
  const manage = can("settings.manage")

  return (
    <>
      <PageHeader eyebrow="Product" title="Integrations" description="Provider availability, platform credentials and sync health." />
      {q.isPending ? (
        <div className="grid gap-4 lg:grid-cols-3"><CardSkeleton rows={8} className="lg:col-span-2" /><CardSkeleton rows={6} /></div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Providers" description={manage ? "Disabling hides the integration from every workspace." : "Read-only for your role"} className="xl:col-span-2" bodyClassName="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Integration</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Availability</TableHead>
                    <TableHead className="text-right">Connected</TableHead>
                    <TableHead className="text-right">Errored</TableHead>
                    <TableHead className="text-right">Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.providers.map((p) => (
                    <TableRow key={p.provider}>
                      <TableCell>
                        <div className="font-medium text-foreground">{p.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{p.provider}</div>
                      </TableCell>
                      <TableCell className="text-xs">{p.category}</TableCell>
                      <TableCell><Pill color={p.availability === "builtin" || p.availability === "available" ? "green" : "gray"}>{titleCase(p.availability)}</Pill></TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.connected)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", p.errored > 0 && "text-rose-700")}>{formatNumber(p.errored)}</TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={p.enabled}
                          disabled={!manage || (toggle.isPending && pendingProvider === p.provider)}
                          aria-label={`${p.enabled ? "Disable" : "Enable"} ${p.name}`}
                          onCheckedChange={(enabled) => {
                            setPendingProvider(p.provider)
                            toggle.mutate({ provider: p.provider, enabled })
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
            <Panel title={<span className="inline-flex items-center gap-1.5"><KeyRound className="size-3.5" /> Platform credentials</span>} description="Set via environment variables. Secrets are never shown.">
              <ul className="space-y-2.5">
                {Object.entries(q.data.credentials).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between text-sm">
                    <span>{CREDENTIAL_LABELS[k] || titleCase(k)}</span>
                    <BoolDot value={v} on="Configured" off="Not configured" />
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Recent errors" bodyClassName="p-0"><LogList rows={q.data.errors} empty="No sync errors recorded." /></Panel>
            <Panel title="Sync activity" bodyClassName="p-0"><LogList rows={q.data.activity} empty="No sync activity yet." /></Panel>
          </div>
        </div>
      )}
    </>
  )
}

function LogList({ rows, empty }: { rows: IntegrationLog[]; empty: string }) {
  if (!rows.length) return <div className="p-4"><EmptyState icon={Plug} title={empty} className="border-0 py-8" /></div>
  return (
    <ul className="max-h-[420px] divide-y overflow-y-auto">
      {rows.map((r, i) => (
        <li key={i} className="px-4 py-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <Pill color="signal">{r.provider}</Pill>
              <span className="truncate text-xs">{r.workspace}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <StatusBadge status={r.status} />
            <span className="font-mono text-muted-foreground">{r.action}</span>
          </div>
          {r.message && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.message}</p>}
        </li>
      ))}
    </ul>
  )
}

// ----------------------------------------------------------------------------------------------------- jobs
const JOB_TYPES = ["analyze_reviews", "import_reviews", "generate_report", "competitor_analysis", "gap_finder", "opportunity_finder"]
const JOB_STATUSES = ["pending", "processing", "completed", "failed", "cancelled"]

export function AdminJobs() {
  const can = useCan()
  const [status, setStatus] = useState("")
  const [type, setType] = useState("")
  const [dead, setDead] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [cancelJob, setCancelJob] = useState<AdminJob | null>(null)
  const { page, pageSize, setPage, setPageSize } = usePaging()
  const q = useQuery({
    queryKey: ["admin", "jobs", { status, type, dead, page, pageSize }],
    queryFn: () => adminApi<JobsResponse>("/jobs", { query: { status, job_type: type, dead_letter: dead || undefined, page, page_size: pageSize } }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.items.some((j) => j.status === "pending" || j.status === "processing") ? 5000 : false),
  })
  const act = useAdminMutation<{ id: string; action: "retry" | "cancel" }>({
    fn: ({ id, action }) => adminApi(`/jobs/${id}/${action}`, { method: "POST" }),
    success: (_d, v) => (v.action === "retry" ? "Job re-queued" : "Job cancelled"),
    invalidate: [["admin", "jobs"]],
  })
  const manage = can("jobs.manage")
  const counts = q.data?.counts_7d || {}
  const live = q.data?.items.some((j) => j.status === "pending" || j.status === "processing")

  return (
    <>
      <PageHeader
        eyebrow="Product"
        title="Background jobs"
        description="Analysis, import and report workers. Auto-refreshes every 5s while jobs are running."
        actions={
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={q.isFetching ? "animate-spin" : undefined} /> Refresh
          </Button>
        }
      />
      <KpiGrid className="mb-4 xl:grid-cols-5">
        {JOB_STATUSES.map((s) => (
          <KpiTile
            key={s}
            label={`${titleCase(s)} (7d)`}
            value={formatNumber(counts[s] || 0)}
            tone={s === "failed" ? "rose" : s === "completed" ? "emerald" : s === "processing" ? "signal" : s === "pending" ? "amber" : "sky"}
          />
        ))}
      </KpiGrid>
      <FilterBar>
        <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={JOB_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))} />
        <FilterSelect label="Type" value={type} onChange={(v) => { setType(v); setPage(1) }} options={JOB_TYPES.map((s) => ({ value: s, label: titleCase(s) }))} />
        <div className="flex items-center gap-2 pl-1">
          <Switch id="dead" size="sm" checked={dead} onCheckedChange={(v) => { setDead(v); setPage(1) }} />
          <Label htmlFor="dead" className="text-xs font-normal text-muted-foreground">Dead-letter only</Label>
        </div>
        {live && <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-signal-700"><span className="size-1.5 animate-pulse rounded-full bg-signal-400" /> Live</span>}
      </FilterBar>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <TableCard footer={q.data && <Pager page={page} pageSize={pageSize} total={q.data.total} onPage={setPage} onPageSize={setPageSize} fetching={q.isFetching} />}>
          {q.isPending ? (
            <TableRowsSkeleton cols={6} />
          ) : q.data.items.length === 0 ? (
            <div className="p-4"><EmptyState icon={Workflow} title="No jobs match" className="border-0" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Job</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40">Progress</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Created</TableHead>
                  {manage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.items.map((j) => {
                  const expanded = open === j.id
                  return (
                    <Fragment key={j.id}>
                      <TableRow className="hover:bg-surface-hover">
                        <TableCell>
                          <Button variant="ghost" size="icon-xs" onClick={() => setOpen(expanded ? null : j.id)} aria-label={expanded ? "Collapse" : "Expand"} aria-expanded={expanded}>
                            {expanded ? <ChevronDown /> : <ChevronRight />}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-foreground">{titleCase(j.job_type)}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{j.id.slice(0, 8)}</div>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs">{j.workspace_name || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <StatusBadge status={j.status} />
                            {j.dead_lettered && <Pill color="red">Dead-letter</Pill>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Progress value={j.progress ?? 0} className="h-1.5" />
                          <div className="mt-1 truncate text-[10px] text-muted-foreground" title={j.stage || undefined}>
                            {j.stage || "—"}
                            {j.total_items ? ` · ${formatNumber(j.processed_items ?? 0)}/${formatNumber(j.total_items)}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{j.attempts}/{j.max_attempts}</TableCell>
                        <TableCell className="text-xs text-muted-foreground" title={formatDateTime(j.created_at)}>{timeAgo(j.created_at)}</TableCell>
                        {manage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {(j.status === "failed" || j.status === "cancelled") && (
                                <Button variant="outline" size="xs" disabled={act.isPending} onClick={() => act.mutate({ id: j.id, action: "retry" })}>
                                  <RotateCcw /> Retry
                                </Button>
                              )}
                              {(j.status === "pending" || j.status === "processing") && (
                                <Button variant="destructive" size="xs" onClick={() => setCancelJob(j)}>
                                  <XCircle /> Cancel
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                      {expanded && (
                        <TableRow className="bg-muted hover:bg-muted">
                          <TableCell colSpan={manage ? 8 : 7} className="whitespace-normal">
                            <div className="grid gap-3 py-2 lg:grid-cols-3">
                              <div className="space-y-1 text-xs">
                                <div><span className="text-muted-foreground">Started:</span> {formatDateTime(j.started_at)}</div>
                                <div><span className="text-muted-foreground">Completed:</span> {formatDateTime(j.completed_at)}</div>
                                <div><span className="text-muted-foreground">Project:</span> <span className="font-mono">{j.project_id || "—"}</span></div>
                                {j.error && <div className="mt-2 rounded-md border border-rose-500/20 bg-rose-500/10 p-2 font-mono text-[11px] whitespace-pre-wrap text-rose-700">{j.error}</div>}
                              </div>
                              <div><div className="mb-1 text-[11px] text-muted-foreground">Params</div><JsonBlock value={j.params} className="max-h-48" /></div>
                              <div><div className="mb-1 text-[11px] text-muted-foreground">Result</div><JsonBlock value={j.result_summary} className="max-h-48" /></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}
      <ConfirmDialog
        open={!!cancelJob}
        onOpenChange={(o) => !o && setCancelJob(null)}
        title="Cancel job?"
        description={cancelJob ? `${titleCase(cancelJob.job_type)} for ${cancelJob.workspace_name || "unknown workspace"} will be stopped. It can be retried later.` : undefined}
        confirmLabel="Cancel job"
        destructive
        pending={act.isPending}
        onConfirm={() => (cancelJob ? act.mutateAsync({ id: cancelJob.id, action: "cancel" }) : Promise.resolve())}
      />
    </>
  )
}
