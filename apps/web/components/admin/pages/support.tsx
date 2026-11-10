"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowLeft, Clock, LifeBuoy, Loader2, Lock, MessageSquare, Send, Timer } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { Pill, StatusBadge, type Tone } from "@/components/shared/badges"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAdminMe, useAdminMutation, useCan, useDebounced, usePaging } from "@/hooks/use-admin"
import { adminApi, formatDateTime } from "@/lib/admin-api"
import { TICKET_PRIORITIES, TICKET_STATUSES, type TicketDetail, type TicketsResponse } from "@/lib/admin-types"
import { cn, formatNumber, timeAgo, titleCase } from "@/lib/utils"
import { Field, FilterBar, KpiGrid, KpiTile, KV, PageHeader, Pager, Panel, SearchBox, TableCard, TableRowsSkeleton } from "../ui"

const PRIORITY_TONE: Record<string, Tone> = { low: "gray", normal: "sky", high: "amber", urgent: "red" }

function hours(h: number | null | undefined) {
  if (h === null || h === undefined) return "—"
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 48) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

export function AdminSupport() {
  const [status, setStatus] = useState("")
  const [mine, setMine] = useState(false)
  const [q, setQ] = useState("")
  const search = useDebounced(q)
  const { page, pageSize, setPage, setPageSize } = usePaging()
  const query = useQuery({
    queryKey: ["admin", "support", { status, mine, search, page, pageSize }],
    queryFn: () => adminApi<TicketsResponse>("/support", { query: { status, assigned_to_me: mine || undefined, q: search, page, page_size: pageSize } }),
    placeholderData: keepPreviousData,
  })
  const counts = query.data?.counts || {}
  const total = Object.values(counts).reduce((s, n) => s + n, 0)

  return (
    <>
      <PageHeader eyebrow="Engagement" title="Support tickets" description="Customer conversations from the app and the public contact form." />
      <KpiGrid className="mb-4">
        <KpiTile label="Open" value={formatNumber(counts.open || 0)} icon={LifeBuoy} tone="amber" />
        <KpiTile label="In progress" value={formatNumber(counts.in_progress || 0)} icon={MessageSquare} />
        <KpiTile label="Avg first response (90d)" value={hours(query.data?.avg_first_response_hours)} icon={Timer} tone="sky" />
        <KpiTile label="Avg resolution (90d)" value={hours(query.data?.avg_resolution_hours)} icon={Clock} tone="emerald" />
      </KpiGrid>
      <Tabs value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1) }}>
        <TabsList className="mb-3 h-auto flex-wrap">
          <TabsTrigger value="all">All <span className="ml-1 text-muted-foreground tabular-nums">{total}</span></TabsTrigger>
          {TICKET_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {titleCase(s)} <span className="ml-1 text-muted-foreground tabular-nums">{counts[s] || 0}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <FilterBar>
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search subject or email…" />
        <div className="flex items-center gap-2 pl-1">
          <Switch id="mine" size="sm" checked={mine} onCheckedChange={(v) => { setMine(v); setPage(1) }} />
          <Label htmlFor="mine" className="text-xs font-normal text-muted-foreground">Assigned to me</Label>
        </div>
      </FilterBar>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <TableCard footer={query.data && <Pager page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} onPageSize={setPageSize} fetching={query.isFetching} />}>
          {query.isPending ? (
            <TableRowsSkeleton cols={6} />
          ) : query.data.items.length === 0 ? (
            <div className="p-4"><EmptyState icon={LifeBuoy} title="No tickets here" description="Nothing matches this view." className="border-0" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((t) => (
                  <TableRow key={t.id} className="hover:bg-surface-hover">
                    <TableCell className="max-w-[320px]">
                      <Link href={`/admin/support/${t.id}`} className="block min-w-0">
                        <div className="truncate font-medium text-foreground hover:text-signal-600">{t.subject}</div>
                        <div className="truncate text-xs text-muted-foreground">{t.email} · {t.source === "contact_form" ? "Contact form" : "In-app"}</div>
                      </Link>
                    </TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell><Pill color={PRIORITY_TONE[t.priority] || "gray"}>{titleCase(t.priority)}</Pill></TableCell>
                    <TableCell className="text-xs">{titleCase(t.category)}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs">{t.assigned_to || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground" title={formatDateTime(t.updated_at || t.created_at)}>{timeAgo(t.updated_at || t.created_at)}</TableCell>
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

const UNASSIGNED = "__none__"

export function AdminTicketDetail() {
  const { id } = useParams<{ id: string }>()
  const can = useCan()
  const me = useAdminMe()
  const key = ["admin", "ticket", id]
  const q = useQuery({ queryKey: key, queryFn: () => adminApi<TicketDetail>(`/support/${id}`) })
  const [body, setBody] = useState("")
  const [internal, setInternal] = useState(false)

  const update = useAdminMutation<Record<string, unknown>>({
    fn: (patch) => adminApi(`/support/${id}`, { method: "PATCH", body: patch }),
    success: "Ticket updated",
    invalidate: [key, ["admin", "support"]],
  })
  const send = useAdminMutation<{ body: string; internal: boolean }>({
    fn: (payload) => adminApi(`/support/${id}/messages`, { method: "POST", body: payload }),
    success: (_d, v) => (v.internal ? "Internal note added" : "Reply sent to customer"),
    invalidate: [key, ["admin", "support"]],
    onSuccess: () => setBody(""),
  })

  if (q.isPending) return <div className="grid gap-4 lg:grid-cols-3"><CardSkeleton rows={10} className="lg:col-span-2" /><CardSkeleton rows={6} /></div>
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const t = q.data
  const manage = can("support.manage")
  const myId = me.data?.id

  return (
    <>
      <Link href="/admin/support" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Support tickets
      </Link>
      <PageHeader
        title={t.subject}
        description={<span className="flex flex-wrap items-center gap-2">{t.email} <StatusBadge status={t.status} /> <Pill color={PRIORITY_TONE[t.priority] || "gray"}>{titleCase(t.priority)}</Pill></span>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Conversation" bodyClassName="p-0">
            {t.messages.length === 0 ? (
              <div className="p-4"><EmptyState icon={MessageSquare} title="No messages yet" className="border-0 py-8" /></div>
            ) : (
              <ol className="space-y-3 p-4">
                {t.messages.map((m) => {
                  const admin = m.author_type === "admin"
                  return (
                    <li key={m.id} className={cn("flex", admin ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-xl border px-3.5 py-2.5 text-sm",
                          m.internal
                            ? "border-amber-400/25 bg-amber-500/10"
                            : admin
                              ? "border-signal-400/25 bg-signal-500/15"
                              : "bg-muted",
                        )}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {m.internal && <span className="inline-flex items-center gap-1 font-medium text-amber-700"><Lock className="size-3" /> Internal note</span>}
                          <span className="font-medium text-foreground/90">{admin ? m.admin_email || "Admin" : t.email}</span>
                          <span title={formatDateTime(m.created_at)}>{timeAgo(m.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </Panel>
          {manage && (
            <Panel title={internal ? "Add internal note" : "Reply to customer"} description={internal ? "Only visible to admins." : `Emailed to ${t.email} and shown in their app.`}>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (body.trim()) send.mutate({ body: body.trim(), internal })
                }}
              >
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  maxLength={10000}
                  placeholder={internal ? "Context for other admins…" : "Write your reply…"}
                  className={cn(internal && "border-amber-400/30 bg-amber-500/5")}
                  aria-label="Message"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Switch id="internal" checked={internal} onCheckedChange={setInternal} size="sm" />
                    <Label htmlFor="internal" className="text-xs font-normal">Internal note</Label>
                  </div>
                  <Button type="submit" size="sm" disabled={!body.trim() || send.isPending} variant={internal ? "secondary" : "default"}>
                    {send.isPending ? <Loader2 className="animate-spin" /> : internal ? <Lock /> : <Send />}
                    {internal ? "Save note" : "Send reply"}
                  </Button>
                </div>
              </form>
            </Panel>
          )}
        </div>
        <div className="space-y-4">
          <Panel title="Ticket">
            <div className="space-y-3">
              <Field label="Status">
                <Select value={t.status} onValueChange={(v) => update.mutate({ status: v })} disabled={!manage || update.isPending}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={t.priority} onValueChange={(v) => update.mutate({ priority: v })} disabled={!manage || update.isPending}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_PRIORITIES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Assignee">
                <Select
                  value={t.assigned_admin_id || UNASSIGNED}
                  onValueChange={(v) => update.mutate(v === UNASSIGNED ? { unassign: true } : { assigned_admin_id: v })}
                  disabled={!manage || update.isPending}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {t.admins.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.email}{a.id === myId ? " (me)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {manage && myId && t.assigned_admin_id !== myId && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => update.mutate({ assigned_admin_id: myId })} disabled={update.isPending}>
                  Assign to me
                </Button>
              )}
            </div>
          </Panel>
          <Panel title="Details">
            <KV
              className="sm:grid-cols-1"
              items={[
                ["Category", titleCase(t.category)],
                ["Source", t.source === "contact_form" ? "Contact form" : "In-app"],
                ["Created", formatDateTime(t.created_at)],
                ["First response", formatDateTime(t.first_response_at)],
                ["Resolved", formatDateTime(t.resolved_at)],
                ["User", t.user_id && can("users.read") ? <Link key="u" className="text-signal-700 hover:underline" href={`/admin/users/${t.user_id}`}>View user</Link> : t.user_id ? "Registered user" : "Guest"],
                ["Workspace", t.workspace_id && can("workspaces.read") ? <Link key="w" className="text-signal-700 hover:underline" href={`/admin/workspaces/${t.workspace_id}`}>View workspace</Link> : "—"],
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  )
}
