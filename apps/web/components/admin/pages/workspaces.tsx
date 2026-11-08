"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowLeft, Package, PauseCircle, PlayCircle } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAdminMutation, useCan, useDebounced, usePaging } from "@/hooks/use-admin"
import { adminApi, formatDateTime } from "@/lib/admin-api"
import { LIMIT_FIELDS, type AdminWorkspaceDetail, type AdminWorkspaceRow, type Paged } from "@/lib/admin-types"
import { formatCompact, formatDate, formatNumber, titleCase } from "@/lib/utils"
import { FilterBar, FilterSelect, KpiGrid, KpiTile, KV, Meter, PageHeader, Pager, Panel, ReasonDialog, SearchBox, TableCard, TableRowsSkeleton } from "../ui"
import { PLAN_OPTIONS } from "./shared"

export function AdminWorkspaces() {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [plan, setPlan] = useState("")
  const [demo, setDemo] = useState(false)
  const { page, pageSize, setPage, setPageSize } = usePaging()
  const search = useDebounced(q)
  const query = useQuery({
    queryKey: ["admin", "workspaces", { search, status, plan, demo, page, pageSize }],
    queryFn: () =>
      adminApi<Paged<AdminWorkspaceRow>>("/workspaces", {
        query: { q: search, status, plan, include_demo: demo || undefined, page, page_size: pageSize },
      }),
    placeholderData: keepPreviousData,
  })
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(1)
  }

  return (
    <>
      <PageHeader eyebrow="Customers" title="Workspaces" description="Tenants, their owners, plans and usage." />
      <FilterBar>
        <SearchBox value={q} onChange={reset(setQ)} placeholder="Search name or owner email…" />
        <FilterSelect label="Status" value={status} onChange={reset(setStatus)} options={["active", "suspended"].map((s) => ({ value: s, label: titleCase(s) }))} />
        <FilterSelect label="Plan" value={plan} onChange={reset(setPlan)} options={PLAN_OPTIONS} />
        <div className="flex items-center gap-2 pl-1">
          <Switch id="ws-demo" checked={demo} onCheckedChange={reset(setDemo)} size="sm" />
          <Label htmlFor="ws-demo" className="text-xs font-normal text-muted-foreground">Include demo</Label>
        </div>
      </FilterBar>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <TableCard footer={query.data && <Pager page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} onPageSize={setPageSize} fetching={query.isFetching} />}>
          {query.isPending ? (
            <TableRowsSkeleton cols={6} />
          ) : query.data.items.length === 0 ? (
            <div className="p-4"><EmptyState icon={Package} title="No workspaces match" className="border-0" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Projects</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((w) => (
                  <TableRow key={w.id} className="hover:bg-white/[0.03]">
                    <TableCell className="max-w-[240px]">
                      <Link href={`/admin/workspaces/${w.id}`} className="block truncate font-medium text-white hover:text-indigo-300">{w.name}</Link>
                      <div className="truncate text-xs text-muted-foreground">
                        {[w.industry, w.country].filter(Boolean).join(" · ") || w.slug}
                        {w.is_demo && " · demo"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{w.owner_email}</TableCell>
                    <TableCell>
                      <Pill color={w.plan === "free" ? "gray" : "indigo"}>{titleCase(w.plan)}</Pill>
                      {w.subscription_status && w.subscription_status !== "active" && <StatusBadge status={w.subscription_status} className="ml-1" />}
                    </TableCell>
                    <TableCell><StatusBadge status={w.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(w.projects)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(w.members)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCompact(w.reviews)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(w.created_at)}</TableCell>
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

const USAGE_LIMIT: Record<string, keyof AdminWorkspaceDetail["entitlements"]["limits"] | null> = {
  reviews_analyzed: "max_reviews_per_month",
  reports_generated: "max_reports_per_month",
  ai_tokens: null,
}

export function AdminWorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const can = useCan()
  const [action, setAction] = useState<"suspend" | "restore" | null>(null)
  const key = ["admin", "workspace", id]
  const q = useQuery({ queryKey: key, queryFn: () => adminApi<AdminWorkspaceDetail>(`/workspaces/${id}`) })
  const act = useAdminMutation<{ action: "suspend" | "restore"; reason: string }>({
    fn: ({ action: a, reason }) => adminApi(`/workspaces/${id}/${a}`, { method: "POST", body: { reason: reason || null } }),
    success: (_d, v) => (v.action === "suspend" ? "Workspace suspended" : "Workspace restored"),
    invalidate: [key, ["admin", "workspaces"]],
  })

  if (q.isPending) return <div className="space-y-4"><CardSkeleton rows={2} /><CardSkeleton rows={8} /></div>
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const w = q.data
  const ent = w.entitlements
  const overrides = w.subscription?.limit_overrides || {}

  return (
    <>
      <Link href="/admin/workspaces" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Workspaces
      </Link>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2">{w.name} <StatusBadge status={w.status} />{w.is_demo && <Pill color="amber">Demo</Pill>}</span>}
        description={
          <>
            {w.owner ? (
              <>Owned by <Link className="text-indigo-300 hover:underline" href={`/admin/users/${w.owner.id}`}>{w.owner.email}</Link></>
            ) : "No owner"}
            {" · "}created {formatDate(w.created_at)}
          </>
        }
        actions={
          can("workspaces.manage") &&
          (w.status === "active" ? (
            <Button variant="outline" size="sm" onClick={() => setAction("suspend")}><PauseCircle /> Suspend</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAction("restore")}><PlayCircle /> Restore</Button>
          ))
        }
      />

      <KpiGrid className="mb-4">
        <KpiTile label="Plan" value={ent.plan_name} hint={titleCase(ent.status)} />
        <KpiTile label="Projects" value={formatNumber(w.projects.length)} tone="sky" hint={`Limit ${ent.limits.max_projects ?? "unlimited"}`} />
        <KpiTile label="Members" value={formatNumber(w.members.length)} tone="violet" hint={`Limit ${ent.limits.max_members ?? "unlimited"}`} />
        <KpiTile label="AI tokens (this month)" value={formatCompact(w.usage.ai_tokens)} tone="amber" />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Usage this period">
            <div className="grid gap-4 sm:grid-cols-3">
              {Object.entries(w.usage).map(([metric, value]) => {
                const limitKey = USAGE_LIMIT[metric]
                return (
                  <div key={metric}>
                    <div className="mb-1.5 text-xs font-medium text-foreground/90">{titleCase(metric)}</div>
                    {limitKey ? <Meter value={value} max={ent.limits[limitKey]} /> : <div className="text-lg font-semibold text-white tabular-nums">{formatCompact(value)}</div>}
                  </div>
                )
              })}
            </div>
          </Panel>
          <Panel title="Projects" bodyClassName="p-0">
            {w.projects.length === 0 ? (
              <div className="p-4"><EmptyState title="No projects" className="border-0 py-8" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last analyzed</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {w.projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-white">{p.name}{p.is_demo && <Pill color="amber" className="ml-2">Demo</Pill>}</TableCell>
                      <TableCell className="text-xs">{titleCase(p.data_source) || "—"}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(p.last_analyzed_at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
          <Panel title="Members" bodyClassName="p-0">
            {w.members.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">No members.</div>
            ) : (
              <ul className="divide-y">
                {w.members.map((m) => (
                  <li key={m.email} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="truncate">{m.email}</span>
                    <Pill color={m.role === "owner" ? "violet" : "gray"}>{titleCase(m.role)}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Subscription">
            {w.subscription ? (
              <KV
                className="sm:grid-cols-1"
                items={[
                  ["Status", <StatusBadge key="s" status={w.subscription.status} />],
                  ["Stripe customer", w.subscription.stripe_customer_id ? <span key="c" className="font-mono text-[11px]">{w.subscription.stripe_customer_id}</span> : "Manual / none"],
                  ["Period ends", formatDateTime(w.subscription.current_period_end)],
                  ["Trial ends", formatDateTime(w.subscription.trial_ends_at)],
                  ["Cancels at period end", w.subscription.cancel_at_period_end ? "Yes" : "No"],
                ]}
              />
            ) : (
              <p className="text-xs text-muted-foreground">No subscription record — the workspace is on the free plan.</p>
            )}
            {can("subscriptions.read") && (
              <Link href="/admin/subscriptions" className="mt-3 inline-block text-xs text-indigo-300 hover:underline">Manage in Subscriptions →</Link>
            )}
          </Panel>
          <Panel title="Entitlements" description="Effective limits (plan + overrides)">
            <ul className="space-y-1.5 text-sm">
              {LIMIT_FIELDS.map((f) => (
                <li key={f} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{titleCase(f.replace(/^max_/, ""))}</span>
                  <span className="tabular-nums">
                    {ent.limits[f] === null ? "Unlimited" : formatNumber(ent.limits[f])}
                    {f in overrides && <Pill color="amber" className="ml-1.5">override</Pill>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-1">
              {ent.features.map((f) => <Pill key={f} color="indigo">{titleCase(f)}</Pill>)}
            </div>
          </Panel>
          <Panel title="Details">
            <KV
              className="sm:grid-cols-1"
              items={[
                ["ID", <span key="id" className="font-mono text-[11px]">{w.id}</span>],
                ["Slug", w.slug],
                ["Business type", titleCase(w.business_type) || "—"],
                ["Industry", w.industry || "—"],
                ["Location", [w.city, w.country].filter(Boolean).join(", ") || "—"],
                ["Website", w.website || "—"],
                ["Company size", w.company_size || "—"],
                ["Data retention", w.data_retention_days ? `${w.data_retention_days} days` : "—"],
              ]}
            />
          </Panel>
        </div>
      </div>

      {action && (
        <ReasonDialog
          open={!!action}
          onOpenChange={(o) => !o && setAction(null)}
          title={action === "suspend" ? "Suspend workspace" : "Restore workspace"}
          description={action === "suspend" ? "All members lose access to this workspace until it is restored." : "Members regain access immediately."}
          confirmLabel={action === "suspend" ? "Suspend" : "Restore"}
          destructive={action === "suspend"}
          reasonRequired={action === "suspend"}
          pending={act.isPending}
          onConfirm={(reason) => act.mutateAsync({ action, reason })}
        />
      )}
    </>
  )
}
