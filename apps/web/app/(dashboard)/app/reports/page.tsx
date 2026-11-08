"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, FileText, Loader2, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog, PageHeader, Pagination, ProjectSelect } from "@/components/dashboard/primitives"
import { StatusBadge } from "@/components/shared/badges"
import { DemoBadge, EmptyState, ErrorState, TableSkeleton } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useWorkspace } from "@/hooks/use-session"
import { api, ApiError, download, errorMessage } from "@/lib/api"
import { REPORT_TYPES } from "@/lib/site"
import { cn, formatBytes, timeAgo } from "@/lib/utils"
import type { Page, Report } from "@/types/api"

export default function Page() {
  return (
    <Suspense>
      <ReportsPage />
    </Suspense>
  )
}

function ReportsPage() {
  const params = useSearchParams()
  const router = useRouter()
  const qc = useQueryClient()
  const { can } = useWorkspace()
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState("all")
  const [open, setOpen] = useState(params.get("new") === "1")
  const [form, setForm] = useState({ report_type: "customer_sentiment", project_id: params.get("project") as string | null, title: "", date_from: "", date_to: "" })
  const [del, setDel] = useState<Report | null>(null)


  const reports = useQuery({
    queryKey: ["reports", page, typeFilter],
    queryFn: () => api<Page<Report>>("/reports", { query: { page, page_size: 20, report_type: typeFilter === "all" ? undefined : typeFilter } }),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.items.some((r) => r.status === "pending" || r.status === "generating") ? 2500 : false),
  })
  const create = useMutation({
    mutationFn: () => api<{ report: Report }>("/reports", {
      method: "POST",
      body: { report_type: form.report_type, project_id: form.project_id, title: form.title || null, date_from: form.date_from || null, date_to: form.date_to || null },
    }),
    onSuccess: (r) => { setOpen(false); qc.invalidateQueries({ queryKey: ["reports"] }); router.push(`/app/reports/${r.report.id}`) },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) toast.error(e.message, { action: { label: "Upgrade", onClick: () => router.push("/app/billing") } })
      else toast.error(errorMessage(e))
    },
  })
  const selectedType = REPORT_TYPES.find((t) => t.value === form.report_type)

  return (
    <>
      <PageHeader title="AI Reports" description="Branded PDF reports with charts, key findings, evidence references and recommendations."
        actions={
          <>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[200px]" aria-label="Report type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All report types</SelectItem>
                {REPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {can("analyst") && <Button onClick={() => setOpen(true)}><Plus /> Generate report</Button>}
          </>
        } />
      {reports.error ? <ErrorState error={reports.error} onRetry={() => reports.refetch()} /> : !reports.data ? <TableSkeleton /> : !reports.data.items.length ? (
        <EmptyState icon={FileText} title="No reports generated" description="Turn your analysis into a polished PDF for clients, leadership or your team."
          action={can("analyst") && <Button onClick={() => setOpen(true)}><Plus /> Generate your first AI report</Button>} />
      ) : (
        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Size</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.data.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/app/reports/${r.id}`} className="font-medium hover:underline">{r.title}</Link> {r.is_demo && <DemoBadge />}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{REPORT_TYPES.find((t) => t.value === r.report_type)?.label}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{formatBytes(r.file_size)}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{timeAgo(r.created_at)}</TableCell>
                  <TableCell className="text-right">
                    {r.status === "ready" && (
                      <Button variant="ghost" size="icon-sm" aria-label="Download PDF"
                        onClick={() => download(`/reports/${r.id}/download`, `${r.title}.pdf`).catch((e) => toast.error(errorMessage(e)))}><Download /></Button>
                    )}
                    {can("analyst") && <Button variant="ghost" size="icon-sm" aria-label="Delete report" onClick={() => setDel(r)}><Trash2 /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {reports.data && <Pagination page={page} pageSize={reports.data.page_size} total={reports.data.total} onPage={setPage} />}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate an AI report</DialogTitle>
            <DialogDescription>Reports are built from your analyzed reviews and include evidence references for every finding.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-3">
            {REPORT_TYPES.map((t) => (
              <button key={t.value} onClick={() => setForm({ ...form, report_type: t.value })}
                className={cn("rounded-xl border p-3 text-left transition-colors hover:border-primary/40", form.report_type === t.value && "border-primary bg-accent/50 ring-1 ring-primary")}>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Scope {selectedType?.needsProject && <span className="text-destructive">*</span>}</Label>
              <ProjectSelect value={form.project_id} onChange={(v) => setForm({ ...form, project_id: v })} allowAll={!selectedType?.needsProject} className="w-full" />
            </div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="r-title">Title <span className="text-muted-foreground">(optional)</span></Label><Input id="r-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="r-from">From</Label><Input id="r-from" type="date" value={form.date_from} onChange={(e) => setForm({ ...form, date_from: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="r-to">To</Label><Input id="r-to" type="date" value={form.date_to} onChange={(e) => setForm({ ...form, date_to: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || (selectedType?.needsProject && !form.project_id)}>
              {create.isPending && <Loader2 className="animate-spin" />} Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this report?" description="Share links for it will stop working." destructive confirmLabel="Delete"
        onConfirm={async () => { await api(`/reports/${del!.id}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: ["reports"] }); toast.success("Report deleted") }} />
    </>
  )
}
