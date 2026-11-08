"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { BotMessageSquare, Clock, DollarSign, Loader2, Save, Zap, XCircle } from "lucide-react"
import { useState } from "react"
import { Pill } from "@/components/shared/badges"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAdminMutation, useCan, usePaging } from "@/hooks/use-admin"
import { adminApi, formatDateTime, formatUsd } from "@/lib/admin-api"
import type { AISettings, AIUsageResponse } from "@/lib/admin-types"
import { formatCompact, formatNumber, titleCase } from "@/lib/utils"
import { BarsChart } from "../charts"
import { BoolDot, Field, FilterBar, FilterSelect, KpiGrid, KpiSkeleton, KpiTile, PageHeader, Pager, Panel, TableCard, TableRowsSkeleton } from "../ui"

export function AdminAIUsage() {
  const can = useCan()
  const [provider, setProvider] = useState("")
  const [status, setStatus] = useState("")
  const { page, pageSize, setPage, setPageSize } = usePaging()
  const q = useQuery({
    queryKey: ["admin", "ai-usage", { provider, status, page, pageSize }],
    queryFn: () => adminApi<AIUsageResponse>("/ai-usage", { query: { provider, status, page, page_size: pageSize } }),
    placeholderData: keepPreviousData,
  })

  if (q.isPending) {
    return (
      <>
        <PageHeader eyebrow="Product" title="AI usage" />
        <div className="space-y-4"><KpiSkeleton /><CardSkeleton rows={6} /><CardSkeleton rows={8} /></div>
      </>
    )
  }
  if (q.isError) {
    return (
      <>
        <PageHeader eyebrow="Product" title="AI usage" />
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </>
    )
  }
  const d = q.data
  const agg = d.aggregates_30d
  const requests = agg.reduce((s, a) => s + a.requests, 0)
  const tokens = agg.reduce((s, a) => s + a.input_tokens + a.output_tokens, 0)
  const cost = agg.reduce((s, a) => s + a.cost_usd, 0)
  const errors = agg.reduce((s, a) => s + a.errors, 0)
  const avgMs = requests ? agg.reduce((s, a) => s + a.avg_duration_ms * a.requests, 0) / requests : 0
  const providers = Array.from(new Set([...agg.map((a) => a.provider), "anthropic", "openai", "heuristic"]))

  return (
    <>
      <PageHeader eyebrow="Product" title="AI usage" description="Model consumption, cost and reliability across all workspaces (30 days)." />
      <div className="space-y-4">
        <KpiGrid className="xl:grid-cols-5">
          <KpiTile label="Requests" value={formatNumber(requests)} icon={Zap} />
          <KpiTile label="Tokens" value={formatCompact(tokens)} icon={BotMessageSquare} tone="violet" />
          <KpiTile label="Cost" value={formatUsd(cost)} icon={DollarSign} tone="amber" />
          <KpiTile label="Error rate" value={requests ? `${((100 * errors) / requests).toFixed(1)}%` : "—"} icon={XCircle} tone={errors ? "rose" : "emerald"} hint={`${formatNumber(errors)} errors`} />
          <KpiTile label="Avg latency" value={avgMs ? `${Math.round(avgMs)} ms` : "—"} icon={Clock} tone="sky" />
        </KpiGrid>

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="By provider & model" description="Last 30 days" className="xl:col-span-2" bodyClassName="p-0">
            {agg.length === 0 ? (
              <div className="p-4"><EmptyState icon={BotMessageSquare} title="No AI requests in the last 30 days" className="border-0 py-8" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                    <TableHead className="text-right">Avg ms</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agg.map((a) => (
                    <TableRow key={`${a.provider}-${a.model}`}>
                      <TableCell><Pill color="indigo">{a.provider}</Pill></TableCell>
                      <TableCell className="font-mono text-xs">{a.model}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(a.requests)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCompact(a.input_tokens)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCompact(a.output_tokens)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsd(a.cost_usd)}</TableCell>
                      <TableCell className={a.errors ? "text-right text-rose-300 tabular-nums" : "text-right tabular-nums"}>{formatNumber(a.errors)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(a.avg_duration_ms)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
          <Panel title="Provider status" description="Credentials are configured via environment variables">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between gap-2">
                <span>Anthropic <span className="block font-mono text-[11px] text-muted-foreground">{d.providers.anthropic.model}</span></span>
                <BoolDot value={d.providers.anthropic.configured} on="Configured" off="Not configured" />
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>OpenAI <span className="block font-mono text-[11px] text-muted-foreground">{d.providers.openai.model}</span></span>
                <BoolDot value={d.providers.openai.configured} on="Configured" off="Not configured" />
              </li>
              <li className="flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                Environment default <Pill>{d.providers.default}</Pill>
              </li>
              <li className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                Active setting <Pill color="violet">{d.settings.ai_provider}</Pill>
              </li>
            </ul>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Top workspaces by cost" description="Last 30 days" className="xl:col-span-2">
            <BarsChart
              data={d.top_workspaces_30d.map((w) => ({ workspace: w.workspace, cost_usd: w.cost_usd }))}
              xKey="workspace"
              horizontal
              periodLabels={false}
              series={[{ key: "cost_usd", label: "Cost", color: "#fbbf24" }]}
              format={(n) => formatUsd(n)}
              height={Math.max(160, d.top_workspaces_30d.length * 30)}
            />
          </Panel>
          <AISettingsPanel settings={d.settings} canManage={can("settings.manage")} />
        </div>

        <Panel title="Request log" bodyClassName="p-0">
          <div className="border-b px-4 py-2">
            <FilterBar className="mb-0">
              <FilterSelect label="Provider" value={provider} onChange={(v) => { setProvider(v); setPage(1) }} options={providers.map((p) => ({ value: p, label: titleCase(p) }))} />
              <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[{ value: "success", label: "Success" }, { value: "error", label: "Error" }]} />
            </FilterBar>
          </div>
          <TableCard className="rounded-none border-0" footer={<Pager page={page} pageSize={pageSize} total={d.total} onPage={setPage} onPageSize={setPageSize} fetching={q.isFetching} />}>
            {q.isFetching && q.isPlaceholderData ? (
              <TableRowsSkeleton cols={7} />
            ) : d.items.length === 0 ? (
              <div className="p-4"><EmptyState title="No requests match" className="border-0 py-8" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Provider / model</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Tokens in/out</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</TableCell>
                      <TableCell>
                        <div className="text-xs">{r.provider}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{r.model}</div>
                      </TableCell>
                      <TableCell className="text-xs">{r.operation || "—"}{r.prompt_version && <span className="ml-1 font-mono text-[10px] text-muted-foreground">{r.prompt_version}</span>}</TableCell>
                      <TableCell className="max-w-[160px] truncate text-xs">{r.workspace || "—"}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs">{r.user || "—"}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{formatNumber(r.input_tokens)} / {formatNumber(r.output_tokens)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{formatUsd(r.cost_usd, 4)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.duration_ms !== null ? `${formatNumber(r.duration_ms)} ms` : "—"}</TableCell>
                      <TableCell title={r.error || undefined}>
                        <Pill color={r.status === "success" ? "green" : r.status === "error" ? "red" : "gray"}>{titleCase(r.status)}</Pill>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableCard>
        </Panel>

        {Object.keys(d.pricing).length > 0 && (
          <Panel title="Model pricing" description="USD per million tokens, used for cost estimates">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(d.pricing).map(([m, p]) => (
                <div key={m} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
                  <span className="truncate font-mono">{m}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">${p.input_per_mtok} in · ${p.output_per_mtok} out</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </>
  )
}

function AISettingsPanel({ settings, canManage }: { settings: AISettings; canManage: boolean }) {
  const [provider, setProvider] = useState(settings.ai_provider)
  const [anthropic, setAnthropic] = useState(settings.ai_model_anthropic)
  const [openai, setOpenai] = useState(settings.ai_model_openai)
  const [limit, setLimit] = useState(String(settings.ai_monthly_token_limit_per_workspace))
  const m = useAdminMutation<Partial<AISettings>>({
    fn: (body) => adminApi("/ai-usage/settings", { method: "PUT", body }),
    success: "AI settings saved",
    invalidate: [["admin", "ai-usage"], ["admin", "settings"]],
  })
  const limitN = Number(limit)
  const valid = anthropic.trim() && openai.trim() && limit !== "" && Number.isInteger(limitN) && limitN >= 0
  const dirty =
    provider !== settings.ai_provider ||
    anthropic.trim() !== settings.ai_model_anthropic ||
    openai.trim() !== settings.ai_model_openai ||
    limitN !== settings.ai_monthly_token_limit_per_workspace

  return (
    <Panel title="AI settings" description={canManage ? "Platform-wide provider routing and limits" : "Read-only for your role"}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && dirty) {
            m.mutate({ ai_provider: provider, ai_model_anthropic: anthropic.trim(), ai_model_openai: openai.trim(), ai_monthly_token_limit_per_workspace: limitN })
          }
        }}
      >
        <Field label="Provider" hint="auto picks the first configured provider; heuristic uses no LLM.">
          <Select value={provider} onValueChange={(v) => setProvider(v as AISettings["ai_provider"])} disabled={!canManage}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["auto", "anthropic", "openai", "heuristic"] as const).map((p) => <SelectItem key={p} value={p}>{titleCase(p)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Anthropic model" htmlFor="ai-anthropic">
          <Input id="ai-anthropic" className="font-mono text-xs" value={anthropic} onChange={(e) => setAnthropic(e.target.value)} disabled={!canManage} maxLength={80} />
        </Field>
        <Field label="OpenAI model" htmlFor="ai-openai">
          <Input id="ai-openai" className="font-mono text-xs" value={openai} onChange={(e) => setOpenai(e.target.value)} disabled={!canManage} maxLength={80} />
        </Field>
        <Field label="Monthly token limit per workspace" htmlFor="ai-limit" hint={limit && Number.isFinite(limitN) ? `${formatCompact(limitN)} tokens` : undefined}>
          <Input id="ai-limit" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} disabled={!canManage} />
        </Field>
        {canManage && (
          <Button type="submit" size="sm" className="w-full" disabled={!valid || !dirty || m.isPending}>
            {m.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save AI settings
          </Button>
        )}
      </form>
    </Panel>
  )
}
