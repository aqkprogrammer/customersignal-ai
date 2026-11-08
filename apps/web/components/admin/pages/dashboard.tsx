"use client"

import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  BotMessageSquare,
  CreditCard,
  DollarSign,
  Package,
  Percent,
  RefreshCw,
  Star,
  TrendingDown,
  UserPlus,
  Users,
  Activity,
} from "lucide-react"
import Link from "next/link"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { useCan } from "@/hooks/use-admin"
import { adminApi, formatUsd } from "@/lib/admin-api"
import type { DashboardData } from "@/lib/admin-types"
import { formatCompact, formatCurrency, formatNumber, timeAgo, titleCase } from "@/lib/utils"
import { BarsChart, DonutChart, TrendChart } from "../charts"
import { KpiGrid, KpiSkeleton, KpiTile, PageHeader, Panel } from "../ui"

function pctChange(series: number[]) {
  if (series.length < 2) return null
  const prev = series[series.length - 2]
  const cur = series[series.length - 1]
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}

export function AdminDashboard() {
  const q = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => adminApi<DashboardData>("/dashboard") })

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Platform overview"
        description="Live health of users, revenue, AI consumption and processing."
        actions={
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={q.isFetching ? "animate-spin" : undefined} /> Refresh
          </Button>
        }
      />
      {q.isPending ? (
        <div className="space-y-4">
          <KpiSkeleton count={12} />
          <div className="grid gap-4 lg:grid-cols-2">
            <CardSkeleton rows={6} />
            <CardSkeleton rows={6} />
          </div>
        </div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <DashboardBody data={q.data} />
      )}
    </>
  )
}

function DashboardBody({ data }: { data: DashboardData }) {
  const can = useCan()
  const m = data.metrics
  const c = data.charts
  const signups = c.user_growth.map((r) => r.signups)
  const totals = c.user_growth.map((r) => r.total)
  const rev = c.revenue.map((r) => r.revenue_cents)
  const tokens = c.ai_usage.map((r) => r.tokens)
  const costs = c.ai_usage.map((r) => r.cost_usd)
  const reviews = c.review_volume.map((r) => r.reviews)
  const signupDelta = pctChange(signups)
  const revDelta = pctChange(rev)

  return (
    <div className="space-y-4">
      <KpiGrid className="xl:grid-cols-4 2xl:grid-cols-6">
        <KpiTile label="Total users" value={formatNumber(m.total_users)} icon={Users} spark={totals} hint={`${formatNumber(m.active_users)} active (30d)`} />
        <KpiTile
          label="New registrations (30d)"
          value={formatNumber(m.new_registrations)}
          icon={UserPlus}
          tone="violet"
          spark={signups}
          hint={signupDelta === null ? "vs previous month" : `${signupDelta >= 0 ? "+" : ""}${signupDelta.toFixed(1)}% MoM signups`}
        />
        <KpiTile label="Workspaces" value={formatNumber(m.total_workspaces)} icon={Package} tone="sky" hint="Excludes demo workspaces" />
        <KpiTile label="Active subscriptions" value={formatNumber(m.active_subscriptions)} icon={CreditCard} tone="emerald" hint="Paid: active, trialing, past due" />
        <KpiTile
          label="MRR"
          value={formatCurrency(m.mrr_cents)}
          icon={DollarSign}
          tone="emerald"
          spark={rev}
          hint={revDelta === null ? `ARR ${formatCurrency(m.arr_cents)}` : `ARR ${formatCurrency(m.arr_cents)} · ${revDelta >= 0 ? "+" : ""}${revDelta.toFixed(1)}% rev MoM`}
        />
        <KpiTile label="Churn (30d)" value={`${m.churn_rate.toFixed(1)}%`} icon={TrendingDown} tone={m.churn_rate > 5 ? "rose" : "amber"} spark={c.churn.map((r) => r.cancellations)} />
        <KpiTile label="Trial conversion" value={`${m.trial_conversion_rate.toFixed(1)}%`} icon={Percent} tone="violet" />
        <KpiTile label="Active users (30d)" value={formatNumber(m.active_users)} icon={Activity} tone="sky" hint={m.total_users ? `${Math.round((100 * m.active_users) / m.total_users)}% of all users` : undefined} />
        <KpiTile label="AI tokens (30d)" value={formatCompact(m.ai_tokens_30d)} icon={BotMessageSquare} spark={tokens} />
        <KpiTile label="AI cost (30d)" value={formatUsd(m.ai_cost_30d)} icon={DollarSign} tone="amber" spark={costs} />
        <KpiTile label="Reviews processed" value={formatCompact(m.reviews_processed)} icon={Star} tone="violet" spark={reviews} hint="All-time analyzed" />
        <KpiTile
          label="Failed jobs (7d)"
          value={formatNumber(m.failed_jobs_7d)}
          icon={AlertTriangle}
          tone={m.failed_jobs_7d > 0 ? "rose" : "emerald"}
          hint={can("jobs.read") ? <Link href="/admin/jobs" className="text-indigo-300 hover:underline">View jobs →</Link> : "Analysis, import & report jobs"}
        />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="User growth" description="Monthly signups and cumulative users (12 months)" className="xl:col-span-2">
          <TrendChart
            data={c.user_growth}
            xKey="month"
            series={[
              { key: "total", label: "Total users" },
              { key: "signups", label: "Signups" },
            ]}
          />
        </Panel>
        <Panel title="Plan distribution" description="Workspaces by plan">
          <DonutChart data={c.plan_distribution.map((r) => ({ name: r.plan, value: r.count }))} format={formatNumber} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Revenue" description="Net collected revenue by month" className="xl:col-span-2">
          <BarsChart data={c.revenue} xKey="month" series={[{ key: "revenue_cents", label: "Net revenue", color: "#34d399" }]} format={(n) => formatCurrency(n)} />
        </Panel>
        <Panel title="Subscription status" description="All subscriptions">
          <DonutChart data={c.subscription_status.map((r) => ({ name: r.status, value: r.count }))} format={formatNumber} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="AI usage" description="Tokens per day (30 days)">
          <TrendChart data={c.ai_usage} xKey="date" series={[{ key: "tokens", label: "Tokens", color: "#a78bfa" }]} height={220} />
        </Panel>
        <Panel title="Review volume" description="Reviews analyzed per day (30 days)">
          <BarsChart data={c.review_volume} xKey="date" series={[{ key: "reviews", label: "Reviews", color: "#38bdf8" }]} height={220} />
        </Panel>
        <Panel title="Churn" description="Cancellations per month">
          <BarsChart data={c.churn} xKey="month" series={[{ key: "cancellations", label: "Cancellations", color: "#fb7185" }]} format={formatNumber} height={220} />
        </Panel>
        <Panel title="Signup → onboarding conversion" description="Signups vs completed onboarding (6 months)">
          <BarsChart
            data={c.signup_conversion}
            xKey="month"
            series={[
              { key: "signups", label: "Signups" },
              { key: "onboarded", label: "Onboarded", color: "#34d399" },
            ]}
            format={formatNumber}
            height={220}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent admin activity" actions={can("audit.read") && <Link href="/admin/audit-logs" className="text-xs text-indigo-300 hover:underline">Audit logs →</Link>} bodyClassName="p-0">
          {data.recent_admin_activity.length === 0 ? (
            <div className="p-4"><EmptyState title="No admin activity yet" className="py-8" /></div>
          ) : (
            <ul className="divide-y">
              {data.recent_admin_activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{titleCase(a.action.replace(/\./g, " "))}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.admin_email || "system"}
                      {a.target_type && ` · ${a.target_type}`}
                      {a.target_id && <span className="font-mono"> {a.target_id.slice(0, 8)}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent signups" actions={can("users.read") && <Link href="/admin/users" className="text-xs text-indigo-300 hover:underline">All users →</Link>} bodyClassName="p-0">
          {data.recent_signups.length === 0 ? (
            <div className="p-4"><EmptyState title="No signups yet" className="py-8" /></div>
          ) : (
            <ul className="divide-y">
              {data.recent_signups.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/users/${u.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-white/[0.03]">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{u.full_name || u.email}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(u.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
