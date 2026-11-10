"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileText, Radar, Sparkles, Upload } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { JobProgress, PageHeader, Panel, useJob } from "@/components/dashboard/primitives"
import { UploadDialog } from "@/components/dashboard/review-dialogs"
import { Pill } from "@/components/shared/badges"
import { CardSkeleton, DemoBadge, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { timeAgo, titleCase } from "@/lib/utils"
import type { Evidence, Job, Project } from "@/types/api"

interface Point { point: string; evidence: (Evidence & { ref: string; competitor: boolean })[] }
interface GapPayload {
  summary: string
  opportunity_score: number
  likes: Point[]; dislikes: Point[]; wishes: Point[]; missing_features: Point[]; quality_complaints: Point[]
  price_value: Point[]; unmet_expectations: Point[]; competitor_advantages: Point[]
  feature_recommendations: { title: string; rationale: string; priority: string }[]
  positioning: { angle: string; rationale: string }[]
  roadmap: { phase: string; items: string[] }[]
  dataset: { product: string; competitor: string | null; three_star_reviews: number; competitor_three_star_reviews: number; total_reviews: number }
}
interface GapData {
  project: Project
  businesses: { id: string; name: string; is_primary: boolean; review_count: number }[]
  report: null | { id: string; payload: GapPayload; provider: string; created_at: string; is_demo: boolean }
}

function PointList({ title, points, tone }: { title: string; points: Point[]; tone: "green" | "red" | "sky" | "amber" | "ice" }) {
  return (
    <Panel title={title}>
      {!points.length ? <p className="text-sm text-muted-foreground">Nothing notable.</p> : (
        <ul className="space-y-3">
          {points.map((p) => (
            <li key={p.point}>
              <p className="text-sm font-medium">{p.point}</p>
              {p.evidence.slice(0, 2).map((e) => (
                <p key={e.review_id} className="mt-1 border-l-2 pl-2 text-xs text-muted-foreground italic" style={{ borderColor: "var(--border)" }}>
                  “{e.excerpt.length > 160 ? e.excerpt.slice(0, 157) + "…" : e.excerpt}” <span className="not-italic">{e.rating}★{e.competitor ? " · competitor" : ""}</span>
                </p>
              ))}
              {!p.evidence.length && <Pill color={tone} className="mt-1">AI synthesis</Pill>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function GapDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const router = useRouter()
  const { can } = useWorkspace()
  const [uploadFor, setUploadFor] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const data = useQuery({ queryKey: ["gap", id], queryFn: () => api<GapData>(`/gap-finder/${id}/report`) })
  const job = useJob(jobId, { invalidate: [["gap", id], ["gap-projects"]], onDone: (j) => j.status === "completed" && toast.success("Gap report ready") })
  const run = useMutation({
    mutationFn: () => api<Job>(`/gap-finder/${id}/run`, { method: "POST" }),
    onSuccess: (j) => setJobId(j.id),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const report = useMutation({
    mutationFn: () => api<{ report: { id: string } }>("/reports", { method: "POST", body: { report_type: "gap_finder", project_id: id } }),
    onSuccess: (r) => toast.success("Generating PDF…", { action: { label: "Open", onClick: () => router.push(`/app/reports/${r.report.id}`) } }),
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (data.error) return <ErrorState error={data.error} onRetry={() => data.refetch()} />
  if (!data.data) return <CardSkeleton rows={8} />
  const { project, businesses } = data.data
  const r = data.data.report?.payload
  const primary = businesses.find((b) => b.is_primary)

  return (
    <>
      <PageHeader title={project.business_name || project.name} description={project.description || undefined}
        badge={project.is_demo ? <DemoBadge /> : undefined}
        actions={can("analyst") && (
          <>
            {r && <Button variant="outline" onClick={() => report.mutate()} disabled={report.isPending}><FileText /> Executive PDF</Button>}
            <Button onClick={() => run.mutate()} disabled={run.isPending || !primary?.review_count}><Sparkles /> {r ? "Re-run analysis" : "Run gap analysis"}</Button>
          </>
        )} />
      {jobId && <JobProgress job={job.data} className="mb-4" />}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {businesses.map((b) => (
          <div key={b.id} className="surface flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">{b.name} {b.is_primary ? <Pill color="signal">Your product</Pill> : <Pill>Competitor</Pill>}</p>
              <p className="text-xs text-muted-foreground">{b.review_count} reviews uploaded</p>
            </div>
            {can("analyst") && <Button variant="outline" size="sm" onClick={() => setUploadFor(b.id)}><Upload /> Upload</Button>}
          </div>
        ))}
      </div>

      {!r ? (
        <EmptyState icon={Radar} title={primary?.review_count ? "Ready to find gaps" : "Upload product reviews"}
          description="The Gap Finder focuses on 3-star reviews (2.5–3.4★) — customers who liked something but were held back."
          action={can("analyst") && (primary?.review_count
            ? <Button onClick={() => run.mutate()} disabled={run.isPending}><Sparkles /> Run gap analysis</Button>
            : <Button onClick={() => setUploadFor(primary?.id || null)}><Upload /> Upload review CSV</Button>)} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="surface flex flex-col items-center justify-center p-6 text-center">
              <div className="relative flex size-32 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(var(--primary) ${r.opportunity_score * 3.6}deg, var(--muted) 0deg)` }}>
                <div className="flex size-24 flex-col items-center justify-center rounded-full bg-card">
                  <span className="text-3xl font-semibold tabular-nums">{r.opportunity_score}</span>
                  <span className="text-[10px] text-muted-foreground">/ 100</span>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium">Product opportunity score</p>
              <p className="text-xs text-muted-foreground">{r.dataset.three_star_reviews} three-star reviews of {r.dataset.total_reviews}</p>
            </div>
            <Panel title="Summary" description={`${data.data.report!.provider === "heuristic" ? "Built-in engine" : data.data.report!.provider} · ${timeAgo(data.data.report!.created_at)}`}>
              <p className="text-sm leading-relaxed">{r.summary}</p>
            </Panel>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <PointList title="What customers like" points={r.likes} tone="green" />
            <PointList title="What customers dislike" points={r.dislikes} tone="red" />
            <PointList title="What customers wish existed" points={r.wishes} tone="sky" />
            <PointList title="Missing features" points={r.missing_features} tone="ice" />
            <PointList title="Quality complaints" points={r.quality_complaints} tone="red" />
            <PointList title="Price vs. value" points={r.price_value} tone="amber" />
            <PointList title="Unmet expectations" points={r.unmet_expectations} tone="amber" />
            <PointList title="Competitor advantages" points={r.competitor_advantages} tone="ice" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Feature recommendations">
              <ul className="space-y-3">
                {r.feature_recommendations.map((f) => (
                  <li key={f.title} className="flex gap-3">
                    <Pill color={f.priority === "high" ? "red" : f.priority === "medium" ? "amber" : "gray"}>{titleCase(f.priority)}</Pill>
                    <div><p className="text-sm font-medium">{f.title}</p><p className="text-xs text-muted-foreground">{f.rationale}</p></div>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Positioning opportunities">
              <ul className="space-y-3">{r.positioning.map((p) => <li key={p.angle}><p className="text-sm font-medium">{p.angle}</p><p className="text-xs text-muted-foreground">{p.rationale}</p></li>)}</ul>
            </Panel>
          </div>
          <Panel title="Suggested product roadmap">
            <div className="grid gap-3 md:grid-cols-3">
              {r.roadmap.map((ph) => (
                <div key={ph.phase} className="rounded-xl border p-4">
                  <p className="text-xs font-semibold text-primary">{ph.phase}</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm">{ph.items.map((i) => <li key={i}>{i}</li>)}</ul>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Recommendations were also added to <Link href={`/app/opportunities?project=${id}`} className="text-primary hover:underline">Product Opportunities</Link>.</p>
          </Panel>
        </div>
      )}
      <UploadDialog open={!!uploadFor} onOpenChange={(o) => !o && setUploadFor(null)} projectId={id} businessId={uploadFor} key={uploadFor || "x"}
        onComplete={() => qc.invalidateQueries({ queryKey: ["gap", id] })} />
    </>
  )
}
