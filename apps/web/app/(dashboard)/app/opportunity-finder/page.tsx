"use client"

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"
import { Loader2, Plus, Search, Target, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { PageHeader, Pagination } from "@/components/dashboard/primitives"
import { StatusBadge } from "@/components/shared/badges"
import { DemoBadge, EmptyState, ErrorState, TableSkeleton } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useWorkspace } from "@/hooks/use-session"
import { api, ApiError, errorMessage } from "@/lib/api"
import { COUNTRIES, INDUSTRIES } from "@/lib/site"
import { cn, timeAgo, titleCase } from "@/lib/utils"
import type { Lead, Page } from "@/types/api"

const PIPELINE = ["new", "researched", "contacted", "replied", "meeting_booked", "converted", "not_interested"] as const

export default function OpportunityFinderPage() {
  const router = useRouter()
  const { can } = useWorkspace()
  const [status, setStatus] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ business_name: "", website: "", country: "United Arab Emirates", city: "", industry: "", competitor: "" })
  const [competitors, setCompetitors] = useState<string[]>([])

  const leads = useQuery({
    queryKey: ["leads", status, q, page],
    queryFn: () => api<Page<Lead> & { pipeline: Record<string, number> }>("/leads", { query: { status, q: q || undefined, page, page_size: 20 } }),
    placeholderData: keepPreviousData,
  })
  const create = useMutation({
    mutationFn: () => api<Lead>("/leads", {
      method: "POST",
      body: { business_name: form.business_name, website: form.website || null, country: form.country || null, city: form.city || null, industry: form.industry || null, competitors },
    }),
    onSuccess: (lead) => { toast.success("Lead created — now add its review data."); router.push(`/app/opportunity-finder/${lead.id}`) },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) toast.error(e.message, { action: { label: "Upgrade", onClick: () => router.push("/app/billing") } })
      else toast.error(errorMessage(e))
    },
  })
  const addCompetitor = () => {
    const c = form.competitor.trim()
    if (c && !competitors.includes(c) && competitors.length < 5) setCompetitors([...competitors, c])
    setForm({ ...form, competitor: "" })
  }

  return (
    <>
      <PageHeader
        title="1-Star Review Cold Pitch"
        description="Find businesses with recurring negative reviews and pitch evidence-backed improvements. Every claim is grounded in the business's actual review data."
        actions={can("analyst") && <Button onClick={() => setOpen(true)}><Plus /> Research a business</Button>}
      />
      {leads.data && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {PIPELINE.map((s) => (
            <button key={s} onClick={() => { setStatus(status === s ? null : s); setPage(1) }}
              className={cn("surface p-3 text-left transition-all hover:border-primary/30", status === s && "border-primary ring-1 ring-primary")}>
              <p className="text-xl font-semibold tabular-nums">{leads.data.pipeline[s] ?? 0}</p>
              <p className="text-xs text-muted-foreground">{titleCase(s)}</p>
            </button>
          ))}
        </div>
      )}
      <div className="mb-3 relative w-full sm:w-72">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Search leads…" className="pl-8" aria-label="Search leads" />
      </div>
      {leads.error ? <ErrorState error={leads.error} onRetry={() => leads.refetch()} /> : !leads.data ? <TableSkeleton /> : !leads.data.items.length ? (
        <EmptyState icon={Target} title={status || q ? "No leads match" : "No leads yet"}
          description="Enter a business, upload its review data (that you're authorized to use), and get a ranked issue report, a one-page PDF and a personalized pitch."
          action={can("analyst") && <Button onClick={() => setOpen(true)}><Plus /> Research your first business</Button>} />
      ) : (
        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead className="hidden lg:table-cell">Top issue</TableHead>
                <TableHead>Pitch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.data.items.map((l) => (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => router.push(`/app/opportunity-finder/${l.id}`)}>
                  <TableCell>
                    <Link href={`/app/opportunity-finder/${l.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{l.business_name}</Link>
                    <div className="text-xs text-muted-foreground">{l.industry} {l.is_demo && <DemoBadge />}</div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{[l.city, l.country].filter(Boolean).join(", ") || "—"}</TableCell>
                  <TableCell className="hidden max-w-60 truncate text-sm lg:table-cell">{l.top_issue || "—"}</TableCell>
                  <TableCell><StatusBadge status={l.pitch_status === "none" ? "pending" : l.pitch_status} /></TableCell>
                  <TableCell><StatusBadge status={l.status} /></TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{timeAgo(l.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {leads.data && <Pagination page={page} pageSize={leads.data.page_size} total={leads.data.total} onPage={setPage} />}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Research a business</DialogTitle>
            <DialogDescription>Next you&apos;ll upload its reviews. We never claim a business has problems without evidence from its own review data.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="l-name">Business name</Label><Input id="l-name" placeholder="e.g. Dubai Beauty Clinic" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="l-web">Website</Label><Input id="l-web" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="l-city">City</Label><Input id="l-city" placeholder="Dubai" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Industry</Label>
              <Select value={form.industry || undefined} onValueChange={(v) => setForm({ ...form, industry: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>{INDUSTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="l-comp">Competitors <span className="text-muted-foreground">(optional, up to 5)</span></Label>
              <div className="flex gap-2">
                <Input id="l-comp" value={form.competitor} onChange={(e) => setForm({ ...form, competitor: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompetitor() } }} />
                <Button variant="outline" onClick={addCompetitor} type="button">Add</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {competitors.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                    {c}<button onClick={() => setCompetitors(competitors.filter((x) => x !== c))} aria-label={`Remove ${c}`}><X className="size-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={form.business_name.trim().length < 2 || create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />} Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
