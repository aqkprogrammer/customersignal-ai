"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, BellRing, Check, Loader2, Play, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog, PageHeader, Pagination, Panel, ProjectSelect } from "@/components/dashboard/primitives"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useWorkspace } from "@/hooks/use-session"
import { api, ApiError, errorMessage } from "@/lib/api"
import { cn, timeAgo } from "@/lib/utils"
import type { Page } from "@/types/api"

interface Rule { id: string; project_id: string; project_name: string | null; name: string; rule_type: string; description: string; threshold: number; window_days: number; channels: string[]; cooldown_hours: number; is_active: boolean; last_evaluated_at: string | null; last_triggered_at: string | null; last_value: number | null }
interface Event { id: string; rule_name: string; severity: string; title: string; message: string; metric_value: number | null; acknowledged: boolean; created_at: string }

const UNITS: Record<string, { unit: string; hint: string; default: number }> = {
  negative_sentiment_above: { unit: "%", hint: "Trigger when negative reviews exceed this share", default: 30 },
  average_rating_below: { unit: "★", hint: "Trigger when the window's average rating is below this", default: 3.5 },
  rating_drop: { unit: "★", hint: "Trigger when the average drops by at least this many stars", default: 0.5 },
  new_recurring_complaint: { unit: "reviews", hint: "Minimum reviews for a new/rising complaint theme", default: 3 },
  competitor_sentiment_change: { unit: "pts", hint: "Change in a competitor's negative % between windows", default: 10 },
  review_volume_spike: { unit: "×", hint: "Review volume multiple vs. the previous window", default: 2 },
}

export default function MonitoringPage() {
  const qc = useQueryClient()
  const { can } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [del, setDel] = useState<Rule | null>(null)
  const [form, setForm] = useState({ project_id: null as string | null, name: "", rule_type: "negative_sentiment_above", threshold: "30", window_days: "7", email: false, cooldown_hours: "24" })

  const types = useQuery({ queryKey: ["rule-types"], queryFn: () => api<{ value: string; label: string }[]>("/monitoring/rule-types") })
  const rules = useQuery({ queryKey: ["rules"], queryFn: () => api<Rule[]>("/monitoring/rules") })
  const events = useQuery({ queryKey: ["events", page], queryFn: () => api<Page<Event>>("/monitoring/events", { query: { page, page_size: 15 } }) })
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["rules"] }); qc.invalidateQueries({ queryKey: ["events"] }) }

  const create = useMutation({
    mutationFn: () => api("/monitoring/rules", { method: "POST", body: {
      project_id: form.project_id, name: form.name, rule_type: form.rule_type, threshold: Number(form.threshold), window_days: Number(form.window_days),
      channels: form.email ? ["in_app", "email"] : ["in_app"], cooldown_hours: Number(form.cooldown_hours) } }),
    onSuccess: () => { setOpen(false); invalidate(); toast.success("Monitoring rule created") },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const toggle = useMutation({
    mutationFn: (r: Rule) => api(`/monitoring/rules/${r.id}`, { method: "PATCH", body: { is_active: !r.is_active } }),
    onSuccess: invalidate,
  })
  const evaluate = useMutation({
    mutationFn: (r: Rule) => api<{ triggered: boolean; last_value: number | null; event: { title: string } | null }>(`/monitoring/rules/${r.id}/evaluate`, { method: "POST" }),
    onSuccess: (res) => {
      invalidate()
      if (res.triggered) toast.warning(`Alert: ${res.event?.title}`)
      else toast.success(`All clear (current value: ${res.last_value ?? "n/a"})`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const ack = useMutation({ mutationFn: (id: string) => api(`/monitoring/events/${id}/acknowledge`, { method: "POST" }), onSuccess: invalidate })

  const locked = rules.error instanceof ApiError && rules.error.status === 402

  return (
    <>
      <PageHeader title="Monitoring & Alerts" description="Get notified when sentiment shifts, ratings drop, complaints emerge or competitors move. Evaluated hourly on your stored data."
        actions={can("analyst") && !locked && <Button onClick={() => setOpen(true)}><Plus /> New rule</Button>} />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel title="Rules">
          {rules.error ? <ErrorState error={rules.error} /> : !rules.data ? <CardSkeleton rows={4} /> : !rules.data.length ? (
            <EmptyState icon={Bell} title="No monitoring rules" description="Create a rule to be alerted in-app or by email."
              action={can("analyst") && <Button onClick={() => setOpen(true)}><Plus /> Create your first rule</Button>} />
          ) : (
            <ul className="divide-y">
              {rules.data.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.project_name} · {r.description} · threshold {r.threshold}{UNITS[r.rule_type]?.unit === "%" ? "%" : ""} · {r.window_days}d window</p>
                    <p className="text-[11px] text-muted-foreground">
                      Last checked {timeAgo(r.last_evaluated_at)}{r.last_value !== null ? ` (value ${r.last_value})` : ""} · last alert {timeAgo(r.last_triggered_at)}
                      {r.channels.includes("email") && " · email on"}
                    </p>
                  </div>
                  {can("analyst") && (
                    <div className="flex items-center gap-1">
                      <Switch checked={r.is_active} onCheckedChange={() => toggle.mutate(r)} aria-label={`${r.is_active ? "Disable" : "Enable"} ${r.name}`} />
                      <Button variant="ghost" size="icon-sm" onClick={() => evaluate.mutate(r)} disabled={evaluate.isPending} aria-label="Check now"><Play /></Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDel(r)} aria-label="Delete rule"><Trash2 /></Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Alert history">
          {!events.data ? <CardSkeleton rows={4} /> : !events.data.items.length ? (
            <EmptyState icon={BellRing} title="No alerts yet" description="Triggered alerts appear here and in your notifications." />
          ) : (
            <>
              <ul className="space-y-2">
                {events.data.items.map((e) => (
                  <li key={e.id} className={cn("rounded-lg border p-3", !e.acknowledged && "border-amber-300/60 bg-amber-50/50 dark:bg-amber-500/5")}>
                    <div className="flex items-start gap-2">
                      <StatusBadge status={e.severity} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{e.message}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{e.rule_name} · {timeAgo(e.created_at)}</p>
                      </div>
                      {!e.acknowledged ? (
                        <Button variant="ghost" size="xs" onClick={() => ack.mutate(e.id)}><Check /> Ack</Button>
                      ) : <Pill color="gray">Acknowledged</Pill>}
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination page={page} pageSize={events.data.page_size} total={events.data.total} onPage={setPage} />
            </>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Email delivery follows each member&apos;s <Link href="/app/settings?tab=notifications" className="text-primary hover:underline">notification preferences</Link>.</p>
        </Panel>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New monitoring rule</DialogTitle>
            <DialogDescription>Rules run on reviews stored in CustomerSignal AI (uploads, API and authorized integrations).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Project</Label><ProjectSelect value={form.project_id} onChange={(v) => setForm({ ...form, project_id: v })} allowAll={false} className="w-full" /></div>
            <div className="space-y-1.5"><Label htmlFor="r-name">Rule name</Label><Input id="r-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={form.rule_type} onValueChange={(v) => setForm({ ...form, rule_type: v, threshold: String(UNITS[v]?.default ?? 1) })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{types.data?.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label htmlFor="r-th">Threshold ({UNITS[form.rule_type]?.unit})</Label><Input id="r-th" type="number" step="0.1" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="r-win">Window (days)</Label><Input id="r-win" type="number" value={form.window_days} onChange={(e) => setForm({ ...form, window_days: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="r-cd">Cooldown (h)</Label><Input id="r-cd" type="number" value={form.cooldown_hours} onChange={(e) => setForm({ ...form, cooldown_hours: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">{UNITS[form.rule_type]?.hint}</p>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.email} onCheckedChange={(v) => setForm({ ...form, email: v === true })} /> Also send email alerts</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!form.project_id || form.name.trim().length < 2 || create.isPending}>{create.isPending && <Loader2 className="animate-spin" />} Create rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete "${del?.name}"?`} description="Its alert history will also be removed." destructive confirmLabel="Delete"
        onConfirm={async () => { await api(`/monitoring/rules/${del!.id}`, { method: "DELETE" }); invalidate() }} />
    </>
  )
}
