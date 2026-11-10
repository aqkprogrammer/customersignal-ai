"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { AlertTriangle, CreditCard, DollarSign, ExternalLink, FileText, RotateCcw, TrendingUp, Wallet } from "lucide-react"
import { useState } from "react"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePaging } from "@/hooks/use-admin"
import { adminApi, formatDateTime } from "@/lib/admin-api"
import type { AdminInvoice, AdminPayment, Paged, RevenueData } from "@/lib/admin-types"
import { formatCurrency, formatNumber, titleCase } from "@/lib/utils"
import { BarsChart, DonutChart, TrendChart } from "../charts"
import { FilterBar, FilterSelect, KpiGrid, KpiSkeleton, KpiTile, PageHeader, Pager, Panel, TableCard, TableRowsSkeleton } from "../ui"

const money = (cents: number, currency = "usd") => formatCurrency(cents, currency)

export function AdminPayments() {
  return (
    <>
      <PageHeader eyebrow="Billing" title="Payments & invoices" description="Every charge, refund and invoice recorded from Stripe." />
      <Tabs defaultValue="payments">
        <TabsList className="mb-3">
          <TabsTrigger value="payments"><CreditCard /> Payments</TabsTrigger>
          <TabsTrigger value="invoices"><FileText /> Invoices</TabsTrigger>
        </TabsList>
        <TabsContent value="payments"><PaymentsTable /></TabsContent>
        <TabsContent value="invoices"><InvoicesTable /></TabsContent>
      </Tabs>
    </>
  )
}

function PaymentsTable() {
  const [status, setStatus] = useState("")
  const { page, pageSize, setPage, setPageSize } = usePaging()
  const q = useQuery({
    queryKey: ["admin", "payments", { status, page, pageSize }],
    queryFn: () => adminApi<Paged<AdminPayment>>("/payments", { query: { status, page, page_size: pageSize } }),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <FilterBar>
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1) }}
          options={["succeeded", "failed", "refunded", "partially_refunded"].map((s) => ({ value: s, label: titleCase(s) }))}
        />
      </FilterBar>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <TableCard footer={q.data && <Pager page={page} pageSize={pageSize} total={q.data.total} onPage={setPage} onPageSize={setPageSize} fetching={q.isFetching} />}>
          {q.isPending ? (
            <TableRowsSkeleton cols={5} />
          ) : q.data.items.length === 0 ? (
            <div className="p-4"><EmptyState icon={CreditCard} title="No payments" description="Payments appear here once Stripe webhooks record charges." className="border-0" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Refunded</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Failure reason</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-[220px] truncate font-medium text-white">{p.workspace_name}</TableCell>
                    <TableCell>{p.plan_code ? <Pill color="signal">{titleCase(p.plan_code)}</Pill> : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.amount_cents, p.currency)}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{p.refunded_cents ? money(p.refunded_cents, p.currency) : "—"}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs text-rose-300" title={p.failure_reason || undefined}>{p.failure_reason || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(p.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}
    </>
  )
}

function InvoicesTable() {
  const { page, pageSize, setPage, setPageSize } = usePaging()
  const q = useQuery({
    queryKey: ["admin", "invoices", { page, pageSize }],
    queryFn: () => adminApi<Paged<AdminInvoice>>("/invoices", { query: { page, page_size: pageSize } }),
    placeholderData: keepPreviousData,
  })
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  return (
    <TableCard footer={q.data && <Pager page={page} pageSize={pageSize} total={q.data.total} onPage={setPage} onPageSize={setPageSize} fetching={q.isFetching} />}>
      {q.isPending ? (
        <TableRowsSkeleton cols={5} />
      ) : q.data.items.length === 0 ? (
        <div className="p-4"><EmptyState icon={FileText} title="No invoices" className="border-0" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Workspace</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.items.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-xs">{i.number || i.id.slice(0, 8)}</TableCell>
                <TableCell className="max-w-[220px] truncate font-medium text-white">{i.workspace_name}</TableCell>
                <TableCell>{i.plan_code ? <Pill color="signal">{titleCase(i.plan_code)}</Pill> : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{money(i.amount_paid_cents)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(i.amount_due_cents)}</TableCell>
                <TableCell><StatusBadge status={i.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(i.created_at)}</TableCell>
                <TableCell className="text-right">
                  {i.hosted_invoice_url && (
                    <a href={i.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-signal-300 hover:underline">
                      View <ExternalLink className="size-3" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TableCard>
  )
}

export function AdminRevenue() {
  const q = useQuery({ queryKey: ["admin", "revenue"], queryFn: () => adminApi<RevenueData>("/revenue") })
  return (
    <>
      <PageHeader eyebrow="Billing" title="Revenue" description="Recurring revenue, collections, refunds and plan mix." />
      {q.isPending ? (
        <div className="space-y-4"><KpiSkeleton count={8} /><CardSkeleton rows={8} /></div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <RevenueBody r={q.data} />
      )}
    </>
  )
}

function RevenueBody({ r }: { r: RevenueData }) {
  const refundRate = r.gross_revenue_cents ? (100 * r.refunds_cents) / r.gross_revenue_cents : 0
  return (
    <div className="space-y-4">
      {!r.stripe_enabled && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <span className="font-medium">Stripe is not configured.</span> Payment and invoice figures only include manually recorded data, and MRR is
            derived from plan list prices for manual subscriptions.
          </div>
        </div>
      )}
      <KpiGrid>
        <KpiTile label="MRR" value={money(r.mrr_cents)} icon={DollarSign} tone="emerald" spark={r.trend.map((t) => t.net_cents)} />
        <KpiTile label="ARR" value={money(r.arr_cents)} icon={TrendingUp} tone="emerald" />
        <KpiTile label="Gross revenue" value={money(r.gross_revenue_cents)} icon={Wallet} hint="All-time collected" />
        <KpiTile label="Net revenue" value={money(r.net_revenue_cents)} icon={Wallet} tone="ice" hint="Gross minus refunds" />
        <KpiTile label="Refunds" value={money(r.refunds_cents)} icon={RotateCcw} tone="amber" hint={`${refundRate.toFixed(1)}% of gross`} />
        <KpiTile label="Failed payments" value={formatNumber(r.failed_payments)} icon={AlertTriangle} tone={r.failed_payments ? "rose" : "emerald"} hint={`${money(r.failed_amount_cents)} attempted`} />
      </KpiGrid>
      <Panel title="Revenue trend" description="Gross, refunds and net by month (12 months)">
        <TrendChart
          data={r.trend}
          xKey="month"
          type="line"
          format={(n) => money(n)}
          series={[
            { key: "gross_cents", label: "Gross", color: "#45e5ea" },
            { key: "net_cents", label: "Net", color: "#76f0c1" },
            { key: "refunds_cents", label: "Refunds", color: "#f2706b" },
          ]}
          height={280}
        />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Revenue by plan" description="Net collected, all-time">
          <DonutChart data={r.revenue_by_plan.map((p) => ({ name: p.plan || "unknown", value: p.revenue_cents }))} format={(n) => money(n)} />
        </Panel>
        <Panel title="MRR by plan" description="Active paid subscribers × list price">
          <BarsChart data={r.mrr_by_plan} xKey="plan" periodLabels={false} labelFormat={titleCase} series={[{ key: "mrr_cents", label: "MRR", color: "#76f0c1" }]} format={(n) => money(n)} height={200} />
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Subscribers</TableHead>
                <TableHead className="text-right">MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.mrr_by_plan.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground">No paying subscribers yet.</TableCell></TableRow>
              ) : (
                r.mrr_by_plan.map((p) => (
                  <TableRow key={p.plan}>
                    <TableCell>{titleCase(p.plan)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.subscribers)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.mrr_cents)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Panel>
      </div>
    </div>
  )
}
