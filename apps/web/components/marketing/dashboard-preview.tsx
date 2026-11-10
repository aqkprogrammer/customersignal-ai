import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

/* All figures below are SAMPLE DATA for an illustrative product preview. */

const KPIS = [
  { label: "Reviews analyzed", value: "4,812", delta: "+12.4%", up: true, good: true },
  { label: "Average rating", value: "3.9", delta: "−0.2", up: false, good: false },
  { label: "Positive sentiment", value: "61%", delta: "+3.1 pts", up: true, good: true },
  { label: "Open opportunities", value: "14", delta: "+5 new", up: true, good: true },
]

// 12 weekly points, share of reviews (0–100)
const POSITIVE = [54, 56, 55, 58, 57, 60, 59, 61, 60, 63, 62, 61]
const NEGATIVE = [26, 25, 27, 24, 25, 23, 24, 22, 24, 21, 22, 23]

export const SAMPLE_CLUSTERS = [
  { label: "Long waiting times", share: 23, trend: "rising" as const },
  { label: "Staff friendliness", share: 17, trend: "stable" as const },
  { label: "Booking & appointments", share: 12, trend: "rising" as const },
  { label: "Pricing transparency", share: 9, trend: "declining" as const },
]

function path(points: number[], w: number, h: number, min = 0, max = 80) {
  const step = w / (points.length - 1)
  return points
    .map((p, i) => {
      const x = i * step
      const y = h - ((p - min) / (max - min)) * h
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

export function SentimentChart({ className, gradientId = "dp-pos" }: { className?: string; gradientId?: string }) {
  const w = 520
  const h = 150
  const pos = path(POSITIVE, w, h)
  const neg = path(NEGATIVE, w, h)
  return (
    <svg viewBox={`0 0 ${w} ${h + 22}`} className={cn("h-auto w-full", className)} role="img" aria-label="Sample sentiment trend over 12 weeks: positive share rising from 54% to 61%, negative share easing from 26% to 23%">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4169F5" stopOpacity="0.22" />
          <stop offset="1" stopColor="#4169F5" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="0" x2={w} y1={(h / 3) * i} y2={(h / 3) * i} stroke="currentColor" strokeOpacity="0.08" />
      ))}
      <path d={`${pos} L${w},${h} L0,${h} Z`} fill={`url(#${gradientId})`} />
      <path d={pos} fill="none" stroke="#4169F5" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <path d={neg} fill="none" stroke="#d14b46" strokeWidth="1.8" strokeDasharray="4 4" strokeLinecap="round" />
      {["W1", "W3", "W5", "W7", "W9", "W12"].map((l, i) => (
        <text key={l} x={(w / 5) * i} y={h + 16} fontSize="10" fill="currentColor" fillOpacity="0.45" textAnchor={i === 0 ? "start" : i === 5 ? "end" : "middle"}>
          {l}
        </text>
      ))}
    </svg>
  )
}

export function ClusterList({ className }: { className?: string }) {
  return (
    <ul className={cn("space-y-3", className)}>
      {SAMPLE_CLUSTERS.map((c) => (
        <li key={c.label}>
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <span className="font-medium text-foreground">{c.label}</span>
            <span className="flex items-center gap-1.5 tabular-nums text-muted-foreground">
              {c.share}%
              <span
                className={cn(
                  "rounded px-1 py-px text-[10px] font-medium",
                  c.trend === "rising" && "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
                  c.trend === "stable" && "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300",
                  c.trend === "declining" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
                )}
              >
                {c.trend}
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", c.trend === "rising" ? "bg-rose-500/80" : "bg-signal-500/70")}
              style={{ width: `${(c.share / 25) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function InsightCard({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-signal-500/20 bg-gradient-to-br from-signal-50 to-ice-50 p-4 dark:from-signal-500/10 dark:to-ice-500/10", className)}>
      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-signal-700 uppercase dark:text-signal-300">
        <Sparkles aria-hidden className="size-3.5" /> AI insight
      </div>
      <p className="mt-2 text-[13px] leading-snug font-medium text-foreground">
        Weekend wait-time complaints rose 38% since the new booking flow launched at the Marina branch.
      </p>
      <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
        Suggested action: add a Saturday 12–3pm staff shift and show live queue times in the booking confirmation.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded-md bg-white/80 px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5 dark:bg-white/10">112 supporting reviews</span>
        <span className="rounded-md bg-white/80 px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5 dark:bg-white/10">High confidence</span>
      </div>
    </div>
  )
}

/** Browser-framed product dashboard preview. Always pair with the "Illustrative preview with sample data" caption. */
export function DashboardPreview({ className }: { className?: string }) {
  return (
    <figure className={cn("relative", className)}>
      <div className="glow overflow-hidden rounded-2xl border bg-card">
        {/* window chrome */}
        <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
          <div aria-hidden className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-rose-400/70" />
            <span className="size-2.5 rounded-full bg-amber-400/70" />
            <span className="size-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <div className="mx-auto hidden rounded-md border bg-background px-3 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
            app.customersignal.ai / overview
          </div>
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            SAMPLE DATA
          </span>
        </div>

        <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[1fr_17rem]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {KPIS.map((k) => (
                <div key={k.label} className="rounded-xl border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">{k.label}</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight tabular-nums sm:text-xl">{k.value}</p>
                  <p className={cn("mt-0.5 flex items-center gap-0.5 text-[11px] font-medium", k.good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {k.up ? <ArrowUpRight aria-hidden className="size-3" /> : <ArrowDownRight aria-hidden className="size-3" />}
                    {k.delta}
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border bg-background p-3 sm:p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">Sentiment trend</p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 rounded bg-signal-600" /> Positive
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 rounded border-t-2 border-dashed border-rose-600" /> Negative
                  </span>
                </div>
              </div>
              <SentimentChart className="text-foreground" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-xl border bg-background p-3 sm:p-4">
              <p className="mb-3 text-[13px] font-semibold">Complaint clusters</p>
              <ClusterList />
            </div>
            <InsightCard />
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">Illustrative preview with sample data</figcaption>
    </figure>
  )
}
