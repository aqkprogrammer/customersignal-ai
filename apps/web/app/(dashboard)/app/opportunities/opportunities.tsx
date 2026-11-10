"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Lightbulb } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { PageHeader, ProjectSelect } from "@/components/dashboard/primitives"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { CardSkeleton, DemoBadge, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useWorkspace } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { formatDate, titleCase } from "@/lib/utils"
import type { Opportunity } from "@/types/api"

const STATUSES = ["new", "planned", "in_progress", "done", "dismissed"]
const impactColor = { high: "red", medium: "amber", low: "gray" } as const

export function OpportunitiesPage() {
  const params = useSearchParams()
  const qc = useQueryClient()
  const { can } = useWorkspace()
  const [projectId, setProjectId] = useState<string | null>(params.get("project"))
  const [status, setStatus] = useState("open")
  const [source, setSource] = useState("all")
  const [openId, setOpenId] = useState<string | null>(params.get("id"))

  const list = useQuery({
    queryKey: ["opportunities", projectId, status, source],
    queryFn: () => api<Opportunity[]>("/opportunities", { query: { project_id: projectId, status: status === "open" ? undefined : status, source: source === "all" ? undefined : source } }),
  })
  const detail = useQuery({ queryKey: ["opportunity", openId], queryFn: () => api<Opportunity>(`/opportunities/${openId}`), enabled: !!openId })
  const setStatusM = useMutation({
    mutationFn: ({ id, s }: { id: string; s: string }) => api(`/opportunities/${id}`, { method: "PATCH", body: { status: s } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["opportunities"] }); qc.invalidateQueries({ queryKey: ["opportunity"] }); toast.success("Status updated") },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <>
      <PageHeader title="Product Opportunities" description="Prioritized actions discovered from recurring themes — each one is backed by real review evidence."
        actions={
          <>
            <ProjectSelect value={projectId} onChange={setProjectId} />
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-[150px]" aria-label="Source"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="analysis">Review analysis</SelectItem>
                <SelectItem value="gap_finder">Gap finder</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px]" aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">All open</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        } />
      {list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : !list.data.length ? (
        <EmptyState icon={Lightbulb} title="No opportunities yet" description="Analyze a review dataset — opportunities are generated from recurring complaints, praise and feature requests."
          action={<Button asChild><Link href="/app/reviews?import=1">Upload reviews</Link></Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map((o) => (
            <button key={o.id} onClick={() => setOpenId(o.id)} className="surface flex flex-col p-5 text-left transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-ice-50 text-lg font-semibold text-ice-700 tabular-nums dark:bg-ice-500/15 dark:text-ice-300">{Math.round(o.score)}</span>
                <div className="flex flex-wrap justify-end gap-1">{o.is_demo && <DemoBadge />}<StatusBadge status={o.status} /></div>
              </div>
              <h3 className="mt-3 text-sm font-semibold">{o.title}</h3>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{o.description}</p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                <Pill color={impactColor[o.impact]}>{titleCase(o.impact)} impact</Pill>
                <Pill>{titleCase(o.effort)} effort</Pill>
                <Pill color="signal">{titleCase(o.opportunity_type)}</Pill>
                <Pill color="gray">{o.evidence_count} evidence</Pill>
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{detail.data?.title || "Opportunity"}</SheetTitle>
            <SheetDescription>Score {detail.data ? Math.round(detail.data.score) : "—"} / 100 · {titleCase(detail.data?.source)}</SheetDescription>
          </SheetHeader>
          {detail.data && (
            <div className="space-y-5 px-4 pb-8">
              <p className="text-sm">{detail.data.description}</p>
              {detail.data.recommendation && (
                <div className="rounded-xl bg-accent/50 p-4 text-sm"><p className="mb-1 text-xs font-semibold text-primary">Recommended action</p>{detail.data.recommendation}</div>
              )}
              {can("analyst") && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Select value={detail.data.status} onValueChange={(s) => setStatusM.mutate({ id: detail.data!.id, s })}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Evidence from reviews</p>
                <ul className="space-y-2">
                  {detail.data.evidence?.map((e) => (
                    <li key={e.review_id} className="rounded-lg border p-3 text-sm">
                      <p className="italic">“{e.excerpt}”</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{[e.rating ? `${e.rating}★` : null, e.platform, formatDate(e.date), `ref ${e.review_id.slice(0, 8)}`].filter(Boolean).join(" · ")}{e.is_demo && " · DEMO"}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
