"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, XCircle, type LucideIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import { cn, formatNumber, titleCase } from "@/lib/utils"
import type { Job, Page, Project } from "@/types/api"

export function PageHeader({ title, description, actions, badge }: { title: string; description?: string; actions?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-[22px]">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "indigo",
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
  tone?: "indigo" | "green" | "red" | "gray" | "violet" | "amber"
  className?: string
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    red: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    gray: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  }
  return (
    <div className={cn("surface p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("flex size-7 items-center justify-center rounded-lg", tones[tone])}>
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Panel({ title, description, actions, children, className, bodyClassName }: {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("surface flex flex-col", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

export function useProjects(opts: { kind?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ["projects", "all", opts],
    queryFn: () => api<Page<Project>>("/projects", { query: { page_size: 200, kind: opts.kind, status: opts.status } }),
  })
}

export function ProjectSelect({
  value,
  onChange,
  allowAll = true,
  kind,
  className,
  placeholder = "Select a project",
}: {
  value: string | null
  onChange: (id: string | null) => void
  allowAll?: boolean
  kind?: string
  className?: string
  placeholder?: string
}) {
  const { data, isLoading } = useProjects({ kind })
  return (
    <Select value={value ?? "all"} onValueChange={(v) => onChange(v === "all" ? null : v)} disabled={isLoading}>
      <SelectTrigger className={cn("w-[240px]", className)} aria-label="Project">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="all">All projects</SelectItem>}
        {!allowAll && !value && <SelectItem value="all" disabled>{placeholder}</SelectItem>}
        {data?.items.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
            {p.is_demo ? " (demo)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Polls a background job until it finishes; invalidates `invalidate` query keys on completion. */
export function useJob(jobId: string | null | undefined, { invalidate = [] as unknown[][], onDone }: { invalidate?: unknown[][]; onDone?: (job: Job) => void } = {}) {
  const qc = useQueryClient()
  const doneRef = useRef<string | null>(null)
  const query = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api<Job>(`/analysis/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === "completed" || s === "failed" || s === "cancelled" ? false : 1500
    },
  })
  useEffect(() => {
    const job = query.data
    if (!job || doneRef.current === job.id) return
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      doneRef.current = job.id
      invalidate.forEach((key) => qc.invalidateQueries({ queryKey: key }))
      onDone?.(job)
    }
  }, [query.data, invalidate, onDone, qc])
  return query
}

export function JobProgress({ job, onCancel, className }: { job: Job | undefined; onCancel?: () => void; className?: string }) {
  if (!job) return null
  const running = job.status === "pending" || job.status === "processing"
  return (
    <div className={cn("rounded-xl border bg-card p-4", className)} role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        {running ? (
          <Loader2 className="size-4 animate-spin text-primary" />
        ) : job.status === "completed" ? (
          <CheckCircle2 className="size-4 text-emerald-600" />
        ) : (
          <XCircle className="size-4 text-destructive" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{job.stage || titleCase(job.status)}</p>
          {job.total_items > 0 && running && (
            <p className="text-xs text-muted-foreground">
              {formatNumber(job.processed_items)} of {formatNumber(job.total_items)} reviews
            </p>
          )}
          {job.status === "failed" && job.error && <p className="text-xs text-destructive">{job.error}</p>}
        </div>
        {running && onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
      {running && <Progress value={job.progress} className="mt-3 h-1.5" />}
      {job.status === "completed" && Array.isArray(job.result_summary?.warnings) && (job.result_summary.warnings as string[]).length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">
          {(job.result_summary.warnings as string[]).map((w) => <li key={w}>⚠ {w}</li>)}
        </ul>
      )}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  return (
    <div className="flex items-center justify-between px-1 pt-3 text-sm text-muted-foreground">
      <span>
        {formatNumber((page - 1) * pageSize + 1)}–{formatNumber(Math.min(total, page * pageSize))} of {formatNumber(total)}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="px-2 tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => Promise<unknown> | void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className={cn(destructive && "bg-destructive text-white hover:bg-destructive/90")}
            onClick={async (e) => {
              e.preventDefault()
              setBusy(true)
              try {
                await onConfirm()
                onOpenChange(false)
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />} {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Sync a piece of state with a URL search param (shallow, no navigation). */
export function useQueryParam(key: string, initial: string | null = null): [string | null, (v: string | null) => void] {
  const [value, setValue] = useState<string | null>(() => {
    if (typeof window === "undefined") return initial
    return new URLSearchParams(window.location.search).get(key) ?? initial
  })
  const set = (v: string | null) => {
    setValue(v)
    const url = new URL(window.location.href)
    if (v) url.searchParams.set(key, v)
    else url.searchParams.delete(key)
    window.history.replaceState(null, "", url.toString())
  }
  return [value, set]
}
