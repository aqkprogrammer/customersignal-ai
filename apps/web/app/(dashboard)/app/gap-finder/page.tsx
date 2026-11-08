"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { Loader2, Plus, Radar } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/dashboard/primitives"
import { CardSkeleton, DemoBadge, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useWorkspace } from "@/hooks/use-session"
import { api, ApiError, errorMessage } from "@/lib/api"
import { formatNumber, timeAgo } from "@/lib/utils"
import type { Project } from "@/types/api"

type GapProject = Project & { opportunity_score: number | null; last_report_at: string | null }

export default function GapFinderPage() {
  const router = useRouter()
  const { can } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ product_name: "", product_url: "", category: "", competitor_product: "", marketplace: "Amazon" })
  const list = useQuery({ queryKey: ["gap-projects"], queryFn: () => api<GapProject[]>("/gap-finder") })
  const create = useMutation({
    mutationFn: () => api<Project>("/gap-finder", { method: "POST", body: { ...form, product_url: form.product_url || null, category: form.category || null, competitor_product: form.competitor_product || null } }),
    onSuccess: (p) => router.push(`/app/gap-finder/${p.id}`),
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) toast.error(e.message, { action: { label: "Upgrade", onClick: () => router.push("/app/billing") } })
      else toast.error(errorMessage(e))
    },
  })

  return (
    <>
      <PageHeader title="3-Star Gap Finder"
        description="Honest mid-rating reviews reveal what's almost great. Find unmet expectations, missing features and positioning gaps — from authorized review data only."
        actions={can("analyst") && <Button onClick={() => setOpen(true)}><Plus /> New gap analysis</Button>} />
      {list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      ) : !list.data.length ? (
        <EmptyState icon={Radar} title="No gap analyses yet" description="Add a product, upload its reviews (and optionally a competitor's), and get an opportunity score, unmet needs and a suggested roadmap."
          action={can("analyst") && <Button onClick={() => setOpen(true)}><Plus /> Analyze your first product</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map((p) => (
            <Link key={p.id} href={`/app/gap-finder/${p.id}`} className="surface p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.business_name}</p>
                  <p className="text-xs text-muted-foreground">{formatNumber(p.stats?.total ?? 0)} reviews {p.is_demo && <DemoBadge />}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-primary tabular-nums">{p.opportunity_score ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground">opportunity score</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{p.last_report_at ? `Last analyzed ${timeAgo(p.last_report_at)}` : "Not analyzed yet"}</p>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New gap analysis</DialogTitle>
            <DialogDescription>Next you&apos;ll upload review exports you&apos;re authorized to use. We never present scraped or synthetic reviews as genuine.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="g-name">Product name</Label><Input id="g-name" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="g-url">Product URL / ASIN <span className="text-muted-foreground">(optional)</span></Label><Input id="g-url" value={form.product_url} onChange={(e) => setForm({ ...form, product_url: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="g-cat">Category</Label><Input id="g-cat" placeholder="e.g. Kitchen appliances" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="g-mkt">Marketplace</Label><Input id="g-mkt" value={form.marketplace} onChange={(e) => setForm({ ...form, marketplace: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="g-comp">Competitor product <span className="text-muted-foreground">(optional)</span></Label><Input id="g-comp" value={form.competitor_product} onChange={(e) => setForm({ ...form, competitor_product: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={form.product_name.trim().length < 2 || create.isPending}>{create.isPending && <Loader2 className="animate-spin" />} Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
