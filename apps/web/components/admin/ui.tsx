"use client"

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Loader2, Lock, Search, X, type LucideIcon } from "lucide-react"
import { useState } from "react"
import { EmptyState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { TableHead } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn, formatNumber } from "@/lib/utils"
import { Sparkline } from "./charts"

// ------------------------------------------------------------------------------------------------ layout
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  eyebrow?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 inline-flex items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] text-signal uppercase">
            <span aria-hidden className="h-px w-5 bg-current opacity-60" />
            {eyebrow}
          </div>
        )}
        <h1 className="truncate text-xl font-semibold tracking-[-0.03em] text-white sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  id?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        "min-w-0 rounded-lg border bg-card/70 surface-lit",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-white">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  )
}

export function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "signal",
  spark,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
  tone?: "signal" | "ice" | "sky" | "emerald" | "amber" | "rose"
  spark?: number[]
  className?: string
}) {
  const tones = {
    signal: { icon: "text-signal", spark: "#45e5ea" },
    ice: { icon: "text-ice", spark: "#80bdff" },
    sky: { icon: "text-ice", spark: "#80bdff" },
    emerald: { icon: "text-mint", spark: "#76f0c1" },
    amber: { icon: "text-ember", spark: "#eab56d" },
    rose: { icon: "text-negative", spark: "#f2706b" },
  }[tone]
  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-card/70 p-3.5 surface-lit", className)}>
      <span aria-hidden className="absolute inset-x-3.5 top-0 h-px opacity-60" style={{ background: `linear-gradient(90deg, ${tones.spark}, transparent 70%)` }} />
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">{label}</span>
        {Icon && (
          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border border-border", tones.icon)}>
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[22px] leading-none font-semibold tracking-[-0.035em] text-white tabular-nums">{value}</div>
          {hint && <div className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} color={tones.spark} className="h-8 w-20 shrink-0" />}
      </div>
    </div>
  )
}

export function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4", className)}>{children}</div>
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <KpiGrid>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card/70 p-3.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-6 w-24" />
        </div>
      ))}
    </KpiGrid>
  )
}

/** Delta chip: +12.3% (green) / -4% (red). */
export function Delta({ value, suffix = "%", invert }: { value: number | null | undefined; suffix?: string; invert?: boolean }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const good = invert ? value <= 0 : value >= 0
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", good ? "text-emerald-400" : "text-rose-400")}>
      {value >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  )
}

export function KV({ items, className }: { items: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-dashed border-white/5 pb-2">
          <dt className="shrink-0 text-xs text-muted-foreground">{k}</dt>
          <dd className="min-w-0 truncate text-right text-foreground">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[11px] text-muted-foreground", className)}>{children}</span>
}

export function NoAccess({ what = "this section" }: { what?: string }) {
  return <EmptyState icon={Lock} title="You don't have access" description={`Your admin role can't view ${what}.`} />
}

// ------------------------------------------------------------------------------------------------ tables
export function TableCard({ children, footer, className }: { children: React.ReactNode; footer?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card/70", className)}>
      <div className="[&_td]:py-2 [&_th]:h-9 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase [&_thead_tr]:bg-white/[0.02]">
        {children}
      </div>
      {footer && <div className="border-t px-3 py-2">{footer}</div>}
    </div>
  )
}

export function TableRowsSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} className={cn("h-3", j === 0 ? "w-40" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SortHead({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string
  active: boolean
  dir?: "asc" | "desc"
  onClick: () => void
  className?: string
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown
  return (
    <TableHead className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", active && "text-foreground")}>
        {label}
        <Icon className="size-3" />
      </button>
    </TableHead>
  )
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  fetching,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
  onPageSize?: (n: number) => void
  fetching?: boolean
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
        </span>
        {fetching && <Loader2 className="size-3 animate-spin" aria-label="Loading" />}
      </div>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
            <SelectTrigger size="sm" className="h-7 w-[92px] text-xs" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------------------------- filters
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-3 flex flex-wrap items-center gap-2", className)}>{children}</div>
}

export function SearchBox({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 pr-7 pl-8" aria-label={placeholder} />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export const ALL = "__all__"

export function FilterSelect({
  value,
  onChange,
  options,
  label,
  allLabel,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  label: string
  allLabel?: string
  className?: string
}) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger size="sm" className={cn("h-8 min-w-[140px] text-xs", className)} aria-label={label}>
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel || "All"}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function Field({ label, htmlFor, hint, error, children, className }: {
  label: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground/90">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-rose-400">{error}</p> : hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

// ----------------------------------------------------------------------------------------------- dialogs
/**
 * Confirmation dialog for sensitive/destructive admin actions. Collects a reason (audit-logged server-side).
 * The dialog stays open until `onConfirm` resolves; it closes itself on success.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  reasonRequired = true,
  minReason = 3,
  onConfirm,
  pending,
  confirmText,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  reasonRequired?: boolean
  minReason?: number
  onConfirm: (reason: string) => Promise<unknown>
  pending?: boolean
  /** If set, the admin must type this exact text to enable the confirm button. */
  confirmText?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <ReasonForm
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            destructive={destructive}
            reasonRequired={reasonRequired}
            minReason={minReason}
            confirmText={confirmText}
            pending={pending}
            onCancel={() => onOpenChange(false)}
            onConfirm={async (reason) => {
              try {
                await onConfirm(reason)
                onOpenChange(false)
              } catch {
                /* toast shown by the mutation */
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReasonForm({
  title,
  description,
  confirmLabel,
  destructive,
  reasonRequired,
  minReason,
  confirmText,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string
  description?: React.ReactNode
  confirmLabel: string
  destructive?: boolean
  reasonRequired: boolean
  minReason: number
  confirmText?: string
  pending?: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState("")
  const [typed, setTyped] = useState("")
  const reasonOk = !reasonRequired || reason.trim().length >= minReason
  const typedOk = !confirmText || typed.trim() === confirmText
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (reasonOk && typedOk && !pending) onConfirm(reason.trim())
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <Field
        label={reasonRequired ? "Reason (required, audit-logged)" : "Reason (optional, audit-logged)"}
        htmlFor="admin-reason"
        hint={reasonRequired ? `At least ${minReason} characters.` : undefined}
      >
        <Textarea id="admin-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} autoFocus />
      </Field>
      {confirmText && (
        <Field label={<>Type <span className="font-mono text-rose-300">{confirmText}</span> to confirm</>} htmlFor="admin-confirm-text">
          <Input id="admin-confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={!reasonOk || !typedOk || pending}>
          {pending && <Loader2 className="animate-spin" />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </form>
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
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => Promise<unknown>
  pending?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={async () => {
              try {
                await onConfirm()
                onOpenChange(false)
              } catch {
                /* toast shown by the mutation */
              }
            }}
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// -------------------------------------------------------------------------------------------------- misc
export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  let text: string
  try {
    text = JSON.stringify(value, null, 2)
  } catch {
    text = String(value)
  }
  return (
    <pre className={cn("max-h-80 overflow-auto rounded-lg border bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-signal-100/90", className)}>
      {text ?? "null"}
    </pre>
  )
}

export function BoolDot({ value, on = "Yes", off = "No" }: { value: boolean; on?: string; off?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn("size-1.5 rounded-full", value ? "bg-emerald-400 shadow-[0_0_6px_rgba(118,240,193,0.7)]" : "bg-slate-500")} />
      {value ? on : off}
    </span>
  )
}

export function Meter({ value, max, className }: { value: number; max: number | null; className?: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  const color = pct >= 90 ? "bg-rose-400" : pct >= 70 ? "bg-amber-400" : "bg-signal-400"
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{formatNumber(value)}</span>
        <span>{max === null ? "Unlimited" : formatNumber(max)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className={cn("h-full rounded-full", max === null ? "w-full bg-signal-400/30" : color)} style={max === null ? undefined : { width: `${pct}%` }} />
      </div>
    </div>
  )
}
