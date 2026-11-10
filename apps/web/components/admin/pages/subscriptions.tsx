"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Loader2, Receipt, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useAdminMutation, useCan, useDebounced, usePaging } from "@/hooks/use-admin"
import { adminApi } from "@/lib/admin-api"
import { LIMIT_FIELDS, type AdminSubscriptionRow, type Limits, type Paged } from "@/lib/admin-types"
import { formatCurrency, formatDate, titleCase } from "@/lib/utils"
import { Field, FilterBar, FilterSelect, PageHeader, Pager, SearchBox, TableCard, TableRowsSkeleton } from "../ui"
import { PLAN_OPTIONS, SUBSCRIPTION_STATUSES } from "./shared"

const KEEP = "__keep__"

export function AdminSubscriptions() {
  const can = useCan()
  const [q, setQ] = useState("")
  const [plan, setPlan] = useState("")
  const [status, setStatus] = useState("")
  const [editing, setEditing] = useState<AdminSubscriptionRow | null>(null)
  const { page, pageSize, setPage, setPageSize } = usePaging()
  const search = useDebounced(q)
  const query = useQuery({
    queryKey: ["admin", "subscriptions", { search, plan, status, page, pageSize }],
    queryFn: () => adminApi<Paged<AdminSubscriptionRow>>("/subscriptions", { query: { q: search, plan, status, page, page_size: pageSize } }),
    placeholderData: keepPreviousData,
  })
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(1)
  }
  const manage = can("subscriptions.manage")

  return (
    <>
      <PageHeader eyebrow="Billing" title="Subscriptions" description="Plans, statuses and manual adjustments. Every adjustment requires a reason and is audit-logged." />
      <FilterBar>
        <SearchBox value={q} onChange={reset(setQ)} placeholder="Search workspace…" />
        <FilterSelect label="Plan" value={plan} onChange={reset(setPlan)} options={PLAN_OPTIONS} />
        <FilterSelect label="Status" value={status} onChange={reset(setStatus)} options={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))} />
      </FilterBar>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <TableCard footer={query.data && <Pager page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} onPageSize={setPageSize} fetching={query.isFetching} />}>
          {query.isPending ? (
            <TableRowsSkeleton cols={6} />
          ) : query.data.items.length === 0 ? (
            <div className="p-4"><EmptyState icon={Receipt} title="No subscriptions match" className="border-0" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Period end / trial</TableHead>
                  <TableHead>Overrides</TableHead>
                  {manage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((s) => (
                  <TableRow key={s.id} className="hover:bg-white/[0.03]">
                    <TableCell className="max-w-[220px]">
                      <Link href={`/admin/workspaces/${s.workspace_id}`} className="block truncate font-medium text-white hover:text-signal-300">{s.workspace_name}</Link>
                    </TableCell>
                    <TableCell><Pill color={s.plan === "free" ? "gray" : "signal"}>{s.plan_name}</Pill></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <StatusBadge status={s.status} />
                        {s.cancel_at_period_end && <Pill color="amber">Cancels</Pill>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(s.mrr_cents)}</TableCell>
                    <TableCell>{s.stripe_subscription_id ? <Pill color="ice">Stripe</Pill> : s.manual ? <Pill color="amber">Manual</Pill> : <Pill>Free</Pill>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.trial_ends_at ? <>Trial → {formatDate(s.trial_ends_at)}</> : formatDate(s.current_period_end)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.limit_overrides && Object.keys(s.limit_overrides).length ? <Pill color="amber">{Object.keys(s.limit_overrides).length} override(s)</Pill> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    {manage && (
                      <TableCell className="text-right">
                        <Button variant="outline" size="xs" onClick={() => setEditing(s)}><SlidersHorizontal /> Adjust</Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          {editing && <AdjustForm sub={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

type LimitMode = "default" | "custom" | "unlimited"

function AdjustForm({ sub, onDone }: { sub: AdminSubscriptionRow; onDone: () => void }) {
  const initial = sub.limit_overrides || {}
  const [plan, setPlan] = useState(KEEP)
  const [status, setStatus] = useState(KEEP)
  const [trialDays, setTrialDays] = useState("")
  const [reason, setReason] = useState("")
  const [limits, setLimits] = useState<Record<keyof Limits, { mode: LimitMode; value: string }>>(() => {
    const out = {} as Record<keyof Limits, { mode: LimitMode; value: string }>
    for (const f of LIMIT_FIELDS) {
      if (!(f in initial)) out[f] = { mode: "default", value: "" }
      else if (initial[f] === null) out[f] = { mode: "unlimited", value: "" }
      else out[f] = { mode: "custom", value: String(initial[f]) }
    }
    return out
  })

  const mutation = useAdminMutation<Record<string, unknown>>({
    fn: (body) => adminApi(`/subscriptions/${sub.id}/adjust`, { method: "POST", body }),
    success: "Subscription updated",
    invalidate: [["admin", "subscriptions"], ["admin", "workspace", sub.workspace_id]],
    onSuccess: onDone,
  })

  const overrides: Partial<Limits> = {}
  let limitsValid = true
  for (const f of LIMIT_FIELDS) {
    const l = limits[f]
    if (l.mode === "unlimited") overrides[f] = null
    if (l.mode === "custom") {
      const n = Number(l.value)
      if (l.value.trim() === "" || !Number.isInteger(n) || n < 0) limitsValid = false
      else overrides[f] = n
    }
  }
  const overridesChanged = JSON.stringify(sortKeys(overrides)) !== JSON.stringify(sortKeys(initial))
  const trialN = trialDays ? Number(trialDays) : null
  const trialValid = trialN === null || (Number.isInteger(trialN) && trialN >= 1 && trialN <= 90)
  const hasChange = plan !== KEEP || status !== KEEP || overridesChanged || trialN !== null
  const valid = reason.trim().length >= 3 && limitsValid && trialValid && hasChange

  const submit = () => {
    const body: Record<string, unknown> = { reason: reason.trim() }
    if (plan !== KEEP) body.plan_code = plan
    if (status !== KEEP) body.status = status
    if (overridesChanged) body.limit_overrides = overrides
    if (trialN !== null) body.extend_trial_days = trialN
    mutation.mutate(body)
  }

  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (valid) submit() }}>
      <DialogHeader>
        <DialogTitle>Adjust subscription</DialogTitle>
        <DialogDescription>
          {sub.workspace_name} · currently {sub.plan_name} ({titleCase(sub.status)})
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Plan" hint={sub.stripe_subscription_id ? "Billed via Stripe — change plan in Stripe." : undefined}>
          <Select value={plan} onValueChange={setPlan} disabled={!!sub.stripe_subscription_id}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={KEEP}>Keep ({sub.plan_name})</SelectItem>
              {PLAN_OPTIONS.filter((p) => p.value !== sub.plan).map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={KEEP}>Keep ({titleCase(sub.status)})</SelectItem>
              {SUBSCRIPTION_STATUSES.filter((s) => s !== sub.status).map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Extend trial (days)" htmlFor="trial-days" hint="1–90 days, added to the current trial end (or today)." error={trialValid ? undefined : "Enter a whole number from 1 to 90."}>
        <Input id="trial-days" inputMode="numeric" value={trialDays} onChange={(e) => setTrialDays(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 14" />
      </Field>
      <div>
        <div className="mb-2 text-xs font-medium text-foreground/90">Limit overrides</div>
        <div className="space-y-2 rounded-lg border p-3">
          {LIMIT_FIELDS.map((f) => (
            <div key={f} className="grid grid-cols-[1fr_120px_96px] items-center gap-2">
              <span className="truncate text-xs text-muted-foreground">{titleCase(f.replace(/^max_/, ""))}</span>
              <Select value={limits[f].mode} onValueChange={(v) => setLimits((s) => ({ ...s, [f]: { ...s[f], mode: v as LimitMode } }))}>
                <SelectTrigger size="sm" className="w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Plan default</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                </SelectContent>
              </Select>
              <Input
                aria-label={`${f} value`}
                className="h-7 text-xs"
                inputMode="numeric"
                disabled={limits[f].mode !== "custom"}
                value={limits[f].value}
                onChange={(e) => setLimits((s) => ({ ...s, [f]: { ...s[f], value: e.target.value.replace(/\D/g, "") } }))}
              />
            </div>
          ))}
        </div>
        {!limitsValid && <p className="mt-1 text-xs text-rose-400">Custom limits need a whole number.</p>}
      </div>
      <Field label="Reason (required, audit-logged)" htmlFor="adjust-reason">
        <Textarea id="adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={!valid || mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          Apply changes
        </Button>
      </DialogFooter>
    </form>
  )
}

function sortKeys(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
}
