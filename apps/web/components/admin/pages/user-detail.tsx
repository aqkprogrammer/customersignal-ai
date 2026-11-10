"use client"

import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Ban, Bell, LogOut, MoreHorizontal, PauseCircle, PlayCircle, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAdminMe, useAdminMutation, useCan } from "@/hooks/use-admin"
import { adminApi, formatDateTime, formatUsd } from "@/lib/admin-api"
import type { AdminUserDetail } from "@/lib/admin-types"
import { formatCompact, formatDate, formatNumber, timeAgo, titleCase } from "@/lib/utils"
import { BoolDot, KpiGrid, KpiTile, KV, PageHeader, Panel, ReasonDialog } from "../ui"
import { NotifyDialog, type NotifyValues } from "./shared"

type Action = "suspend" | "reactivate" | "ban" | "revoke-sessions" | "delete"

const ACTION_COPY: Record<Action, { title: string; description: string; confirm: string; destructive: boolean; reasonRequired: boolean; success: string }> = {
  suspend: {
    title: "Suspend user",
    description: "The user is signed out everywhere and can't sign in until reactivated.",
    confirm: "Suspend",
    destructive: true,
    reasonRequired: true,
    success: "User suspended",
  },
  reactivate: {
    title: "Reactivate user",
    description: "Restores the user's access. Their status reason is cleared.",
    confirm: "Reactivate",
    destructive: false,
    reasonRequired: false,
    success: "User reactivated",
  },
  ban: {
    title: "Ban user",
    description: "Permanently blocks this account and revokes all sessions. Only super-admins can ban.",
    confirm: "Ban user",
    destructive: true,
    reasonRequired: true,
    success: "User banned",
  },
  "revoke-sessions": {
    title: "Revoke all sessions",
    description: "Signs the user out on every device. They can sign in again immediately.",
    confirm: "Revoke sessions",
    destructive: true,
    reasonRequired: true,
    success: "All sessions revoked",
  },
  delete: {
    title: "Delete user",
    description: "Soft-deletes and anonymizes the account (email, name, credentials). Billing and audit records are retained. This cannot be undone.",
    confirm: "Delete user",
    destructive: true,
    reasonRequired: true,
    success: "User deleted and anonymized",
  },
}

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const can = useCan()
  const me = useAdminMe()
  const isSuper = me.data?.role === "super_admin"
  const [action, setAction] = useState<Action | null>(null)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const key = ["admin", "user", id]

  const q = useQuery({ queryKey: key, queryFn: () => adminApi<AdminUserDetail>(`/users/${id}`) })

  const act = useAdminMutation<{ action: Action; reason: string }>({
    fn: ({ action: a, reason }) =>
      a === "delete"
        ? adminApi(`/users/${id}`, { method: "DELETE", body: { reason } })
        : adminApi(`/users/${id}/${a}`, { method: "POST", body: { reason: reason || null } }),
    success: (_d, v) => ACTION_COPY[v.action].success,
    invalidate: [key, ["admin", "users"]],
    onSuccess: (_d, v) => {
      if (v.action === "delete") router.push("/admin/users")
    },
  })

  const notify = useAdminMutation<NotifyValues>({
    fn: (body) => adminApi(`/users/${id}/notify`, { method: "POST", body }),
    success: "Notification sent",
  })

  if (q.isPending) {
    return (
      <div className="space-y-4">
        <CardSkeleton rows={2} />
        <div className="grid gap-4 lg:grid-cols-3">
          <CardSkeleton rows={6} className="lg:col-span-2" />
          <CardSkeleton rows={6} />
        </div>
      </div>
    )
  }
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const u = q.data
  const deleted = !!u.deleted_at
  const manage = can("users.manage") && !deleted
  const copy = action ? ACTION_COPY[action] : null

  return (
    <>
      <Link href="/admin/users" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Users
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {u.full_name || u.email} <StatusBadge status={deleted ? "deleted" : u.status} />
          </span>
        }
        description={
          <>
            {u.email}
            {u.company_name && ` · ${u.company_name}`} · joined {formatDate(u.created_at)}
          </>
        }
        actions={
          <>
            {can("users.notify") && !deleted && (
              <Button variant="outline" size="sm" onClick={() => setNotifyOpen(true)}>
                <Bell /> Notify
              </Button>
            )}
            {manage &&
              (u.status === "active" ? (
                <Button variant="outline" size="sm" onClick={() => setAction("suspend")}>
                  <PauseCircle /> Suspend
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setAction("reactivate")}>
                  <PlayCircle /> Reactivate
                </Button>
              ))}
            {(manage || (can("users.delete") && !deleted)) && (
              // Non-modal so opening a confirmation dialog from a menu item doesn't leave the page inert.
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon-sm" aria-label="More actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {manage && (
                    <DropdownMenuItem onSelect={() => setAction("revoke-sessions")}>
                      <LogOut /> Revoke all sessions
                    </DropdownMenuItem>
                  )}
                  {manage && isSuper && u.status !== "banned" && (
                    <DropdownMenuItem variant="destructive" onSelect={() => setAction("ban")}>
                      <Ban /> Ban user
                    </DropdownMenuItem>
                  )}
                  {can("users.delete") && !deleted && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setAction("delete")}>
                        <Trash2 /> Delete user
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {u.status_reason && (
        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <span className="font-medium">Status reason:</span> {u.status_reason}
        </div>
      )}

      <KpiGrid className="mb-4">
        <KpiTile label="Workspaces" value={formatNumber(u.workspaces.length)} />
        <KpiTile label="AI tokens (all-time)" value={formatCompact(u.usage.ai_tokens)} tone="ice" />
        <KpiTile label="AI cost (all-time)" value={formatUsd(u.usage.ai_cost_usd)} tone="amber" />
        <KpiTile label="Last active" value={timeAgo(u.last_active_at)} tone="sky" hint={`Last login ${timeAgo(u.last_login_at)}`} />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Workspace memberships" bodyClassName="p-0">
            {u.workspaces.length === 0 ? (
              <div className="p-4"><EmptyState title="No workspaces" className="border-0 py-8" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Reviews this month</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {u.workspaces.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <Link href={`/admin/workspaces/${w.id}`} className="font-medium text-white hover:text-signal-300">{w.name}</Link>
                        {w.is_demo && <Pill color="amber" className="ml-2">Demo</Pill>}
                      </TableCell>
                      <TableCell className="text-xs">{titleCase(w.role)}</TableCell>
                      <TableCell><Pill color={w.plan === "free" ? "gray" : "signal"}>{titleCase(w.plan)}</Pill></TableCell>
                      <TableCell><StatusBadge status={w.status} /></TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(w.reviews_this_month)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>

          <Panel title="Recent activity" description="Last 25 actions by this user" bodyClassName="p-0">
            {u.activity.length === 0 ? (
              <div className="p-4"><EmptyState title="No activity recorded" className="border-0 py-8" /></div>
            ) : (
              <ul className="divide-y">
                {u.activity.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-signal-200">{a.action}</div>
                      {a.summary && <div className="truncate text-xs text-muted-foreground">{a.summary}</div>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground" title={formatDateTime(a.created_at)}>{timeAgo(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Profile">
            <KV
              className="sm:grid-cols-1"
              items={[
                ["User ID", <span key="id" className="font-mono text-[11px]">{u.id}</span>],
                ["Email verified", <BoolDot key="v" value={u.email_verified} />],
                ["Google linked", <BoolDot key="g" value={u.google_linked} />],
                ["Onboarding", <BoolDot key="o" value={u.onboarding_completed} on="Completed" off="Incomplete" />],
                ["Created", formatDateTime(u.created_at)],
                ["Last login", formatDateTime(u.last_login_at)],
                ["Last active", formatDateTime(u.last_active_at)],
                ...(deleted ? ([["Deleted", formatDateTime(u.deleted_at)]] as [string, string][]) : []),
              ]}
            />
          </Panel>
          <Panel title="Sessions" description="10 most recent" bodyClassName="p-0">
            {u.sessions.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">No sessions.</div>
            ) : (
              <ul className="divide-y">
                {u.sessions.map((s, i) => (
                  <li key={i} className="space-y-0.5 px-4 py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-foreground">{s.ip_address || "unknown IP"}</span>
                      {s.revoked ? <Pill color="gray">Revoked</Pill> : <Pill color="green">Active</Pill>}
                    </div>
                    <div className="truncate text-muted-foreground" title={s.user_agent || undefined}>{s.user_agent || "—"}</div>
                    <div className="text-muted-foreground">{formatDateTime(s.created_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {copy && action && (
        <ReasonDialog
          open={!!action}
          onOpenChange={(o) => !o && setAction(null)}
          title={copy.title}
          description={copy.description}
          confirmLabel={copy.confirm}
          destructive={copy.destructive}
          reasonRequired={copy.reasonRequired}
          confirmText={action === "delete" ? "DELETE" : undefined}
          pending={act.isPending}
          onConfirm={(reason) => act.mutateAsync({ action, reason })}
        />
      )}
      <NotifyDialog open={notifyOpen} onOpenChange={setNotifyOpen} recipient={u.email} pending={notify.isPending} onSend={(v) => notify.mutateAsync(v)} />
    </>
  )
}
