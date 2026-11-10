import { ArrowDownRight, ArrowRight, ArrowUpRight, Sparkle } from "lucide-react"
import { cn, titleCase } from "@/lib/utils"

const tone = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300",
  red: "bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-500/10 dark:text-slate-300",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300",
  signal: "bg-signal-50 text-signal-700 ring-signal-600/15 dark:bg-signal-500/10 dark:text-signal-300",
  ice: "bg-ice-50 text-ice-700 ring-ice-600/15 dark:bg-ice-500/10 dark:text-ice-300",
  sky: "bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300",
} as const
export type Tone = keyof typeof tone

export function Pill({ children, color = "gray", className }: { children: React.ReactNode; color?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", tone[color], className)}>
      {children}
    </span>
  )
}

export function SentimentBadge({ sentiment }: { sentiment: string | null | undefined }) {
  if (!sentiment) return <Pill color="gray">Pending</Pill>
  const c: Tone = sentiment === "positive" ? "green" : sentiment === "negative" ? "red" : "gray"
  return <Pill color={c}>{titleCase(sentiment)}</Pill>
}

const STATUS_TONES: Record<string, Tone> = {
  completed: "green", ready: "green", active: "green", connected: "green", succeeded: "green", paid: "green",
  converted: "green", resolved: "green", accepted: "green",
  processing: "signal", generating: "signal", analyzing: "signal", in_progress: "signal", contacted: "signal",
  trialing: "ice", researched: "ice", replied: "ice", meeting_booked: "sky", planned: "sky",
  pending: "amber", open: "amber", waiting_on_customer: "amber", past_due: "amber", requires_approval: "amber",
  new: "sky", warning: "amber",
  failed: "red", error: "red", canceled: "red", cancelled: "red", suspended: "red", banned: "red", critical: "red",
  not_interested: "gray", archived: "gray", disconnected: "gray", closed: "gray", expired: "gray", revoked: "gray",
  dismissed: "gray", info: "sky", done: "green",
  sent: "green", success: "green", logged: "gray", draft: "gray", void: "gray", deleted: "gray",
  refunded: "amber", partially_refunded: "amber", uncollectible: "red",
}

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return null
  return (
    <Pill color={STATUS_TONES[status] || "gray"} className={className}>
      {titleCase(status)}
    </Pill>
  )
}

/** For complaints, rising is bad (red); pass positive for praise themes where rising is good. */
export function TrendBadge({ trend, positive = false }: { trend: string; positive?: boolean }) {
  if (trend === "rising")
    return (
      <Pill color={positive ? "green" : "red"}>
        <ArrowUpRight className="size-3" /> Rising
      </Pill>
    )
  if (trend === "declining")
    return (
      <Pill color={positive ? "amber" : "green"}>
        <ArrowDownRight className="size-3" /> Declining
      </Pill>
    )
  if (trend === "new")
    return (
      <Pill color="ice">
        <Sparkle className="size-3" /> New
      </Pill>
    )
  return (
    <Pill color="gray">
      <ArrowRight className="size-3" /> Stable
    </Pill>
  )
}

export function SeverityMeter({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  const color = v >= 66 ? "bg-rose-500" : v >= 40 ? "bg-amber-500" : "bg-emerald-500"
  return (
    <div className="flex items-center gap-2" aria-label={`Severity ${Math.round(v)} of 100`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${v}%` }} />
      </div>
      <span className="w-7 text-xs tabular-nums text-muted-foreground">{Math.round(v)}</span>
    </div>
  )
}

export function Stars({ rating, className }: { rating: number | null | undefined; className?: string }) {
  if (rating === null || rating === undefined) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-amber-500", className)} aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={cn("size-3.5", i < Math.round(rating) ? "fill-current" : "fill-muted")}>
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  )
}
