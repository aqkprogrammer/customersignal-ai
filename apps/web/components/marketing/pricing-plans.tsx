"use client"

import { useQuery } from "@tanstack/react-query"
import { Check, Info } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
import { DEFAULT_PLANS, planCta, type PublicPlan } from "./pricing-data"

function usePublicPlans() {
  return useQuery({
    queryKey: ["public", "plans"],
    queryFn: () => api<PublicPlan[]>("/public/plans", { noWorkspace: true, noRefresh: true }),
    retry: 1,
    staleTime: 5 * 60_000,
  })
}

export function PricingPlans({ compact = false }: { compact?: boolean }) {
  const { data, isPending, isError, refetch, isFetching } = usePublicPlans()

  if (isPending) return <PlansSkeleton compact={compact} />

  const failed = isError || !Array.isArray(data) || data.length === 0
  const plans = failed ? DEFAULT_PLANS : data
  const visible = compact ? plans.filter((p) => p.code !== "free" && p.code !== "enterprise").slice(0, 3) : plans

  return (
    <div>
      {failed && (
        <div role="status" className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:bg-amber-500/10 dark:text-amber-200">
          <p className="flex items-start gap-2">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Showing <strong>default pricing</strong> — we couldn&apos;t load live plans right now. Final prices are confirmed at checkout.
            </span>
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="self-start bg-white/60 sm:self-auto dark:bg-transparent">
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      )}
      <ul
        className={cn(
          "grid gap-4",
          compact ? "md:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
        )}
      >
        {visible.map((plan) => (
          <PlanCard key={plan.code} plan={plan} />
        ))}
      </ul>
    </div>
  )
}

function PlanCard({ plan }: { plan: PublicPlan }) {
  const cta = planCta(plan)
  const custom = plan.price_monthly_cents === null
  return (
    <li
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-6",
        plan.highlighted ? "border-primary/40 shadow-[0_20px_50px_-24px_rgba(69,229,234,0.55)] ring-1 ring-primary/20" : "shadow-sm",
      )}
    >
      {plan.highlighted && (
        <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
          Most popular
        </span>
      )}
      <h3 className="text-base font-semibold">{plan.name}</h3>
      {plan.description && <p className="mt-1.5 min-h-10 text-sm leading-snug text-muted-foreground">{plan.description}</p>}
      <p className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-[-0.03em] tabular-nums">
          {custom ? "Custom" : formatCurrency(plan.price_monthly_cents, plan.currency)}
        </span>
        {!custom && <span className="text-sm text-muted-foreground">/ month</span>}
      </p>
      <p className="mt-1 h-4 text-xs text-muted-foreground">
        {plan.trial_days > 0 ? `${plan.trial_days}-day free trial` : plan.price_monthly_cents === 0 ? "No card required" : custom ? "Tailored to your team" : ""}
      </p>
      <Button
        asChild
        variant={plan.highlighted ? "default" : "outline"}
        className="mt-5 h-10 w-full rounded-lg"
      >
        <Link href={cta.href} aria-label={`${cta.label} — ${plan.name} plan`}>
          {cta.label}
        </Link>
      </Button>
      <ul className="mt-6 space-y-2.5 border-t pt-5 text-sm">
        {plan.marketing_features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </li>
  )
}

function PlansSkeleton({ compact }: { compact: boolean }) {
  const n = compact ? 3 : 5
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading plans…</span>
      <ul className={cn("grid gap-4", compact ? "md:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5")}>
        {Array.from({ length: n }).map((_, i) => (
          <li key={i} className="rounded-2xl border bg-card p-6">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-3/4" />
            <Skeleton className="mt-6 h-9 w-28" />
            <Skeleton className="mt-6 h-10 w-full" />
            <div className="mt-6 space-y-2.5 border-t pt-5">
              {Array.from({ length: 5 }).map((__, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
