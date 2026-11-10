"use client"

import { useQuery } from "@tanstack/react-query"
import { Check, Loader2, Pencil, Sparkles } from "lucide-react"
import { useState } from "react"
import { Pill } from "@/components/shared/badges"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAdminMutation, useCan } from "@/hooks/use-admin"
import { adminApi, centsToDollars, dollarsToCents } from "@/lib/admin-api"
import { LIMIT_FIELDS, type AdminPlan, type Limits, type PlansResponse } from "@/lib/admin-types"
import { cn, formatCurrency, formatNumber, titleCase } from "@/lib/utils"
import { Field, PageHeader } from "../ui"

export function AdminPlans() {
  const can = useCan()
  const [editing, setEditing] = useState<AdminPlan | null>(null)
  const q = useQuery({ queryKey: ["admin", "plans"], queryFn: () => adminApi<PlansResponse>("/plans") })

  return (
    <>
      <PageHeader eyebrow="Billing" title="Plans & pricing" description="Prices, limits and feature entitlements. Changes apply immediately to every workspace on the plan." />
      {q.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} rows={8} />)}</div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.plans.length === 0 ? (
        <EmptyState title="No plans" description="Plans are seeded by the API on first start." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.plans.map((p) => (
            <div key={p.id} className={cn("flex flex-col rounded-xl border bg-card/70 p-4", p.highlighted && "border-signal-400/40 shadow-[0_0_0_1px_rgba(69,229,234,0.25),0_20px_50px_-25px_rgba(69,229,234,0.6)]")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{p.name}</h3>
                    <span className="font-mono text-[10px] text-muted-foreground">{p.code}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.is_active ? <Pill color="green">Active</Pill> : <Pill color="gray">Inactive</Pill>}
                    {p.is_public ? <Pill color="sky">Public</Pill> : <Pill color="gray">Hidden</Pill>}
                    {p.highlighted && <Pill color="ice"><Sparkles className="size-3" /> Highlighted</Pill>}
                  </div>
                </div>
                {can("plans.manage") && (
                  <Button variant="outline" size="xs" onClick={() => setEditing(p)}><Pencil /> Edit</Button>
                )}
              </div>
              <div className="mt-3 text-2xl font-semibold text-white tabular-nums">
                {formatCurrency(p.price_monthly_cents, p.currency)}
                {p.price_monthly_cents !== null && <span className="text-sm font-normal text-muted-foreground"> /mo</span>}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {LIMIT_FIELDS.map((f) => (
                  <div key={f} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{titleCase(f.replace(/^max_/, ""))}</dt>
                    <dd className="tabular-nums">{p.limits[f] === null ? "∞" : formatNumber(p.limits[f])}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Trial</dt>
                  <dd>{p.trial_days ? `${p.trial_days}d` : "—"}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1">
                {p.features.map((f) => <Pill key={f} color="signal">{titleCase(f)}</Pill>)}
              </div>
              <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>{formatNumber(p.subscribers)} subscriptions</span>
                <span className="truncate font-mono text-[10px]" title={p.stripe_price_id_monthly || undefined}>{p.stripe_price_id_monthly || "no Stripe price"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
          {editing && q.data && <PlanForm plan={editing} features={q.data.features} onDone={() => setEditing(null)} />}
        </SheetContent>
      </Sheet>
    </>
  )
}

type LimitState = Record<keyof Limits, { unlimited: boolean; value: string }>

function PlanForm({ plan, features, onDone }: { plan: AdminPlan; features: Record<string, string>; onDone: () => void }) {
  const [name, setName] = useState(plan.name)
  const [description, setDescription] = useState(plan.description || "")
  const [customPrice, setCustomPrice] = useState(plan.price_monthly_cents === null)
  const [price, setPrice] = useState(centsToDollars(plan.price_monthly_cents))
  const [stripeId, setStripeId] = useState(plan.stripe_price_id_monthly || "")
  const [trialDays, setTrialDays] = useState(String(plan.trial_days ?? 0))
  const [isActive, setIsActive] = useState(plan.is_active)
  const [isPublic, setIsPublic] = useState(plan.is_public)
  const [highlighted, setHighlighted] = useState(plan.highlighted)
  const [feats, setFeats] = useState<string[]>(plan.features || [])
  const [marketing, setMarketing] = useState((plan.marketing_features || []).join("\n"))
  const [limits, setLimits] = useState<LimitState>(() =>
    Object.fromEntries(LIMIT_FIELDS.map((f) => [f, { unlimited: plan.limits[f] === null, value: plan.limits[f] === null ? "" : String(plan.limits[f]) }])) as LimitState,
  )

  const mutation = useAdminMutation<Record<string, unknown>>({
    fn: (body) => adminApi(`/plans/${plan.code}`, { method: "PATCH", body }),
    success: `${plan.name} plan saved`,
    invalidate: [["admin", "plans"]],
    onSuccess: onDone,
  })

  // Build a diff so unchanged fields aren't sent (the API clears the Stripe price id when only the price changes).
  const errors: string[] = []
  const body: Record<string, unknown> = {}
  if (name.trim() !== plan.name) body.name = name.trim()
  if (!name.trim()) errors.push("Name is required.")
  if (description.trim() !== (plan.description || "")) body.description = description.trim()
  const cents = customPrice ? null : dollarsToCents(price)
  if (!customPrice && cents === null) errors.push("Enter a valid price.")
  else if (cents !== plan.price_monthly_cents) body.price_monthly_cents = cents
  if (stripeId.trim() !== (plan.stripe_price_id_monthly || "")) body.stripe_price_id_monthly = stripeId.trim() || null
  const trial = Number(trialDays)
  if (!Number.isInteger(trial) || trial < 0 || trial > 90) errors.push("Trial days must be 0–90.")
  else if (trial !== plan.trial_days) body.trial_days = trial
  if (isActive !== plan.is_active) body.is_active = isActive
  if (isPublic !== plan.is_public) body.is_public = isPublic
  if (highlighted !== plan.highlighted) body.highlighted = highlighted
  if ([...feats].sort().join() !== [...(plan.features || [])].sort().join()) body.features = feats
  const mk = marketing.split("\n").map((s) => s.trim()).filter(Boolean)
  if (mk.join("\n") !== (plan.marketing_features || []).join("\n")) body.marketing_features = mk
  for (const f of LIMIT_FIELDS) {
    const l = limits[f]
    const v = l.unlimited ? null : Number(l.value)
    if (!l.unlimited && (l.value.trim() === "" || !Number.isInteger(v) || (v as number) < 0)) errors.push(`${titleCase(f)} must be a whole number or unlimited.`)
    else if (v !== plan.limits[f]) body[f] = v
  }
  const changed = Object.keys(body).length > 0
  const priceChanged = "price_monthly_cents" in body && !("stripe_price_id_monthly" in body) && !!plan.stripe_price_id_monthly

  return (
    <form className="flex min-h-full flex-col" onSubmit={(e) => { e.preventDefault(); if (!errors.length && changed) mutation.mutate(body) }}>
      <SheetHeader className="border-b">
        <SheetTitle>Edit {plan.name} plan</SheetTitle>
        <SheetDescription>Code <span className="font-mono">{plan.code}</span> · {formatNumber(plan.subscribers)} subscriptions</SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="p-name"><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
          <Field label="Trial days" htmlFor="p-trial" hint="0–90"><Input id="p-trial" inputMode="numeric" value={trialDays} onChange={(e) => setTrialDays(e.target.value.replace(/\D/g, ""))} /></Field>
        </div>
        <Field label="Description" htmlFor="p-desc"><Textarea id="p-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></Field>
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="p-custom" className="text-xs">Custom pricing (contact sales)</Label>
            <Switch id="p-custom" checked={customPrice} onCheckedChange={setCustomPrice} size="sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Monthly price (${plan.currency.toUpperCase()})`} htmlFor="p-price">
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input id="p-price" className="pl-6" inputMode="decimal" disabled={customPrice} value={customPrice ? "" : price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder={customPrice ? "Custom" : "0"} />
              </div>
            </Field>
            <Field label="Stripe price ID" htmlFor="p-stripe" hint={priceChanged ? "Will be cleared — a new Stripe price is created on next checkout." : "Leave blank to auto-create."}>
              <Input id="p-stripe" className="font-mono text-xs" value={stripeId} onChange={(e) => setStripeId(e.target.value)} placeholder="price_…" maxLength={120} />
            </Field>
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium">Limits</div>
          <div className="space-y-2 rounded-lg border p-3">
            {LIMIT_FIELDS.map((f) => (
              <div key={f} className="grid grid-cols-[1fr_110px_auto] items-center gap-3">
                <Label htmlFor={`l-${f}`} className="truncate text-xs font-normal text-muted-foreground">{titleCase(f.replace(/^max_/, ""))}</Label>
                <Input
                  id={`l-${f}`}
                  className="h-7 text-xs"
                  inputMode="numeric"
                  disabled={limits[f].unlimited}
                  value={limits[f].unlimited ? "" : limits[f].value}
                  placeholder={limits[f].unlimited ? "∞" : "0"}
                  onChange={(e) => setLimits((s) => ({ ...s, [f]: { ...s[f], value: e.target.value.replace(/\D/g, "") } }))}
                />
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Switch size="sm" checked={limits[f].unlimited} onCheckedChange={(v) => setLimits((s) => ({ ...s, [f]: { ...s[f], unlimited: v } }))} aria-label={`${f} unlimited`} />
                  Unlimited
                </label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium">Feature entitlements</div>
          <div className="grid gap-1.5 rounded-lg border p-3 sm:grid-cols-2">
            {Object.entries(features).map(([key, label]) => (
              <label key={key} className="flex items-start gap-2 rounded-md p-1 text-xs hover:bg-white/[0.03]">
                <Checkbox
                  checked={feats.includes(key)}
                  onCheckedChange={(v) => setFeats((s) => (v === true ? [...s, key] : s.filter((x) => x !== key)))}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-foreground">{label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{key}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <Field label="Marketing feature list" htmlFor="p-mk" hint="One bullet per line — shown on the public pricing page.">
          <Textarea id="p-mk" rows={5} value={marketing} onChange={(e) => setMarketing(e.target.value)} />
        </Field>
        <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
          {([
            ["Active", isActive, setIsActive, "p-active"],
            ["Public", isPublic, setIsPublic, "p-public"],
            ["Highlighted", highlighted, setHighlighted, "p-hl"],
          ] as const).map(([label, val, set, id]) => (
            <div key={id} className="flex items-center justify-between gap-2">
              <Label htmlFor={id} className="text-xs">{label}</Label>
              <Switch id={id} checked={val} onCheckedChange={set} size="sm" />
            </div>
          ))}
        </div>
        {errors.length > 0 && (
          <ul className="space-y-0.5 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
      </div>
      <SheetFooter className="sticky bottom-0 flex-row justify-end border-t bg-popover">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={!changed || errors.length > 0 || mutation.isPending}>
          {mutation.isPending ? <Loader2 className="animate-spin" /> : <Check />}
          Save plan
        </Button>
      </SheetFooter>
    </form>
  )
}
