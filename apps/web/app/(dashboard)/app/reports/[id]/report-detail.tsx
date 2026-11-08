"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, Download, Link2, Loader2, RefreshCw, XCircle } from "lucide-react"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { PageHeader, Panel } from "@/components/dashboard/primitives"
import { ReportView } from "@/components/dashboard/report-view"
import { StatusBadge } from "@/components/shared/badges"
import { CardSkeleton, DemoBadge, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useWorkspace } from "@/hooks/use-session"
import { api, download, errorMessage } from "@/lib/api"
import { formatBytes, formatDate, timeAgo } from "@/lib/utils"
import type { Job, Report } from "@/types/api"

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { can } = useWorkspace()
  const [expiry, setExpiry] = useState("30")
  const [lastLink, setLastLink] = useState<string | null>(null)

  const report = useQuery({
    queryKey: ["report", id],
    queryFn: () => api<Report>(`/reports/${id}`),
    refetchInterval: (q) => (q.state.data && ["pending", "generating"].includes(q.state.data.status) ? 2000 : false),
  })
  const job = useQuery({
    queryKey: ["job", report.data?.job_id],
    queryFn: () => api<Job>(`/analysis/jobs/${report.data?.job_id}`),
    enabled: !!report.data?.job_id && ["pending", "generating"].includes(report.data?.status || ""),
    refetchInterval: 1500,
  })
  const share = useMutation({
    mutationFn: () => api<{ url: string }>(`/reports/${id}/shares`, { method: "POST", body: { expires_in_days: Number(expiry) } }),
    onSuccess: async (r) => {
      setLastLink(r.url)
      await navigator.clipboard.writeText(r.url).catch(() => null)
      toast.success("Secure link created and copied")
      qc.invalidateQueries({ queryKey: ["report", id] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const regen = useMutation({
    mutationFn: () => api(`/reports/${id}/regenerate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report", id] }),
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (report.error) return <ErrorState error={report.error} onRetry={() => report.refetch()} />
  if (!report.data) return <CardSkeleton rows={10} />
  const r = report.data
  const busy = r.status === "pending" || r.status === "generating"

  return (
    <>
      <PageHeader title={r.title} description={`${r.date_from || r.date_to ? `${formatDate(r.date_from)} – ${formatDate(r.date_to)}` : "All time"} · created ${timeAgo(r.created_at)}`}
        badge={<>{r.is_demo && <DemoBadge />}<StatusBadge status={r.status} /></>}
        actions={
          <>
            {can("analyst") && <Button variant="outline" onClick={() => regen.mutate()} disabled={busy || regen.isPending}><RefreshCw /> Regenerate</Button>}
            <Button onClick={() => download(`/reports/${id}/download`, `${r.title}.pdf`).catch((e) => toast.error(errorMessage(e)))} disabled={r.status !== "ready"}>
              <Download /> Download PDF
            </Button>
          </>
        } />
      {busy ? (
        <div className="surface p-6">
          <div className="flex items-center gap-3"><Loader2 className="size-5 animate-spin text-primary" /><p className="font-medium">{job.data?.stage || "Generating report…"}</p></div>
          <Progress value={job.data?.progress ?? 5} className="mt-4 h-1.5" />
        </div>
      ) : r.status === "failed" ? (
        <div className="surface flex items-start gap-3 p-6"><XCircle className="size-5 text-destructive" /><div><p className="font-medium">Report generation failed</p><p className="text-sm text-muted-foreground">{r.error}</p></div></div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <ReportView content={r.content || {}} />
          <div className="space-y-4">
            <Panel title="File">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Size</dt><dd>{formatBytes(r.file_size)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Generated</dt><dd>{timeAgo(r.generated_at)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Downloads</dt><dd>{r.download_count}</dd></div>
              </dl>
            </Panel>
            {can("analyst") && (
              <Panel title="Secure share links" description="Anyone with the link can view this report until it expires or you revoke it.">
                <div className="flex gap-2">
                  <Select value={expiry} onValueChange={setExpiry}>
                    <SelectTrigger className="flex-1" aria-label="Link expiry"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Expires in 7 days</SelectItem>
                      <SelectItem value="30">Expires in 30 days</SelectItem>
                      <SelectItem value="90">Expires in 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => share.mutate()} disabled={share.isPending}><Link2 /> Create</Button>
                </div>
                {lastLink && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted p-2 text-xs">
                    <span className="min-w-0 flex-1 truncate">{lastLink}</span>
                    <Button variant="ghost" size="icon-xs" onClick={() => navigator.clipboard.writeText(lastLink)} aria-label="Copy link"><Copy /></Button>
                  </div>
                )}
                <ul className="mt-3 space-y-2">
                  {r.shares?.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                      <span>…{s.token_prefix} · {s.view_count} views · {s.revoked ? "revoked" : `expires ${formatDate(s.expires_at)}`}</span>
                      {!s.revoked && (
                        <Button variant="ghost" size="xs" onClick={async () => { await api(`/reports/${id}/shares/${s.id}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: ["report", id] }); toast.success("Link revoked") }}>Revoke</Button>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      )}
    </>
  )
}
