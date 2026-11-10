"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Bell, Eye, Loader2, Mail, Megaphone, Pencil, Plus, Save, Send, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Pill, type Tone } from "@/components/shared/badges"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAdminMutation, useCan, useDebounced, usePaging } from "@/hooks/use-admin"
import { adminApi, adminErrorMessage, formatDateTime } from "@/lib/admin-api"
import type { Announcement, EmailLogRow, EmailTemplate, Paged } from "@/lib/admin-types"
import { cn, formatNumber, timeAgo, titleCase } from "@/lib/utils"
import { ConfirmDialog, Field, PageHeader, Pager, Panel, TableCard, TableRowsSkeleton } from "../ui"

const LEVEL_TONE: Record<string, Tone> = { info: "sky", success: "green", warning: "amber", critical: "red" }

// ------------------------------------------------------------------------------------------ announcements
export function AdminAnnouncements() {
  const can = useCan()
  const manage = can("announcements.manage")
  const [editing, setEditing] = useState<Announcement | "new" | null>(null)
  const [deleting, setDeleting] = useState<Announcement | null>(null)
  const q = useQuery({ queryKey: ["admin", "announcements"], queryFn: () => adminApi<Announcement[]>("/announcements") })
  const del = useAdminMutation<string>({
    fn: (id) => adminApi(`/announcements/${id}`, { method: "DELETE" }),
    success: "Announcement deleted",
    invalidate: [["admin", "announcements"]],
  })

  return (
    <>
      <PageHeader
        eyebrow="Engagement"
        title="Announcements"
        description="Banners and broadcast notices for customers. New active announcements are delivered to the audience's notification center."
        actions={manage && <Button size="sm" onClick={() => setEditing("new")}><Plus /> New announcement</Button>}
      />
      {q.isPending ? (
        <CardSkeleton rows={6} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="Publish product updates, maintenance windows or incident notices."
          action={manage && <Button size="sm" onClick={() => setEditing("new")}><Plus /> New announcement</Button>}
        />
      ) : (
        <div className="space-y-3">
          {q.data.map((a) => (
            <div key={a.id} className="rounded-xl border bg-card/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{a.title}</h3>
                    <Pill color={LEVEL_TONE[a.level]}>{titleCase(a.level)}</Pill>
                    <Pill color="ice">Audience: {titleCase(a.audience)}</Pill>
                    {a.is_active ? <Pill color="green">Active</Pill> : <Pill>Inactive</Pill>}
                    {a.send_email && <Pill color="signal"><Mail className="size-3" /> Email</Pill>}
                  </div>
                  <p className="mt-1.5 line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">{a.body}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Created {formatDateTime(a.created_at)}
                    {(a.starts_at || a.ends_at) && <> · Window {formatDateTime(a.starts_at)} → {formatDateTime(a.ends_at)}</>}
                  </div>
                </div>
                {manage && (
                  <div className="flex gap-1">
                    <Button variant="outline" size="xs" onClick={() => setEditing(a)}><Pencil /> Edit</Button>
                    <Button variant="destructive" size="xs" onClick={() => setDeleting(a)}><Trash2 /> Delete</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          {editing && <AnnouncementForm initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete announcement?"
        description={deleting ? `"${deleting.title}" will be removed. Notifications already delivered are not recalled.` : undefined}
        confirmLabel="Delete"
        destructive
        pending={del.isPending}
        onConfirm={() => (deleting ? del.mutateAsync(deleting.id) : Promise.resolve())}
      />
    </>
  )
}

function toLocalInput(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(v: string) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function AnnouncementForm({ initial, onDone }: { initial: Announcement | null; onDone: () => void }) {
  const [title, setTitle] = useState(initial?.title || "")
  const [body, setBody] = useState(initial?.body || "")
  const [level, setLevel] = useState<Announcement["level"]>(initial?.level || "info")
  const [audience, setAudience] = useState<Announcement["audience"]>(initial?.audience || "all")
  const [active, setActive] = useState(initial?.is_active ?? true)
  const [sendEmail, setSendEmail] = useState(initial?.send_email ?? false)
  const [starts, setStarts] = useState(toLocalInput(initial?.starts_at ?? null))
  const [ends, setEnds] = useState(toLocalInput(initial?.ends_at ?? null))
  const save = useAdminMutation<Record<string, unknown>, { recipients?: number }>({
    fn: (payload) =>
      initial
        ? adminApi(`/announcements/${initial.id}`, { method: "PATCH", body: payload })
        : adminApi("/announcements", { method: "POST", body: payload }),
    success: (d) => (initial ? "Announcement updated" : `Announcement published${d.recipients ? ` to ${formatNumber(d.recipients)} users` : ""}`),
    invalidate: [["admin", "announcements"]],
    onSuccess: onDone,
  })
  const windowOk = !starts || !ends || new Date(starts) < new Date(ends)
  const valid = title.trim().length >= 2 && body.trim().length >= 2 && windowOk

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        save.mutate({
          title: title.trim(),
          body: body.trim(),
          level,
          audience,
          is_active: active,
          send_email: sendEmail,
          starts_at: fromLocalInput(starts),
          ends_at: fromLocalInput(ends),
        })
      }}
    >
      <DialogHeader>
        <DialogTitle>{initial ? "Edit announcement" : "New announcement"}</DialogTitle>
        <DialogDescription>
          {initial ? "Editing does not re-send notifications." : "If active, every user in the audience receives an in-app notification (and an email if enabled)."}
        </DialogDescription>
      </DialogHeader>
      <Field label="Title" htmlFor="a-title"><Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus /></Field>
      <Field label="Message" htmlFor="a-body"><Textarea id="a-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Level">
          <Select value={level} onValueChange={(v) => setLevel(v as Announcement["level"])}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{(["info", "success", "warning", "critical"] as const).map((l) => <SelectItem key={l} value={l}>{titleCase(l)}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Audience">
          <Select value={audience} onValueChange={(v) => setAudience(v as Announcement["audience"])}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              <SelectItem value="free">Free plan users</SelectItem>
              <SelectItem value="paid">Paid plan users</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Starts" htmlFor="a-start"><Input id="a-start" type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} /></Field>
        <Field label="Ends" htmlFor="a-end" error={windowOk ? undefined : "End must be after start."}><Input id="a-end" type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} /></Field>
      </div>
      <div className="flex flex-wrap gap-5">
        <div className="flex items-center gap-2"><Switch id="a-active" checked={active} onCheckedChange={setActive} size="sm" /><Label htmlFor="a-active" className="text-sm font-normal">Active</Label></div>
        <div className="flex items-center gap-2"><Checkbox id="a-email" checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} /><Label htmlFor="a-email" className="text-sm font-normal">Also send email</Label></div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={!valid || save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {initial ? "Save" : active ? "Publish" : "Save draft"}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---------------------------------------------------------------------------------------- email templates
export function AdminEmailTemplates() {
  const [selected, setSelected] = useState<string | null>(null)
  const q = useQuery({ queryKey: ["admin", "email-templates"], queryFn: () => adminApi<EmailTemplate[]>("/email-templates") })
  const current = q.data?.find((t) => t.key === selected) || q.data?.[0] || null

  return (
    <>
      <PageHeader eyebrow="Engagement" title="Email templates" description="Transactional email copy. Variables use {{variable}} syntax and are escaped in HTML." />
      {q.isPending ? (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]"><CardSkeleton rows={8} /><CardSkeleton rows={12} /></div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !current ? (
        <EmptyState icon={Mail} title="No templates" description="Templates are seeded by the API on first start." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Panel title="Templates" bodyClassName="p-1.5">
            <ul className="space-y-0.5">
              {q.data.map((t) => (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => setSelected(t.key)}
                    className={cn("w-full rounded-md px-2.5 py-2 text-left hover:bg-surface-hover", current.key === t.key && "bg-signal-500/15")}
                  >
                    <div className="truncate text-sm text-foreground">{t.name}</div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">{t.key} · {timeAgo(t.updated_at)}</div>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          <TemplateEditor key={`${current.key}-${current.updated_at}`} template={current} />
        </div>
      )}
    </>
  )
}

function TemplateEditor({ template }: { template: EmailTemplate }) {
  const can = useCan()
  const manage = can("email_templates.manage")
  const [subject, setSubject] = useState(template.subject)
  const [html, setHtml] = useState(template.html_body)
  const [text, setText] = useState(template.text_body)
  const [tab, setTab] = useState<"html" | "text">("html")
  const [testTo, setTestTo] = useState("")
  const draft = useDebounced({ subject, html, text }, 500)
  const canPreview = !!(draft.subject.trim() && draft.html.trim() && draft.text.trim())

  const preview = useQuery({
    queryKey: ["admin", "email-preview", template.key, draft],
    queryFn: () =>
      adminApi<{ subject: string; html: string }>(`/email-templates/${template.key}/preview`, {
        method: "POST",
        body: { subject: draft.subject, html_body: draft.html, text_body: draft.text },
      }),
    enabled: canPreview,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  })
  const save = useAdminMutation({
    fn: () => adminApi(`/email-templates/${template.key}`, { method: "PUT", body: { subject, html_body: html, text_body: text } }),
    success: "Template saved",
    invalidate: [["admin", "email-templates"]],
  })
  const [testing, setTesting] = useState(false)
  const sendTest = async () => {
    setTesting(true)
    try {
      const r = await adminApi<{ status: string; error: string | null }>(`/email-templates/${template.key}/test`, { method: "POST", body: { to: testTo.trim() } })
      if (r.status === "failed") toast.error(`Test email failed: ${r.error || "unknown error"}`)
      else if (r.status === "logged") toast.success("Test email logged (email provider not configured)")
      else toast.success(`Test email sent to ${testTo.trim()}`)
    } catch (err) {
      toast.error(adminErrorMessage(err))
    } finally {
      setTesting(false)
    }
  }
  const dirty = subject !== template.subject || html !== template.html_body || text !== template.text_body
  const valid = subject.trim() && html.trim() && text.trim()
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo.trim())

  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      <Panel
        title={template.name}
        description={<span className="font-mono">{template.key}</span>}
        actions={
          manage && (
            <Button size="sm" disabled={!dirty || !valid || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save
            </Button>
          )
        }
      >
        <div className="space-y-3">
          {template.variables.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-muted-foreground">Variables:</span>
              {template.variables.map((v) => <code key={v} className="rounded bg-signal-500/15 px-1.5 py-0.5 font-mono text-[10px] text-signal-700">{`{{${v}}}`}</code>)}
            </div>
          )}
          <Field label="Subject" htmlFor="t-subject"><Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} readOnly={!manage} maxLength={300} /></Field>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "html" | "text")}>
            <TabsList>
              <TabsTrigger value="html">HTML body</TabsTrigger>
              <TabsTrigger value="text">Plain-text body</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "html" ? (
            <Textarea aria-label="HTML body" value={html} onChange={(e) => setHtml(e.target.value)} readOnly={!manage} rows={18} className="font-mono text-xs" spellCheck={false} />
          ) : (
            <Textarea aria-label="Plain-text body" value={text} onChange={(e) => setText(e.target.value)} readOnly={!manage} rows={18} className="font-mono text-xs" />
          )}
          {manage && (
            <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end">
              <Field label="Send test to" htmlFor="t-test" className="flex-1"><Input id="t-test" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@company.com" /></Field>
              <Button variant="outline" size="sm" disabled={!emailOk || testing} onClick={sendTest} title={dirty ? "Test emails use the saved version" : undefined}>
                {testing ? <Loader2 className="animate-spin" /> : <Send />} Send test
              </Button>
            </div>
          )}
          {manage && dirty && <p className="text-[11px] text-amber-700">Unsaved changes — test emails use the last saved version.</p>}
        </div>
      </Panel>
      <Panel title={<span className="inline-flex items-center gap-1.5"><Eye className="size-3.5" /> Live preview</span>} description="Rendered with sample values; scripts are disabled." actions={preview.isFetching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}>
        {!canPreview ? (
          <p className="text-xs text-muted-foreground">Subject and both bodies are required to preview.</p>
        ) : preview.isError ? (
          <ErrorState error={preview.error} onRetry={() => preview.refetch()} />
        ) : !preview.data ? (
          <CardSkeleton rows={10} />
        ) : (
          <div className="space-y-2">
            <div className="rounded-md border bg-muted px-3 py-2 text-sm"><span className="text-xs text-muted-foreground">Subject: </span>{preview.data.subject}</div>
            <iframe title="Email preview" sandbox="" srcDoc={preview.data.html} className="h-[560px] w-full rounded-md border bg-white" />
          </div>
        )}
      </Panel>
    </div>
  )
}

// ------------------------------------------------------------------------------------------- notifications
type Audience = "all" | "free" | "paid" | "user"

export function AdminNotifications() {
  return (
    <>
      <PageHeader eyebrow="Engagement" title="Notifications" description="Send in-app notifications (and optional email) and review the outbound email log." />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <SendNotificationPanel />
        <EmailLogPanel />
      </div>
    </>
  )
}

function SendNotificationPanel() {
  const [audience, setAudience] = useState<Audience>("all")
  const [email, setEmail] = useState("")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [sendEmail, setSendEmail] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const send = useAdminMutation<Record<string, unknown>, { recipients: number }>({
    fn: (payload) => adminApi("/notifications/send", { method: "POST", body: payload }),
    success: (d) => `Sent to ${formatNumber(d.recipients)} recipient${d.recipients === 1 ? "" : "s"}`,
    invalidate: [["admin", "email-log"]],
    onSuccess: () => {
      setTitle("")
      setBody("")
    },
  })
  const emailOk = audience !== "user" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const valid = title.trim().length >= 2 && emailOk
  const payload = { title: title.trim(), body: body.trim(), audience, send_email: sendEmail, ...(audience === "user" ? { user_email: email.trim() } : {}) }
  const audienceLabel = { all: "all active users", free: "all free-plan users", paid: "all paid-plan users", user: email.trim() }[audience]

  return (
    <Panel title={<span className="inline-flex items-center gap-1.5"><Bell className="size-3.5" /> Send notification</span>}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          if (audience === "user") send.mutate(payload)
          else setConfirm(true)
        }}
      >
        <Field label="Audience">
          <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              <SelectItem value="free">Free plan users</SelectItem>
              <SelectItem value="paid">Paid plan users</SelectItem>
              <SelectItem value="user">Single user (by email)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {audience === "user" && (
          <Field label="User email" htmlFor="nf-email" error={email && !emailOk ? "Enter a valid email." : undefined}>
            <Input id="nf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@company.com" />
          </Field>
        )}
        <Field label="Title" htmlFor="nf-title"><Input id="nf-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} /></Field>
        <Field label="Message" htmlFor="nf-body"><Textarea id="nf-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} /></Field>
        <div className="flex items-center gap-2"><Checkbox id="nf-send-email" checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} /><Label htmlFor="nf-send-email" className="text-sm font-normal">Also send email</Label></div>
        <Button type="submit" className="w-full" disabled={!valid || send.isPending}>
          {send.isPending ? <Loader2 className="animate-spin" /> : <Send />} Send
        </Button>
      </form>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Send broadcast?"
        description={`"${title.trim()}" will be delivered to ${audienceLabel}${sendEmail ? " by in-app notification and email" : " as an in-app notification"}. This can't be recalled.`}
        confirmLabel="Send broadcast"
        pending={send.isPending}
        onConfirm={() => send.mutateAsync(payload)}
      />
    </Panel>
  )
}

function EmailLogPanel() {
  const { page, pageSize, setPage, setPageSize } = usePaging()
  const q = useQuery({
    queryKey: ["admin", "email-log", { page, pageSize }],
    queryFn: () => adminApi<Paged<EmailLogRow>>("/notifications", { query: { page, page_size: pageSize } }),
    placeholderData: keepPreviousData,
  })
  return (
    <Panel title="Email log" description="Every outbound email, newest first" bodyClassName="p-0">
      {q.isError ? (
        <div className="p-4"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
      ) : (
        <TableCard className="rounded-none border-0" footer={q.data && <Pager page={page} pageSize={pageSize} total={q.data.total} onPage={setPage} onPageSize={setPageSize} fetching={q.isFetching} />}>
          {q.isPending ? (
            <TableRowsSkeleton cols={4} />
          ) : q.data.items.length === 0 ? (
            <div className="p-4"><EmptyState icon={Mail} title="No emails sent yet" className="border-0 py-8" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="max-w-[200px] truncate text-xs">{e.to}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs" title={e.subject}>{e.subject}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{e.template || "—"}</TableCell>
                    <TableCell title={e.error || undefined}><Pill color={e.status === "sent" ? "green" : e.status === "failed" ? "red" : "sky"}>{titleCase(e.status)}</Pill></TableCell>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(e.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}
    </Panel>
  )
}
