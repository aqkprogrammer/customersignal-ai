"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, CreditCard, ExternalLink, Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog, PageHeader, Panel } from "@/components/dashboard/primitives"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { CardSkeleton, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useWorkspace } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils"
import type { Plan, UsageSummary } from "@/types/api"

interface BillingData {
  stripe_enabled: boolean
  subscription: { plan: Plan | null; status: string; current_period_end: string | null; cancel_at_period_end: boolean; trial_ends_at: string | null; has_stripe_customer: boolean; has_paid_subscription: boolean }
  usage: UsageSummary
  plans: Plan[]
  can_manage: boolean
}
interface Invoice { id: string; number: string | null; amount_paid_cents: number; amount_due_cents: number; currency: string; status: string; plan_code: string | null; hosted_invoice_url: string | null; invoice_pdf_url: string | null; created_at: string }

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (100 * used) / limit) : 0
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><span className="tabular-nums text-muted-foreground">{formatNumber(used)} / {limit === null ? "Unlimited" : formatNumber(limit)}</span></div>
      <Progress value={limit === null ? 3 : pct} className={cn("mt-1.5 h-2", pct >= 90 && "[&>div]:bg-rose-500")} />
    </div>
  )
}

export function BillingPage() {
  const params = useSearchParams()
  const qc = useQueryClient()
  const { workspace } = useWorkspace()
  const [cancelOpen, setCancelOpen] = useState(false)
  const notified = useRef(false)
  const billing = useQuery({ queryKey: ["billing", workspace?.id], queryFn: () => api<BillingData>("/billing"), enabled: !!workspace })
  const invoices = useQuery({ queryKey: ["invoices", workspace?.id], queryFn: () => api<Invoice[]>("/billing/invoices"), enabled: !!billing.data?.can_manage })

  useEffect(() => {
    if (notified.current) return
    if (params.get("checkout") === "success") { notified.current = true; toast.success("Payment received — your plan will update in a moment."); setTimeout(() => qc.invalidateQueries({ queryKey: ["billing"] }), 2500) }
    if (params.get("checkout") === "cancelled") { notified.current = true; toast.info("Checkout cancelled — no charge was made.") }
  }, [params, qc])

  const checkout = useMutation({
    mutationFn: (plan_code: string) => api<{ mode: string; url: string }>("/billing/checkout", { method: "POST", body: { plan_code } }),
    onSuccess: (r) => { if (r.mode === "checkout") window.location.href = r.url; else { toast.success("Plan updated"); qc.invalidateQueries({ queryKey: ["billing"] }); qc.invalidateQueries({ queryKey: ["session"] }) } },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const portal = useMutation({
    mutationFn: () => api<{ url: string }>("/billing/portal", { method: "POST" }),
    onSuccess: (r) => (window.location.href = r.url),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const resume = useMutation({
    mutationFn: () => api("/billing/resume", { method: "POST" }),
    onSuccess: () => { toast.success("Subscription resumed"); qc.invalidateQueries({ queryKey: ["billing"] }) },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (billing.error) return <ErrorState error={billing.error} onRetry={() => billing.refetch()} />
  if (!billing.data) return <CardSkeleton rows={8} />
  const b = billing.data
  const sub = b.subscription
  const current = sub.plan?.code || "free"
  const isOwner = workspace?.role === "owner"

  return (
    <>
      <PageHeader title="Billing" description="Plans, usage and invoices for this workspace. Limits are enforced server-side."
        actions={isOwner && sub.has_stripe_customer && b.stripe_enabled && <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}><CreditCard /> Manage payment & invoices</Button>} />
      {!b.stripe_enabled && (
        <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          Online payments aren&apos;t configured on this server (STRIPE_SECRET_KEY not set). Plans can still be assigned by a platform administrator.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Current plan">
          <div className="flex items-baseline gap-2"><p className="text-2xl font-semibold">{sub.plan?.name}</p><StatusBadge status={sub.status} /></div>
          <p className="mt-1 text-sm text-muted-foreground">{sub.plan?.price_monthly_cents === null ? "Custom pricing" : `${formatCurrency(sub.plan?.price_monthly_cents ?? 0)} / month`}</p>
          {sub.trial_ends_at && sub.status === "trialing" && <p className="mt-2 text-sm">Trial ends {formatDate(sub.trial_ends_at)}</p>}
          {sub.current_period_end && <p className="mt-2 text-sm text-muted-foreground">{sub.cancel_at_period_end ? "Cancels" : "Renews"} on {formatDate(sub.current_period_end)}</p>}
          {isOwner && sub.has_paid_subscription && (
            sub.cancel_at_period_end
              ? <Button className="mt-4" variant="outline" onClick={() => resume.mutate()} disabled={resume.isPending}>Resume subscription</Button>
              : <Button className="mt-4" variant="ghost" onClick={() => setCancelOpen(true)}>Cancel subscription</Button>
          )}
        </Panel>
        <Panel title="Usage this month" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Meter label="Reviews analyzed" {...b.usage.reviews_analyzed} />
            <Meter label="AI reports" {...b.usage.reports_generated} />
            <Meter label="Projects" {...b.usage.projects} />
            <div><div className="flex justify-between text-sm"><span>AI tokens</span><span className="tabular-nums text-muted-foreground">{formatNumber(b.usage.ai_tokens.used)}</span></div></div>
          </div>
        </Panel>
      </div>

      <h2 className="mt-8 mb-3 text-base font-semibold">Plans</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {b.plans.map((p) => {
          const isCurrent = p.code === current
          return (
            <div key={p.code} className={cn("surface flex flex-col p-5", p.highlighted && "border-primary ring-1 ring-primary")}>
              <div className="flex items-center justify-between"><p className="font-semibold">{p.name}</p>{p.highlighted && <Pill color="signal">Popular</Pill>}</div>
              <p className="mt-2 text-2xl font-semibold">{p.price_monthly_cents === null ? "Custom" : formatCurrency(p.price_monthly_cents)}<span className="text-sm font-normal text-muted-foreground">{p.price_monthly_cents ? "/mo" : ""}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">{p.marketing_features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-primary" />{f}</li>)}</ul>
              <div className="mt-5">
                {isCurrent ? <Button variant="outline" className="w-full" disabled>Current plan</Button>
                  : p.code === "enterprise" ? <Button variant="outline" className="w-full" asChild><a href="/contact?topic=enterprise">Contact sales</a></Button>
                  : p.code === "free" ? <Button variant="ghost" className="w-full" disabled={!sub.has_paid_subscription || !isOwner} onClick={() => setCancelOpen(true)}>Downgrade</Button>
                  : <Button className="w-full" variant={p.highlighted ? "default" : "outline"} disabled={!isOwner || !b.stripe_enabled || checkout.isPending} onClick={() => checkout.mutate(p.code)}>
                      {checkout.isPending && checkout.variables === p.code && <Loader2 className="animate-spin" />}
                      {sub.has_paid_subscription ? "Switch plan" : p.trial_days ? `Start ${p.trial_days}-day trial` : "Upgrade"}
                    </Button>}
              </div>
            </div>
          )
        })}
      </div>
      {!isOwner && <p className="mt-3 text-sm text-muted-foreground">Only the workspace owner can change the plan.</p>}

      {b.can_manage && (
        <Panel title="Invoice history" className="mt-8">
          {!invoices.data?.length ? <p className="text-sm text-muted-foreground">No invoices yet.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Invoice</TableHead><TableHead>Plan</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {invoices.data.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{formatDate(i.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{i.number || "—"}</TableCell>
                    <TableCell>{i.plan_code || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(i.amount_paid_cents || i.amount_due_cents, i.currency)}</TableCell>
                    <TableCell><StatusBadge status={i.status} /></TableCell>
                    <TableCell className="text-right">{(i.hosted_invoice_url || i.invoice_pdf_url) && <Button variant="ghost" size="xs" asChild><a href={i.hosted_invoice_url || i.invoice_pdf_url || "#"} target="_blank" rel="noopener noreferrer"><ExternalLink /> View</a></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      )}
      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel your subscription?" destructive confirmLabel="Cancel at period end"
        description={`You'll keep ${sub.plan?.name} features until ${formatDate(sub.current_period_end)}, then move to the Free plan.`}
        onConfirm={async () => {
          await api("/billing/cancel", { method: "POST" }).catch((e) => { toast.error(errorMessage(e)); throw e })
          qc.invalidateQueries({ queryKey: ["billing"] }); toast.success("Subscription will cancel at the end of the period")
        }} />
    </>
  )
}
