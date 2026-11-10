"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronRight, Flag, Loader2, Pencil, Plus, Save, ScrollText, Server, Trash2 } from "lucide-react"
import { Fragment, useState } from "react"
import { Pill } from "@/components/shared/badges"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useAdminMutation, useCan, useDebounced, usePaging } from "@/hooks/use-admin"
import { adminApi, formatDateTime } from "@/lib/admin-api"
import type { AuditLogRow, FeatureFlag, Paged, PlatformSettings, SettingsResponse } from "@/lib/admin-types"
import { formatNumber, timeAgo, titleCase } from "@/lib/utils"
import { ConfirmDialog, Field, FilterBar, FilterSelect, JsonBlock, KV, PageHeader, Pager, Panel, SearchBox, TableCard, TableRowsSkeleton } from "../ui"
import { PLAN_CODES } from "./shared"

// ---------------------------------------------------------------------------------------------- audit logs
const TARGET_TYPES = ["user", "workspace", "subscription", "plan", "ticket", "announcement", "notification", "email_template", "feature_flag", "settings", "admin", "job"]

export function AdminAuditLogs() {
  const [action, setAction] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [target, setTarget] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const a = useDebounced(action)
  const e = useDebounced(adminEmail)
  const { page, pageSize, setPage, setPageSize } = usePaging(50)
  const q = useQuery({
    queryKey: ["admin", "audit-logs", { a, e, target, page, pageSize }],
    queryFn: () => adminApi<Paged<AuditLogRow>>("/audit-logs", { query: { action: a, admin_email: e, target_type: target, page, page_size: pageSize } }),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <PageHeader eyebrow="Platform" title="Audit logs" description="Immutable record of every admin sign-in, data access and mutation." />
      <FilterBar>
        <SearchBox value={action} onChange={(v) => { setAction(v); setPage(1) }} placeholder="Action contains… (e.g. user.)" />
        <SearchBox value={adminEmail} onChange={(v) => { setAdminEmail(v); setPage(1) }} placeholder="Admin email…" />
        <FilterSelect label="Target" value={target} onChange={(v) => { setTarget(v); setPage(1) }} options={TARGET_TYPES.map((t) => ({ value: t, label: titleCase(t) }))} />
      </FilterBar>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <TableCard footer={q.data && <Pager page={page} pageSize={pageSize} total={q.data.total} onPage={setPage} onPageSize={setPageSize} fetching={q.isFetching} />}>
          {q.isPending ? (
            <TableRowsSkeleton cols={5} rows={10} />
          ) : q.data.items.length === 0 ? (
            <div className="p-4"><EmptyState icon={ScrollText} title="No log entries match" className="border-0" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.items.map((l) => {
                  const expanded = open === l.id
                  const hasMeta = !!l.metadata && typeof l.metadata === "object" && Object.keys(l.metadata as object).length > 0
                  return (
                    <Fragment key={l.id}>
                      <TableRow className="hover:bg-surface-hover">
                        <TableCell>
                          <Button variant="ghost" size="icon-xs" onClick={() => setOpen(expanded ? null : l.id)} aria-label={expanded ? "Collapse" : "Expand"} aria-expanded={expanded}>
                            {expanded ? <ChevronDown /> : <ChevronRight />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground" title={formatDateTime(l.created_at)}>{formatDateTime(l.created_at)}</TableCell>
                        <TableCell>
                          <span className={l.action.includes("failed") ? "font-mono text-xs text-rose-700" : "font-mono text-xs text-signal-700"}>{l.action}</span>
                          {hasMeta && <span className="ml-1.5 text-[10px] text-muted-foreground">+meta</span>}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">{l.admin_email || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {l.target_type ? <><Pill>{l.target_type}</Pill> <span className="font-mono text-[10px] text-muted-foreground">{l.target_id?.slice(0, 12)}</span></> : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">{l.ip_address || "—"}</TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="bg-muted hover:bg-muted">
                          <TableCell colSpan={6} className="whitespace-normal">
                            <div className="grid gap-3 py-2 lg:grid-cols-[280px_1fr]">
                              <KV
                                className="sm:grid-cols-1"
                                items={[
                                  ["Log ID", <span key="i" className="font-mono text-[10px]">{l.id}</span>],
                                  ["Admin ID", <span key="a" className="font-mono text-[10px]">{l.admin_id || "—"}</span>],
                                  ["Target ID", <span key="t" className="font-mono text-[10px]">{l.target_id || "—"}</span>],
                                  ["User agent", <span key="u" className="text-[11px]" title={l.user_agent || undefined}>{l.user_agent || "—"}</span>],
                                ]}
                              />
                              <JsonBlock value={l.metadata ?? {}} />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}
    </>
  )
}

// ------------------------------------------------------------------------------------------- feature flags
export function AdminFeatureFlags() {
  const can = useCan()
  const manage = can("flags.manage")
  const [editing, setEditing] = useState<FeatureFlag | "new" | null>(null)
  const [deleting, setDeleting] = useState<FeatureFlag | null>(null)
  const q = useQuery({ queryKey: ["admin", "flags"], queryFn: () => adminApi<FeatureFlag[]>("/feature-flags") })
  const upsert = useAdminMutation<Omit<FeatureFlag, "id" | "updated_at">>({
    fn: (body) => adminApi("/feature-flags", { method: "PUT", body }),
    success: (_d, v) => `${v.key} ${v.enabled ? "enabled" : "disabled"}`,
    invalidate: [["admin", "flags"]],
  })
  const del = useAdminMutation<string>({
    fn: (key) => adminApi(`/feature-flags/${encodeURIComponent(key)}`, { method: "DELETE" }),
    success: "Flag deleted",
    invalidate: [["admin", "flags"]],
  })

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Feature flags"
        description="Gradual rollouts by plan or workspace. A flag that's off is off everywhere; when on, plan/workspace targeting narrows it (empty = everyone)."
        actions={manage && <Button size="sm" onClick={() => setEditing("new")}><Plus /> New flag</Button>}
      />
      {q.isPending ? (
        <CardSkeleton rows={6} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState icon={Flag} title="No feature flags" action={manage && <Button size="sm" onClick={() => setEditing("new")}><Plus /> New flag</Button>} />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flag</TableHead>
                <TableHead>Plans</TableHead>
                <TableHead>Workspaces</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Enabled</TableHead>
                {manage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="max-w-[320px]">
                    <div className="font-mono text-sm text-foreground">{f.key}</div>
                    {f.description && <div className="truncate text-xs text-muted-foreground" title={f.description}>{f.description}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">{f.plan_codes.length ? f.plan_codes.map((p) => <Pill key={p} color="signal">{p}</Pill>) : <span className="text-xs text-muted-foreground">All</span>}</div>
                  </TableCell>
                  <TableCell className="text-xs">{f.workspace_ids.length ? `${formatNumber(f.workspace_ids.length)} targeted` : <span className="text-muted-foreground">All</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{timeAgo(f.updated_at)}</TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={f.enabled}
                      disabled={!manage || upsert.isPending}
                      aria-label={`Toggle ${f.key}`}
                      onCheckedChange={(enabled) => upsert.mutate({ key: f.key, description: f.description, enabled, plan_codes: f.plan_codes, workspace_ids: f.workspace_ids })}
                    />
                  </TableCell>
                  {manage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="icon-xs" onClick={() => setEditing(f)} aria-label={`Edit ${f.key}`}><Pencil /></Button>
                        <Button variant="destructive" size="icon-xs" onClick={() => setDeleting(f)} aria-label={`Delete ${f.key}`}><Trash2 /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          {editing && (
            <FlagForm
              initial={editing === "new" ? null : editing}
              existingKeys={(q.data || []).map((f) => f.key)}
              pending={upsert.isPending}
              onCancel={() => setEditing(null)}
              onSave={async (v) => {
                try {
                  await upsert.mutateAsync(v)
                  setEditing(null)
                } catch {
                  /* toast shown */
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete feature flag?"
        description={deleting ? `Code checking "${deleting.key}" will treat it as off.` : undefined}
        confirmLabel="Delete flag"
        destructive
        pending={del.isPending}
        onConfirm={() => (deleting ? del.mutateAsync(deleting.key) : Promise.resolve())}
      />
    </>
  )
}

function FlagForm({
  initial,
  existingKeys,
  pending,
  onCancel,
  onSave,
}: {
  initial: FeatureFlag | null
  existingKeys: string[]
  pending: boolean
  onCancel: () => void
  onSave: (v: Omit<FeatureFlag, "id" | "updated_at">) => void
}) {
  const [key, setKey] = useState(initial?.key || "")
  const [description, setDescription] = useState(initial?.description || "")
  const [enabled, setEnabled] = useState(initial?.enabled ?? false)
  const [plans, setPlans] = useState<string[]>(initial?.plan_codes || [])
  const [workspaces, setWorkspaces] = useState((initial?.workspace_ids || []).join("\n"))
  const keyOk = /^[a-z0-9_.]{2,80}$/.test(key)
  const dup = !initial && existingKeys.includes(key)
  const wsIds = workspaces.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
  const badWs = wsIds.filter((w) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(w))
  const valid = keyOk && !dup && badWs.length === 0

  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (valid) onSave({ key, description: description.trim(), enabled, plan_codes: plans, workspace_ids: wsIds }) }}>
      <DialogHeader>
        <DialogTitle>{initial ? `Edit ${initial.key}` : "New feature flag"}</DialogTitle>
        <DialogDescription>Keys are lowercase letters, numbers, dots and underscores.</DialogDescription>
      </DialogHeader>
      <Field label="Key" htmlFor="f-key" error={key && !keyOk ? "Use 2–80 chars: a–z, 0–9, _ and ." : dup ? "A flag with this key exists." : undefined}>
        <Input id="f-key" className="font-mono" value={key} onChange={(e) => setKey(e.target.value.toLowerCase())} readOnly={!!initial} placeholder="reports.new_layout" autoFocus={!initial} />
      </Field>
      <Field label="Description" htmlFor="f-desc"><Textarea id="f-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></Field>
      <div>
        <div className="mb-1.5 text-xs font-medium">Target plans <span className="font-normal text-muted-foreground">(none = all plans)</span></div>
        <div className="flex flex-wrap gap-3">
          {PLAN_CODES.map((p) => (
            <label key={p} className="flex items-center gap-1.5 text-sm">
              <Checkbox checked={plans.includes(p)} onCheckedChange={(v) => setPlans((s) => (v === true ? [...s, p] : s.filter((x) => x !== p)))} />
              {titleCase(p)}
            </label>
          ))}
        </div>
      </div>
      <Field label="Target workspace IDs" htmlFor="f-ws" hint="One UUID per line or comma-separated. Empty = all workspaces." error={badWs.length ? `Invalid ID: ${badWs[0]}` : undefined}>
        <Textarea id="f-ws" rows={3} className="font-mono text-xs" value={workspaces} onChange={(e) => setWorkspaces(e.target.value)} />
      </Field>
      <div className="flex items-center gap-2"><Switch id="f-enabled" checked={enabled} onCheckedChange={setEnabled} size="sm" /><Label htmlFor="f-enabled" className="text-sm font-normal">Enabled</Label></div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={!valid || pending}>{pending && <Loader2 className="animate-spin" />} Save flag</Button>
      </DialogFooter>
    </form>
  )
}

// ------------------------------------------------------------------------------------------------- settings
export function AdminSettings() {
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminApi<SettingsResponse>("/settings") })
  return (
    <>
      <PageHeader eyebrow="Platform" title="System settings" description="Platform-wide configuration. Changes take effect within ~15 seconds and are audit-logged." />
      {q.isPending ? (
        <div className="grid gap-4 lg:grid-cols-3"><CardSkeleton rows={12} className="lg:col-span-2" /><CardSkeleton rows={4} /></div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <SettingsForm key={JSON.stringify(q.data.settings)} data={q.data} />
      )}
    </>
  )
}

type FormState = Omit<PlatformSettings, "supported_countries" | "max_upload_mb" | "max_rows_per_upload" | "trial_days" | "branding"> & {
  supported_countries: string
  max_upload_mb: string
  max_rows_per_upload: string
  trial_days: string
  logo_url: string
  primary_color: string
}

function SettingsForm({ data }: { data: SettingsResponse }) {
  const can = useCan()
  const manage = can("settings.manage")
  const s = data.settings
  const [f, setF] = useState<FormState>({
    ...s,
    supported_countries: (s.supported_countries || []).join("\n"),
    max_upload_mb: String(s.max_upload_mb),
    max_rows_per_upload: String(s.max_rows_per_upload),
    trial_days: String(s.trial_days),
    logo_url: s.branding?.logo_url || "",
    primary_color: s.branding?.primary_color || "#4169F5",
  })
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((x) => ({ ...x, [k]: v }))
  const save = useAdminMutation<Record<string, unknown>>({
    fn: (body) => adminApi("/settings", { method: "PUT", body }),
    success: "Settings saved",
    invalidate: [["admin", "settings"], ["admin", "ai-usage"]],
  })

  const errors: Record<string, string> = {}
  const upload = Number(f.max_upload_mb)
  const rows = Number(f.max_rows_per_upload)
  const trial = Number(f.trial_days)
  if (!f.platform_name.trim()) errors.platform_name = "Required."
  if (!/^#[0-9a-f]{6}$/i.test(f.primary_color)) errors.primary_color = "Use a hex color like #4169F5."
  if (f.logo_url && !/^(https:\/\/|\/)\S+$/i.test(f.logo_url)) errors.logo_url = "Must be an https:// URL or a /path."
  if (!/^[a-z]{3}$/.test(f.default_currency)) errors.default_currency = "3-letter ISO code, lowercase (e.g. usd)."
  if (!f.default_timezone.trim()) errors.default_timezone = "Required."
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.support_email)) errors.support_email = "Enter a valid email."
  if (!Number.isInteger(upload) || upload < 1 || upload > 200) errors.max_upload_mb = "1–200."
  if (!Number.isInteger(rows) || rows < 1) errors.max_rows_per_upload = "Whole number ≥ 1."
  if (!Number.isInteger(trial) || trial < 0 || trial > 90) errors.trial_days = "0–90."

  const next: Partial<PlatformSettings> = {
    platform_name: f.platform_name.trim(),
    branding: { logo_url: f.logo_url.trim() || null, primary_color: f.primary_color },
    default_currency: f.default_currency,
    supported_countries: f.supported_countries.split("\n").map((c) => c.trim()).filter(Boolean),
    default_timezone: f.default_timezone.trim(),
    registration_enabled: f.registration_enabled,
    email_verification_required: f.email_verification_required,
    support_email: f.support_email.trim(),
    maintenance_mode: f.maintenance_mode,
    maintenance_message: f.maintenance_message,
    max_upload_mb: upload,
    max_rows_per_upload: rows,
    trial_days: trial,
  }
  const diff: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(next)) {
    if (JSON.stringify(v) !== JSON.stringify((s as Record<string, unknown>)[k])) diff[k] = v
  }
  const dirty = Object.keys(diff).length > 0
  const valid = Object.keys(errors).length === 0
  const ro = !manage

  return (
    <form className="grid gap-4 lg:grid-cols-3" onSubmit={(e) => { e.preventDefault(); if (valid && dirty) save.mutate(diff) }}>
      <div className="space-y-4 lg:col-span-2">
        <Panel title="Branding">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Platform name" htmlFor="s-name" error={errors.platform_name}><Input id="s-name" value={f.platform_name} onChange={(e) => set("platform_name", e.target.value)} disabled={ro} /></Field>
            <Field label="Primary color" htmlFor="s-color" error={errors.primary_color}>
              <div className="flex gap-2">
                <input type="color" aria-label="Pick primary color" value={/^#[0-9a-f]{6}$/i.test(f.primary_color) ? f.primary_color : "#4169F5"} onChange={(e) => set("primary_color", e.target.value)} disabled={ro} className="h-8 w-10 cursor-pointer rounded-md border bg-transparent p-0.5" />
                <Input id="s-color" className="font-mono" value={f.primary_color} onChange={(e) => set("primary_color", e.target.value)} disabled={ro} />
              </div>
            </Field>
            <Field label="Logo URL" htmlFor="s-logo" error={errors.logo_url} className="sm:col-span-2"><Input id="s-logo" value={f.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://…" disabled={ro} /></Field>
          </div>
        </Panel>
        <Panel title="Localization">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Default currency" htmlFor="s-cur" error={errors.default_currency}><Input id="s-cur" value={f.default_currency} onChange={(e) => set("default_currency", e.target.value.toLowerCase().slice(0, 3))} disabled={ro} /></Field>
            <Field label="Default timezone" htmlFor="s-tz" error={errors.default_timezone} hint="IANA name, e.g. Asia/Dubai"><Input id="s-tz" value={f.default_timezone} onChange={(e) => set("default_timezone", e.target.value)} disabled={ro} /></Field>
            <Field label="Supported countries" htmlFor="s-countries" hint="One per line" className="sm:col-span-2"><Textarea id="s-countries" rows={6} value={f.supported_countries} onChange={(e) => set("supported_countries", e.target.value)} disabled={ro} /></Field>
          </div>
        </Panel>
        <Panel title="Accounts & limits">
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow id="s-reg" label="Registration enabled" hint="Allow new signups" checked={f.registration_enabled} onChange={(v) => set("registration_enabled", v)} disabled={ro} />
            <ToggleRow id="s-verify" label="Email verification required" checked={f.email_verification_required} onChange={(v) => set("email_verification_required", v)} disabled={ro} />
            <Field label="Support email" htmlFor="s-support" error={errors.support_email}><Input id="s-support" type="email" value={f.support_email} onChange={(e) => set("support_email", e.target.value)} disabled={ro} /></Field>
            <Field label="Default trial days" htmlFor="s-trial" error={errors.trial_days}><Input id="s-trial" inputMode="numeric" value={f.trial_days} onChange={(e) => set("trial_days", e.target.value.replace(/\D/g, ""))} disabled={ro} /></Field>
            <Field label="Max upload size (MB)" htmlFor="s-upload" error={errors.max_upload_mb}><Input id="s-upload" inputMode="numeric" value={f.max_upload_mb} onChange={(e) => set("max_upload_mb", e.target.value.replace(/\D/g, ""))} disabled={ro} /></Field>
            <Field label="Max rows per upload" htmlFor="s-rows" error={errors.max_rows_per_upload}><Input id="s-rows" inputMode="numeric" value={f.max_rows_per_upload} onChange={(e) => set("max_rows_per_upload", e.target.value.replace(/\D/g, ""))} disabled={ro} /></Field>
          </div>
        </Panel>
        <Panel title="Maintenance" className={f.maintenance_mode ? "border-amber-400/30" : undefined}>
          <div className="space-y-3">
            <ToggleRow id="s-maint" label="Maintenance mode" hint="Customers see the maintenance message instead of the app." checked={f.maintenance_mode} onChange={(v) => set("maintenance_mode", v)} disabled={ro} />
            <Field label="Maintenance message" htmlFor="s-mmsg"><Textarea id="s-mmsg" rows={2} value={f.maintenance_message} onChange={(e) => set("maintenance_message", e.target.value)} disabled={ro} /></Field>
          </div>
        </Panel>
      </div>
      <div className="space-y-4">
        <Panel title={<span className="inline-flex items-center gap-1.5"><Server className="size-3.5" /> Environment</span>} description="Read-only, from server configuration">
          <KV
            className="sm:grid-cols-1"
            items={[
              ["Environment", <Pill key="e" color={data.environment.environment === "production" ? "green" : "amber"}>{data.environment.environment}</Pill>],
              ["File storage", data.environment.storage],
              ["Email delivery", data.environment.email],
              ["Job runner", data.environment.jobs],
              ["AI provider", s.ai_provider],
            ]}
          />
          <p className="mt-3 text-[11px] text-muted-foreground">AI provider and model settings are managed on the AI Usage page.</p>
        </Panel>
        {manage ? (
          <div className="sticky top-20 space-y-2 rounded-xl border bg-card/70 p-4">
            <div className="text-xs text-muted-foreground">{dirty ? `${Object.keys(diff).length} unsaved change(s)` : "No unsaved changes"}</div>
            <Button type="submit" className="w-full" disabled={!dirty || !valid || save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save settings
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-card/70 p-4 text-xs text-muted-foreground">Your role can view settings but not change them.</div>
        )}
      </div>
    </form>
  )
}

function ToggleRow({ id, label, hint, checked, onChange, disabled }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div>
        <Label htmlFor={id} className="text-sm">{label}</Label>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}
