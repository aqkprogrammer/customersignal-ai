"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bot, FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { JobProgress, ProjectSelect, useJob } from "@/components/dashboard/primitives"
import { Pill, SentimentBadge, SeverityMeter, Stars, TrendBadge } from "@/components/shared/badges"
import { DemoBadge } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { api, errorMessage } from "@/lib/api"
import { categoryLabel } from "@/lib/site"
import { cn, formatBytes, formatDate, titleCase } from "@/lib/utils"
import type { BusinessRef, Cluster, Evidence, Job, Review } from "@/types/api"

function useBusinesses(projectId: string | null) {
  return useQuery({
    queryKey: ["businesses", projectId],
    queryFn: () => api<BusinessRef[]>(`/projects/${projectId}/businesses`),
    enabled: !!projectId,
  })
}

export function UploadDialog({ open, onOpenChange, projectId: initialProject, businessId: fixedBusiness, onComplete }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  projectId: string | null
  businessId?: string | null
  onComplete?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [projectId, setProjectId] = useState<string | null>(initialProject)
  const [file, setFile] = useState<File | null>(null)
  const [platform, setPlatform] = useState("")
  const [businessId, setBusinessId] = useState<string>(fixedBusiness || "auto")
  const [autoAnalyze, setAutoAnalyze] = useState(true)
  const [drag, setDrag] = useState(false)
  const [importJob, setImportJob] = useState<string | null>(null)
  const [analysisJob, setAnalysisJob] = useState<string | null>(null)
  const businesses = useBusinesses(projectId)

  const invalidate = [["reviews"], ["review-analytics"], ["dashboard"], ["projects"], ["sources"]]
  const imp = useJob(importJob, {
    invalidate,
    onDone: (j) => {
      const next = j.result_summary?.analysis_job_id as string | undefined
      if (next) setAnalysisJob(next)
      if (j.status === "completed") toast.success(`Imported ${j.result_summary.imported} reviews (${j.result_summary.duplicates} duplicates, ${j.result_summary.invalid} invalid)`)
    },
  })
  const ana = useJob(analysisJob, { invalidate, onDone: (j) => { if (j.status === "completed") { toast.success("Analysis complete"); onComplete?.() } } })

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.set("project_id", projectId!)
      fd.set("file", file!)
      if (platform.trim()) fd.set("platform", platform.trim())
      if (businessId !== "auto") fd.set("business_id", businessId)
      fd.set("auto_analyze", String(autoAnalyze))
      return api<{ source_id: string; job: Job }>("/reviews/import", { method: "POST", body: fd })
    },
    onSuccess: (r) => setImportJob(r.job.id),
    onError: (e) => toast.error(errorMessage(e)),
  })

  const reset = () => {
    setFile(null); setImportJob(null); setAnalysisJob(null); setPlatform("")
  }
  const pick = (f: File | undefined) => {
    if (!f) return
    if (!/\.(csv|tsv|txt|xlsx|xlsm)$/i.test(f.name)) return toast.error("Upload a .csv or .xlsx file")
    if (f.size > 20 * 1024 * 1024) return toast.error("File is larger than 20 MB")
    setFile(f)
  }
  const busy = upload.isPending || (!!importJob && imp.data?.status !== "completed" && imp.data?.status !== "failed")

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload reviews</DialogTitle>
          <DialogDescription>
            CSV or Excel with a header row. Required: a review text column. Optional: rating, date, reviewer, platform, business, product, location.
            Only upload data you&apos;re authorized to use.
          </DialogDescription>
        </DialogHeader>
        {!importJob ? (
          <div className="space-y-4">
            {!initialProject && (
              <div className="space-y-1.5">
                <Label>Project</Label>
                <ProjectSelect value={projectId} onChange={setProjectId} allowAll={false} className="w-full" />
              </div>
            )}
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]) }}
              className={cn("flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
                drag ? "border-primary bg-accent/50" : "border-border")}
            >
              {file ? (
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="size-8 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => setFile(null)} aria-label="Remove file"><X /></Button>
                </div>
              ) : (
                <>
                  <UploadCloud className="size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">Drag & drop your file here</p>
                  <p className="text-xs text-muted-foreground">.csv or .xlsx up to 20 MB</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => inputRef.current?.click()}>Browse files</Button>
                </>
              )}
              <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xlsm" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="platform">Source platform <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="platform" placeholder="e.g. Google, Amazon" value={platform} onChange={(e) => setPlatform(e.target.value)} />
              </div>
              {!fixedBusiness && (
                <div className="space-y-1.5">
                  <Label>Reviews belong to</Label>
                  <Select value={businessId} onValueChange={setBusinessId} disabled={!projectId}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (business column / project)</SelectItem>
                      {businesses.data?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}{b.is_primary ? "" : " (competitor)"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={autoAnalyze} onCheckedChange={(v) => setAutoAnalyze(v === true)} /> Analyze automatically after import
            </label>
            <a href="/sample-reviews.csv" download className="block text-xs text-primary hover:underline">Download a sample CSV template</a>
          </div>
        ) : (
          <div className="space-y-3">
            <JobProgress job={imp.data} />
            {imp.data?.status === "completed" && (
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                {(["imported", "duplicates", "invalid"] as const).map((k) => (
                  <div key={k} className="rounded-lg bg-muted p-2">
                    <p className="text-lg font-semibold">{String(imp.data?.result_summary?.[k] ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">{titleCase(k)}</p>
                  </div>
                ))}
              </div>
            )}
            {analysisJob && <JobProgress job={ana.data} />}
          </div>
        )}
        <DialogFooter>
          {importJob ? (
            <Button onClick={() => { onOpenChange(false); reset() }} disabled={busy}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => upload.mutate()} disabled={!file || !projectId || upload.isPending}>
                {upload.isPending && <Loader2 className="animate-spin" />} Upload & import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ManualReviewDialog({ open, onOpenChange, projectId: initialProject }: { open: boolean; onOpenChange: (o: boolean) => void; projectId: string | null }) {
  const qc = useQueryClient()
  const [projectId, setProjectId] = useState<string | null>(initialProject)
  const [form, setForm] = useState({ text: "", rating: "", review_date: "", reviewer_name: "", platform: "", business_id: "auto" })
  const businesses = useBusinesses(projectId)
  const save = useMutation({
    mutationFn: () => api<{ job: Job | null }>("/reviews", {
      method: "POST",
      body: {
        project_id: projectId, text: form.text, rating: form.rating ? Number(form.rating) : null,
        review_date: form.review_date || null, reviewer_name: form.reviewer_name || null, platform: form.platform || null,
        business_id: form.business_id === "auto" ? null : form.business_id, analyze: true,
      },
    }),
    onSuccess: () => {
      toast.success("Review added — analysis started")
      setForm({ text: "", rating: "", review_date: "", reviewer_name: "", platform: "", business_id: "auto" })
      qc.invalidateQueries({ queryKey: ["reviews"] })
      onOpenChange(false)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a review manually</DialogTitle>
          <DialogDescription>For feedback received by email, phone or in person.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {!initialProject && (
            <div className="space-y-1.5 sm:col-span-2"><Label>Project</Label><ProjectSelect value={projectId} onChange={setProjectId} allowAll={false} className="w-full" /></div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="m-text">Review text</Label>
            <Textarea id="m-text" rows={4} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Rating</Label>
            <Select value={form.rating || "none"} onValueChange={(v) => setForm({ ...form, rating: v === "none" ? "" : v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No rating</SelectItem>
                {[5, 4, 3, 2, 1].map((r) => <SelectItem key={r} value={String(r)}>{r} star{r > 1 ? "s" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="m-date">Date</Label><Input id="m-date" type="date" value={form.review_date} onChange={(e) => setForm({ ...form, review_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="m-name">Reviewer</Label><Input id="m-name" value={form.reviewer_name} onChange={(e) => setForm({ ...form, reviewer_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="m-plat">Source</Label><Input id="m-plat" placeholder="Email, phone…" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Business</Label>
            <Select value={form.business_id} onValueChange={(v) => setForm({ ...form, business_id: v })} disabled={!projectId}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Project&apos;s business</SelectItem>
                {businesses.data?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!projectId || form.text.trim().length < 3 || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />} Add review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ReviewSheet({ reviewId, onOpenChange }: { reviewId: string | null; onOpenChange: (o: boolean) => void }) {
  const { data: r, isLoading } = useQuery({
    queryKey: ["review", reviewId],
    queryFn: () => api<Review>(`/reviews/${reviewId}`),
    enabled: !!reviewId,
  })
  return (
    <Sheet open={!!reviewId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Review details</SheetTitle>
          <SheetDescription>Original text, AI classification and the reasoning behind it.</SheetDescription>
        </SheetHeader>
        {isLoading || !r ? (
          <div className="space-y-3 px-4"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-24 w-full" /></div>
        ) : (
          <div className="space-y-5 px-4 pb-8">
            <div className="flex flex-wrap items-center gap-2">
              <Stars rating={r.rating} />
              <SentimentBadge sentiment={r.sentiment} />
              {r.emotion && <Pill color="violet">{titleCase(r.emotion)}</Pill>}
              {r.is_demo && <DemoBadge />}
            </div>
            <blockquote className="rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">{r.text}</blockquote>
            {r.translated_text && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">English translation ({r.language})</p>
                <p className="rounded-xl border p-3 text-sm">{r.translated_text}</p>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Business", r.business_name], ["Reviewer", r.reviewer_name], ["Date", formatDate(r.review_date)],
                ["Platform", r.platform], ["Language", r.language?.toUpperCase()], ["Verified", r.verified === null ? null : r.verified ? "Yes" : "No"],
                ["Source", r.source?.name],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v || "—"}</dd></div>
              ))}
            </dl>
            {r.analysis ? (
              <div className="rounded-xl border bg-accent/40 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary"><Bot className="size-3.5" /> AI explanation</p>
                <p className="mt-1.5 text-sm">{r.analysis.explanation}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {r.analysis.provider === "heuristic" ? "Built-in keyword engine" : `${r.analysis.provider} · ${r.analysis.model}`} · prompt {r.analysis.prompt_version} ·
                  confidence {Math.round((r.analysis.confidence || 0) * 100)}% · score {r.sentiment_score?.toFixed(2)}
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">This review hasn&apos;t been analyzed yet.</p>
            )}
            {!!r.signals?.length && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Extracted signals</p>
                <ul className="space-y-2">
                  {r.signals.filter((s) => s.kind !== "topic").map((s, i) => (
                    <li key={i} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Pill color={s.kind === "complaint" ? "red" : s.kind === "praise" ? "green" : "sky"}>{titleCase(s.kind)}</Pill>
                        <span className="text-sm font-medium">{s.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{categoryLabel(s.category)}{s.kind === "complaint" ? ` · severity ${s.severity}/5` : ""}</p>
                      {s.excerpt && <p className="mt-1.5 border-l-2 border-primary/40 pl-2 text-xs italic">“{s.excerpt}”</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function ClusterSheet({ clusterId, onOpenChange, onShowReviews }: { clusterId: string | null; onOpenChange: (o: boolean) => void; onShowReviews: (id: string) => void }) {
  const { data: c } = useQuery({
    queryKey: ["cluster", clusterId],
    queryFn: () => api<Cluster & { evidence: Evidence[] }>(`/reviews/clusters/${clusterId}`),
    enabled: !!clusterId,
  })
  return (
    <Sheet open={!!clusterId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{c?.label || "Theme"}</SheetTitle>
          <SheetDescription>{c?.summary || (c ? `${categoryLabel(c.category)} · ${titleCase(c.kind)}` : "")}</SheetDescription>
        </SheetHeader>
        {c && (
          <div className="space-y-5 px-4 pb-8">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted p-2"><p className="text-lg font-semibold">{c.review_count}</p><p className="text-xs text-muted-foreground">Reviews</p></div>
              <div className="rounded-lg bg-muted p-2"><p className="text-lg font-semibold">{c.avg_rating ?? "—"}</p><p className="text-xs text-muted-foreground">Avg rating</p></div>
              <div className="rounded-lg bg-muted p-2"><p className="text-lg font-semibold">{c.recent_count}</p><p className="text-xs text-muted-foreground">Last 30 days</p></div>
            </div>
            <div className="flex items-center gap-3"><TrendBadge trend={c.trend} />{c.kind === "complaint" && <SeverityMeter value={c.severity_score} />}</div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Evidence from actual reviews</p>
              <ul className="space-y-2">
                {c.evidence.map((e) => (
                  <li key={e.review_id} className="rounded-lg border p-3 text-sm">
                    <p className="italic">“{e.excerpt}”</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {[e.rating ? `${e.rating}★` : null, e.platform, formatDate(e.date), e.reviewer, `ref ${e.review_id.slice(0, 8)}`].filter(Boolean).join(" · ")}
                      {e.is_demo && " · DEMO"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <Button variant="outline" className="w-full" onClick={() => onShowReviews(c.id)}>Show all {c.review_count} reviews</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
