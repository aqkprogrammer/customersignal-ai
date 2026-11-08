"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bot, Loader2, MoreHorizontal, Plus, Swords, Trash2, Upload } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { CompetitorBars, MultiLineChart } from "@/components/charts/charts"
import { ConfirmDialog, JobProgress, PageHeader, Panel, ProjectSelect, useJob, useProjects } from "@/components/dashboard/primitives"
import { UploadDialog } from "@/components/dashboard/review-dialogs"
import { Pill } from "@/components/shared/badges"
import { CardSkeleton, DemoBadge, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { categoryLabel } from "@/lib/site"
import { cn, timeAgo } from "@/lib/utils"
import type { CompetitorRow, Job } from "@/types/api"

interface CompetitorItem { id: string; business_id: string; project_id: string; name: string; website: string | null; notes: string | null; review_count: number; avg_rating: number | null; negative_pct: number; positive_pct: number; is_demo: boolean }
interface Comparison {
  businesses: CompetitorRow[]
  trends: Record<string, { period: string; avg_rating: number | null; negative_pct: number }[]>
  analysis: null | { provider: string; created_at: string; is_demo: boolean; payload: { summary: string; market_positioning: string; profiles: { business_id: string; name: string; strengths: string[]; weaknesses: string[] }[]; opportunities: { title: string; description: string }[] } }
}

export function CompetitorsPage() {
  const params = useSearchParams()
  const qc = useQueryClient()
  const { can } = useWorkspace()
  const projects = useProjects()
  const [chosenProject, setProjectId] = useState<string | null>(params.get("project"))
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: "", website: "", notes: "" })
  const [uploadFor, setUploadFor] = useState<string | null>(null)
  const [remove, setRemove] = useState<CompetitorItem | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)

  const fallbackProject = projects.data?.items.find((p) => p.kind === "standard") || projects.data?.items[0]
  const projectId = chosenProject ?? fallbackProject?.id ?? null

  const list = useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () => api<CompetitorItem[]>("/competitors", { query: { project_id: projectId } }),
    enabled: !!projectId,
  })
  const comparison = useQuery({
    queryKey: ["comparison", projectId],
    queryFn: () => api<Comparison>("/competitors/comparison", { query: { project_id: projectId } }),
    enabled: !!projectId,
  })
  const job = useJob(jobId, { invalidate: [["comparison", projectId]] })

  const add = useMutation({
    mutationFn: () => api("/competitors", { method: "POST", body: { project_id: projectId, name: form.name, website: form.website || null, notes: form.notes || null } }),
    onSuccess: () => {
      toast.success("Competitor added — upload its reviews to compare.")
      setAddOpen(false); setForm({ name: "", website: "", notes: "" })
      qc.invalidateQueries({ queryKey: ["competitors"] }); qc.invalidateQueries({ queryKey: ["comparison"] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const analyze = useMutation({
    mutationFn: () => api<Job>("/competitors/analyze", { method: "POST", query: { project_id: projectId } }),
    onSuccess: (j) => setJobId(j.id),
    onError: (e) => toast.error(errorMessage(e)),
  })

  const c = comparison.data
  const categories = c ? [...new Set(c.businesses.flatMap((b) => Object.keys(b.complaint_categories)))] : []
  const maxCat = c ? Math.max(1, ...c.businesses.flatMap((b) => Object.values(b.complaint_categories).map((n) => (b.review_count ? n / b.review_count : 0)))) : 1

  return (
    <>
      <PageHeader
        title="Competitor Analysis"
        description="Benchmark sentiment, ratings and complaint themes side by side — from each business's own reviews."
        actions={
          <>
            <ProjectSelect value={projectId} onChange={setProjectId} allowAll={false} />
            {can("analyst") && projectId && (
              <>
                <Button variant="outline" onClick={() => analyze.mutate()} disabled={analyze.isPending || (c?.businesses.length ?? 0) < 2}><Bot /> AI analysis</Button>
                <Button onClick={() => setAddOpen(true)}><Plus /> Add competitor</Button>
              </>
            )}
          </>
        }
      />
      {jobId && <JobProgress job={job.data} className="mb-4" />}

      {!projectId ? (
        <EmptyState icon={Swords} title="Create a project first" description="Competitors belong to a project so they're compared against the right business." />
      ) : comparison.error ? (
        <ErrorState error={comparison.error} onRetry={() => comparison.refetch()} />
      ) : !c || !list.data ? (
        <div className="grid gap-4 lg:grid-cols-2"><CardSkeleton rows={6} /><CardSkeleton rows={6} /></div>
      ) : list.data.length === 0 ? (
        <EmptyState icon={Swords} title="No competitors added" description="Add the businesses you compete with, then upload their (authorized) review exports."
          action={can("analyst") && <Button onClick={() => setAddOpen(true)}><Plus /> Add your first competitor</Button>} />
      ) : (
        <div className="space-y-4">
          <div className="surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                  <TableHead className="text-right">Avg ★</TableHead>
                  <TableHead className="text-right">Positive</TableHead>
                  <TableHead className="text-right">Negative</TableHead>
                  <TableHead className="hidden lg:table-cell">Top complaint</TableHead>
                  <TableHead className="hidden lg:table-cell">Top strength</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.businesses.map((b) => {
                  const comp = list.data.find((x) => x.business_id === b.business_id)
                  return (
                    <TableRow key={b.business_id} className={cn(b.is_primary && "bg-accent/40")}>
                      <TableCell className="font-medium">{b.name} {b.is_primary && <Pill color="indigo">You</Pill>} {comp?.is_demo && <DemoBadge />}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.review_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.avg_rating ?? "—"}</TableCell>
                      <TableCell className="text-right text-emerald-600 tabular-nums">{b.positive_pct}%</TableCell>
                      <TableCell className="text-right text-rose-600 tabular-nums">{b.negative_pct}%</TableCell>
                      <TableCell className="hidden max-w-48 truncate text-sm lg:table-cell">{b.top_complaints[0] || "—"}</TableCell>
                      <TableCell className="hidden max-w-48 truncate text-sm lg:table-cell">{b.top_praise[0] || "—"}</TableCell>
                      <TableCell>
                        {comp && can("analyst") && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${b.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setUploadFor(b.business_id)}><Upload /> Upload reviews</DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onSelect={() => setRemove(comp)}><Trash2 /> Remove</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Sentiment comparison"><CompetitorBars data={c.businesses} /></Panel>
            <Panel title="Negative sentiment trend" description="Track how each business's complaints move over time">
              <MultiLineChart yUnit="%" series={c.businesses.map((b) => ({ name: b.name.replace(" (demo)", ""), points: (c.trends[b.business_id] || []).map((p) => ({ period: p.period, value: p.negative_pct })) }))} />
            </Panel>
          </div>

          <Panel title="Complaint comparison" description="Share of each business's reviews mentioning a complaint category (darker = more)">
            {categories.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr><th className="py-2 pr-4 text-left font-medium text-muted-foreground">Category</th>
                      {c.businesses.map((b) => <th key={b.business_id} className="px-2 py-2 text-center font-medium">{b.name.replace(" (demo)", "")}</th>)}</tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat} className="border-t">
                        <td className="py-2 pr-4">{categoryLabel(cat)}</td>
                        {c.businesses.map((b) => {
                          const n = b.complaint_categories[cat] || 0
                          const share = b.review_count ? n / b.review_count : 0
                          return (
                            <td key={b.business_id} className="px-2 py-1.5 text-center">
                              <span className="inline-block min-w-14 rounded-md px-2 py-1 text-xs tabular-nums"
                                style={{ background: `color-mix(in oklch, var(--negative) ${Math.round((share / maxCat) * 55)}%, transparent)` }}>
                                {Math.round(share * 100)}%
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-muted-foreground">Analyze reviews to compare complaint categories.</p>}
          </Panel>

          <Panel title="Strengths, weaknesses & positioning"
            description={c.analysis ? `Generated ${timeAgo(c.analysis.created_at)} · ${c.analysis.provider === "heuristic" ? "built-in engine" : c.analysis.provider}` : "Run the AI analysis to generate a strategic summary"}>
            {c.analysis ? (
              <div className="space-y-4">
                <p className="text-sm">{c.analysis.payload.summary}</p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {c.analysis.payload.profiles.map((p) => (
                    <div key={p.business_id} className="rounded-xl border p-4">
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="mt-2 text-xs font-medium text-emerald-600">Strengths</p>
                      <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">{p.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
                      <p className="mt-2 text-xs font-medium text-rose-600">Weaknesses</p>
                      <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">{p.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-accent/50 p-4 text-sm"><span className="font-medium">Market positioning: </span>{c.analysis.payload.market_positioning}</div>
                {c.analysis.payload.opportunities.length > 0 && (
                  <ul className="space-y-2">{c.analysis.payload.opportunities.map((o) => <li key={o.title} className="text-sm"><span className="font-medium">{o.title}</span> — <span className="text-muted-foreground">{o.description}</span></li>)}</ul>
                )}
              </div>
            ) : (
              <Button variant="outline" onClick={() => analyze.mutate()} disabled={analyze.isPending || c.businesses.length < 2}>
                {analyze.isPending ? <Loader2 className="animate-spin" /> : <Bot />} Run competitor analysis
              </Button>
            )}
          </Panel>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add competitor</DialogTitle>
            <DialogDescription>After adding, upload the competitor&apos;s reviews (CSV/Excel) that you&apos;re authorized to use.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="c-name">Business name</Label><Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-web">Website</Label><Input id="c-web" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-notes">Notes</Label><Textarea id="c-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => add.mutate()} disabled={form.name.trim().length < 2 || add.isPending}>{add.isPending && <Loader2 className="animate-spin" />} Add competitor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UploadDialog open={!!uploadFor} onOpenChange={(o) => !o && setUploadFor(null)} projectId={projectId} businessId={uploadFor} key={uploadFor || "none"}
        onComplete={() => { qc.invalidateQueries({ queryKey: ["comparison"] }); qc.invalidateQueries({ queryKey: ["competitors"] }) }} />
      <ConfirmDialog open={!!remove} onOpenChange={(o) => !o && setRemove(null)} title={`Remove ${remove?.name}?`} destructive confirmLabel="Remove"
        description="The competitor and its reviews will no longer appear in comparisons."
        onConfirm={async () => {
          await api(`/competitors/${remove!.id}`, { method: "DELETE" })
          qc.invalidateQueries({ queryKey: ["competitors"] }); qc.invalidateQueries({ queryKey: ["comparison"] })
          toast.success("Competitor removed")
        }} />
    </>
  )
}
