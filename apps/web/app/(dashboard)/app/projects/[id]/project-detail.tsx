"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, ArrowRight, FileText, Globe, Pencil, Play, RefreshCw, Swords, Upload } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { JobProgress, PageHeader, Panel, StatCard, useJob } from "@/components/dashboard/primitives"
import { ProjectDialog } from "@/components/dashboard/project-form"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { CardSkeleton, DemoBadge, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { formatDate, formatNumber, timeAgo } from "@/lib/utils"
import type { Job, Project } from "@/types/api"

interface Activity { id: string; action: string; summary: string; actor: string | null; created_at: string }
interface Source { id: string; name: string; source_type: string; status: string; rows_total: number; rows_imported: number; rows_duplicate: number; rows_invalid: number; created_at: string; is_demo: boolean }

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { can } = useWorkspace()
  const [edit, setEdit] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)

  const project = useQuery({ queryKey: ["project", id], queryFn: () => api<Project>(`/projects/${id}`) })
  const activity = useQuery({ queryKey: ["activity", id], queryFn: () => api<Activity[]>("/workspaces/current/activity", { query: { entity_id: id, limit: 30 } }) })
  const sources = useQuery({ queryKey: ["sources", id], queryFn: () => api<Source[]>("/reviews/sources", { query: { project_id: id } }) })
  const job = useJob(jobId, { invalidate: [["project", id], ["dashboard"], ["activity", id]] })

  const run = useMutation({
    mutationFn: (reanalyze: boolean) => api<Job>("/analysis/run", { method: "POST", body: { project_id: id, reanalyze } }),
    onSuccess: (j) => { setJobId(j.id); toast.success("Analysis started") },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const archive = useMutation({
    mutationFn: () => api(`/projects/${id}/${project.data?.status === "archived" ? "unarchive" : "archive"}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  })

  if (project.error) return <ErrorState error={project.error} onRetry={() => project.refetch()} />
  if (!project.data) return <CardSkeleton rows={6} />
  const p = project.data
  const s = p.stats || { total: 0 }
  const pending = (s.total || 0) - (s.analyzed || 0)

  return (
    <>
      <PageHeader
        title={p.name}
        description={p.description || p.business_name || undefined}
        badge={<>{p.is_demo && <DemoBadge />}<StatusBadge status={p.status} /></>}
        actions={can("analyst") && (
          <>
            <Button variant="outline" onClick={() => setEdit(true)}><Pencil /> Edit</Button>
            <Button variant="outline" onClick={() => archive.mutate()}><Archive /> {p.status === "archived" ? "Restore" : "Archive"}</Button>
            <Button variant="outline" asChild><Link href={`/app/reviews?project=${p.id}&import=1`}><Upload /> Upload reviews</Link></Button>
            {pending > 0 ? (
              <Button onClick={() => run.mutate(false)} disabled={run.isPending}><Play /> Analyze {formatNumber(pending)} new</Button>
            ) : (
              <Button onClick={() => run.mutate(true)} disabled={run.isPending || !s.total}><RefreshCw /> Re-analyze</Button>
            )}
          </>
        )}
      />
      {jobId && <JobProgress job={job.data} className="mb-4" onCancel={() => api(`/analysis/jobs/${jobId}/cancel`, { method: "POST" }).then(() => job.refetch())} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Reviews" value={formatNumber(s.total)} hint={`${formatNumber(s.analyzed ?? 0)} analyzed`} />
        <StatCard label="Average rating" value={s.avg_rating ? `${s.avg_rating}★` : "—"} tone="amber" />
        <StatCard label="Positive" value={`${s.positive_pct ?? 0}%`} tone="green" />
        <StatCard label="Negative" value={`${s.negative_pct ?? 0}%`} tone="red" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Details">
          <dl className="space-y-3 text-sm">
            {[
              ["Business", p.business_name],
              ["Industry", p.industry],
              ["Location", [p.city, p.country].filter(Boolean).join(", ")],
              ["Data source", p.data_source.toUpperCase()],
              ["Created", formatDate(p.created_at)],
              ["Last analyzed", p.last_analyzed_at ? timeAgo(p.last_analyzed_at) : "Never"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v || "—"}</dd>
              </div>
            ))}
            {p.website && (
              <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                <Globe className="size-3.5" /> {p.website}
              </a>
            )}
          </dl>
          <div className="mt-5 border-t pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Businesses in this project</p>
            <div className="flex flex-wrap gap-1.5">
              {p.businesses?.map((b) => <Pill key={b.id} color={b.is_primary ? "signal" : "gray"}>{b.name}{b.is_primary ? " (yours)" : ""}</Pill>)}
            </div>
          </div>
        </Panel>
        <Panel title="Jump to" className="lg:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { href: `/app/reviews?project=${p.id}`, icon: FileText, label: "Review Intelligence", desc: "Sentiment, themes & every review" },
              { href: `/app/competitors?project=${p.id}`, icon: Swords, label: "Competitor analysis", desc: "Benchmark against competitors" },
              { href: `/app/opportunities?project=${p.id}`, icon: ArrowRight, label: "Opportunities", desc: "Prioritized actions from feedback" },
              { href: `/app/reports?new=1&project=${p.id}`, icon: FileText, label: "Generate a report", desc: "Branded PDF with evidence" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/30 hover:bg-accent/40">
                <l.icon className="size-4 text-primary" />
                <span>
                  <span className="block text-sm font-medium">{l.label}</span>
                  <span className="block text-xs text-muted-foreground">{l.desc}</span>
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Imports</p>
            {sources.data?.length ? (
              <ul className="divide-y text-sm">
                {sources.data.map((src) => (
                  <li key={src.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate">{src.name}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {src.rows_imported} imported · {src.rows_duplicate} duplicates · {src.rows_invalid} invalid
                    </span>
                    <StatusBadge status={src.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No imports yet.</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Activity history" className="mt-4">
        {activity.data?.length ? (
          <ol className="relative space-y-4 border-l pl-5">
            {activity.data.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-primary" />
                <p className="text-sm">{a.summary}</p>
                <p className="text-xs text-muted-foreground">{a.actor || "System"} · {timeAgo(a.created_at)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        )}
      </Panel>
      <ProjectDialog open={edit} onOpenChange={setEdit} project={p} />
    </>
  )
}
