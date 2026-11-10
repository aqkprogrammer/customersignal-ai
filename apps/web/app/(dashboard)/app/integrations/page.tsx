"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Copy, KeyRound, Loader2, Plug, ShieldCheck, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/dashboard/primitives"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { CardSkeleton, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useWorkspace } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { timeAgo } from "@/lib/utils"

interface IntegrationItem {
  provider: string; name: string; category: string; availability: "builtin" | "available" | "requires_approval"; description: string
  capabilities: string[]; setup: string[]; fields?: { name: string; label: string; type: string; required: boolean }[]
  status: string; enabled: boolean; id: string | null; config: Record<string, unknown>; last_sync_at: string | null; last_error: string | null
}
interface Log { id: string; action: string; status: string; message: string; created_at: string }
interface Key { id: string; name: string; prefix: string; last_used_at: string | null; revoked: boolean; created_at: string }

export default function IntegrationsPage() {
  const qc = useQueryClient()
  const { can } = useWorkspace()
  const [active, setActive] = useState<IntegrationItem | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null)

  const list = useQuery({ queryKey: ["integrations"], queryFn: () => api<IntegrationItem[]>("/integrations") })
  const logs = useQuery({ queryKey: ["integration-logs", active?.provider], queryFn: () => api<Log[]>(`/integrations/${active!.provider}/logs`), enabled: !!active })
  const keys = useQuery({ queryKey: ["api-keys"], queryFn: () => api<Key[]>("/integrations/api-keys/list"), enabled: active?.provider === "reviews_api" && can("admin") })
  const refresh = () => { qc.invalidateQueries({ queryKey: ["integrations"] }); qc.invalidateQueries({ queryKey: ["integration-logs"] }); qc.invalidateQueries({ queryKey: ["api-keys"] }) }

  const connect = useMutation({
    mutationFn: () => api<{ status: string; signing_secret?: string; api_key?: string }>(`/integrations/${active!.provider}/connect`, { method: "POST", body: { config: values } }),
    onSuccess: (r) => {
      refresh(); setValues({})
      if (r.api_key) setSecret({ label: "Your API key (shown once)", value: r.api_key })
      else if (r.signing_secret) setSecret({ label: "Webhook signing secret (shown once)", value: r.signing_secret })
      else toast.success("Connected")
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const disconnect = useMutation({
    mutationFn: (p: string) => api(`/integrations/${p}/disconnect`, { method: "POST" }),
    onSuccess: () => { refresh(); toast.success("Disconnected") },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const test = useMutation({
    mutationFn: (p: string) => api<{ ok: boolean; last_error: string | null }>(`/integrations/${p}/test`, { method: "POST" }),
    onSuccess: (r) => { refresh(); if (r.ok) toast.success("Connection OK"); else toast.error(r.last_error || "Test failed") },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const groups = list.data ? [...new Set(list.data.map((i) => i.category))] : []
  const current = active && list.data?.find((i) => i.provider === active.provider)

  return (
    <>
      <PageHeader title="Integrations" description="Connect data sources and tools. We only use official APIs, approved access methods and permitted data providers — never scraping or bypassing platform restrictions." />
      {list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{g}</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.data.filter((i) => i.category === g).map((i) => (
                  <button key={i.provider} onClick={() => setActive(i)} className="surface flex flex-col p-5 text-left transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary"><Plug className="size-4" /></span>
                      <StatusBadge status={i.availability === "builtin" ? "active" : i.status} />
                    </div>
                    <p className="mt-3 font-semibold">{i.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>
                    {!i.enabled && <p className="mt-2 text-xs text-destructive">Disabled by platform admin</p>}
                    {i.last_error && <p className="mt-2 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" /> {i.last_error}</p>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Sheet open={!!active} onOpenChange={(o) => { if (!o) { setActive(null); setValues({}) } }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {current && (
            <>
              <SheetHeader>
                <SheetTitle>{current.name}</SheetTitle>
                <SheetDescription>{current.description}</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-8">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={current.availability === "builtin" ? "active" : current.status} />
                  {current.last_sync_at && <span className="text-xs text-muted-foreground">Last activity {timeAgo(current.last_sync_at)}</span>}
                </div>
                {current.availability === "requires_approval" && (
                  <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                    <p className="flex items-center gap-1.5 font-medium"><ShieldCheck className="size-4" /> Requires platform API approval</p>
                    <p className="mt-1">This connector isn&apos;t live yet. Use CSV/Excel upload with data you&apos;re authorized to use in the meantime.</p>
                  </div>
                )}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Capabilities</p>
                  <div className="flex flex-wrap gap-1.5">{current.capabilities.map((c) => <Pill key={c} color="signal">{c}</Pill>)}</div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Setup instructions</p>
                  <ol className="list-inside list-decimal space-y-1.5 text-sm">{current.setup.map((s) => <li key={s}>{s}</li>)}</ol>
                </div>
                {current.availability === "available" && can("admin") && current.enabled && (
                  current.status === "connected" ? (
                    <div className="space-y-3">
                      <p className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle2 className="size-4" /> Connected {current.config.url ? `→ ${String(current.config.url)}` : ""}{current.config.token_hint ? ` (token ${String(current.config.token_hint)})` : ""}</p>
                      <div className="flex gap-2">
                        {current.provider !== "reviews_api" && <Button variant="outline" onClick={() => test.mutate(current.provider)} disabled={test.isPending}>Send test</Button>}
                        {current.provider === "reviews_api" && <Button variant="outline" onClick={() => connect.mutate()} disabled={connect.isPending}><KeyRound /> New API key</Button>}
                        <Button variant="ghost" className="text-destructive" onClick={() => disconnect.mutate(current.provider)}>Disconnect</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {current.fields?.map((f) => (
                        <div key={f.name} className="space-y-1.5">
                          <Label htmlFor={`f-${f.name}`}>{f.label}{!f.required && <span className="text-muted-foreground"> (optional)</span>}</Label>
                          <Input id={`f-${f.name}`} type={f.type === "password" ? "password" : f.type === "url" ? "url" : "text"} autoComplete="off"
                            value={values[f.name] || ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
                        </div>
                      ))}
                      <Button onClick={() => connect.mutate()} disabled={connect.isPending || !!current.fields?.some((f) => f.required && !values[f.name]?.trim())}>
                        {connect.isPending && <Loader2 className="animate-spin" />} Connect
                      </Button>
                      <p className="text-xs text-muted-foreground">Credentials are encrypted at rest and never shown again.</p>
                    </div>
                  )
                )}
                {current.availability === "available" && !can("admin") && <p className="text-sm text-muted-foreground">Ask a workspace admin to connect this integration.</p>}
                {current.provider === "reviews_api" && keys.data && keys.data.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">API keys</p>
                    <ul className="space-y-1.5 text-sm">
                      {keys.data.map((k) => (
                        <li key={k.id} className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs">{k.prefix}… · {k.name} · {k.revoked ? "revoked" : `used ${timeAgo(k.last_used_at)}`}</span>
                          {!k.revoked && <Button variant="ghost" size="icon-xs" aria-label="Revoke key" onClick={async () => { await api(`/integrations/api-keys/${k.id}`, { method: "DELETE" }); refresh() }}><Trash2 /></Button>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {current.availability !== "builtin" && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Sync & error log</p>
                    {!logs.data?.length ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
                      <ul className="space-y-1.5 text-xs">
                        {logs.data.map((log) => (
                          <li key={log.id} className="flex gap-2"><StatusBadge status={log.status} /><span className="flex-1">{log.message}</span><span className="text-muted-foreground">{timeAgo(log.created_at)}</span></li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!secret} onOpenChange={(o) => !o && setSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{secret?.label}</DialogTitle>
            <DialogDescription>Copy it now — for your security we only store a hash and can&apos;t show it again.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg bg-muted p-3 font-mono text-xs break-all">
            <span className="flex-1">{secret?.value}</span>
            <Button variant="ghost" size="icon-sm" aria-label="Copy" onClick={() => { navigator.clipboard.writeText(secret?.value || ""); toast.success("Copied") }}><Copy /></Button>
          </div>
          <DialogFooter><Button onClick={() => setSecret(null)}>I&apos;ve saved it</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
