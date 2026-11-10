"use client"
/**
 * Aurora data-visualization primitives shared by the marketing site, auth, the customer app and admin.
 * Readable first: real type sizes, labelled values, and colour that always carries meaning.
 */
import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { TONE_HEX, TONE_TEXT, type Tone } from "./data"

const EASE = [0.22, 1, 0.36, 1] as const

/* ------------------------------------------------------------------ Label */

/** Small uppercase metadata label with an optional coloured dot. */
export function Label({ children, tone, className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.1em] text-subtle-foreground uppercase", className)}>
      {tone && <span aria-hidden className="size-1.5 rounded-full" style={{ background: TONE_HEX[tone] }} />}
      {children}
    </span>
  )
}

/** "Sample data" tag — used on every illustrative visual. */
export function SampleTag({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border border-[#ffb48f]/60 bg-[#fff3ec] px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.08em] text-[#b6461a] uppercase dark:border-orange/30 dark:bg-orange/10 dark:text-orange", className)}>
      Sample data
    </span>
  )
}

/* ------------------------------------------------------------------ SentimentDistribution */

export function SentimentDistribution({
  positive,
  neutral,
  negative,
  variant = "stacked",
  className,
  replayKey,
}: {
  positive: number
  neutral: number
  negative: number
  variant?: "stacked" | "bars"
  className?: string
  replayKey?: React.Key
}) {
  const reduce = useReducedMotion()
  const total = Math.max(1, positive + neutral + negative)
  const rows = [
    { label: "Positive", value: positive, color: "#9BD24A", text: "text-positive" },
    { label: "Neutral", value: neutral, color: "#92C9FF", text: "text-ice" },
    { label: "Negative", value: negative, color: "#FF8757", text: "text-ember" },
  ]
  if (variant === "bars") {
    return (
      <div className={cn("space-y-2.5", className)}>
        {rows.map((r, i) => (
          <div key={r.label} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3">
            <span className="text-[13px] text-muted-foreground">{r.label}</span>
            <span className="relative h-2 overflow-hidden rounded-full bg-foreground/[0.07]">
              <motion.span
                key={replayKey}
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: r.color }}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${(r.value / total) * 100}%` }}
                transition={{ duration: 0.9, delay: 0.1 * i, ease: EASE }}
              />
            </span>
            <span className={cn("text-right text-[13px] font-semibold tabular-nums", r.text)}>{Math.round((r.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className={className}>
      <div className="flex h-3 overflow-hidden rounded-full bg-foreground/[0.06]" role="img" aria-label={`Sentiment: ${Math.round((positive / total) * 100)}% positive, ${Math.round((neutral / total) * 100)}% neutral, ${Math.round((negative / total) * 100)}% negative`}>
        {rows.map((r, i) => (
          <motion.span
            key={`${r.label}-${String(replayKey ?? "")}`}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ background: r.color }}
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${(r.value / total) * 100}%` }}
            transition={{ duration: 0.9, delay: 0.08 * i, ease: EASE }}
          />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <span aria-hidden className="size-2 rounded-full" style={{ background: r.color }} />
              {r.label}
            </dt>
            <dd className="mt-0.5 text-[17px] font-semibold tracking-tight tabular-nums">{Math.round((r.value / total) * 100)}%</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ------------------------------------------------------------------ OpportunityIndicator */

/** Score ring 0–100. Orange is reserved for opportunity. */
export function OpportunityIndicator({ score, size = 56, tone = "orange", label = "Score" }: { score: number; size?: number; tone?: Tone; label?: string }) {
  const reduce = useReducedMotion()
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 56 56" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeOpacity="0.09" strokeWidth="5" />
        <motion.circle
          key={score}
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={TONE_HEX[tone]}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1, ease: EASE }}
        />
      </svg>
      <span className="relative text-center leading-none">
        <span className="block text-[15px] font-semibold tabular-nums">{score}</span>
        <span className="sr-only">{label}</span>
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------ InsightCard */

export function InsightCard({
  tone = "cobalt",
  eyebrow,
  title,
  body,
  meta,
  aside,
  footer,
  className,
  interactive,
  active,
  onClick,
}: {
  tone?: Tone
  eyebrow: React.ReactNode
  title: React.ReactNode
  body?: React.ReactNode
  meta?: React.ReactNode
  aside?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  interactive?: boolean
  active?: boolean
  onClick?: () => void
}) {
  const Comp = interactive ? motion.button : motion.div
  return (
    <Comp
      type={interactive ? "button" : undefined}
      onClick={onClick}
      aria-pressed={interactive ? active : undefined}
      whileHover={interactive ? { y: -3 } : undefined}
      whileTap={interactive ? { scale: 0.985 } : undefined}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border bg-card p-5 text-left shadow-[0_1px_2px_rgb(23_32_51/0.04),0_14px_34px_-18px_rgb(23_32_51/0.22)] transition-[border-color,box-shadow]",
        interactive && "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        active ? "border-transparent" : "border-border",
        className,
      )}
      style={active ? { boxShadow: `0 0 0 2px ${TONE_HEX[tone]}, 0 18px 40px -18px ${TONE_HEX[tone]}88` } : undefined}
    >
      <span aria-hidden className="absolute inset-y-4 left-0 w-1 rounded-r-full" style={{ background: TONE_HEX[tone] }} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={cn("text-[12px] font-semibold tracking-[0.06em] uppercase", TONE_TEXT[tone])}>{eyebrow}</p>
          <p className="mt-1.5 text-[17px] leading-snug font-semibold tracking-[-0.01em] text-foreground">{title}</p>
        </div>
        {aside}
      </div>
      {body && <div className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground">{body}</div>}
      {meta && <div className="mt-3 flex flex-wrap gap-1.5">{meta}</div>}
      {footer && <div className="mt-4 border-t border-border pt-3 text-[13px] text-muted-foreground">{footer}</div>}
    </Comp>
  )
}

export function Chip({ children, tone }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium", tone ? TONE_TEXT[tone] : "text-muted-foreground")}
      style={tone ? { borderColor: `${TONE_HEX[tone]}55`, background: `${TONE_HEX[tone]}14` } : undefined}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ StatusDot */

const DOT: Record<string, string> = { cobalt: "#4169F5", orange: "#FF8757", lime: "#8FCB3F", sky: "#5FA8F0", danger: "#D8463F", idle: "#A3AAB8" }

export function StatusDot({ tone = "cobalt", pulse, className }: { tone?: keyof typeof DOT; pulse?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-flex size-2 shrink-0", className)}>
      {pulse && <span className="absolute inset-0 rounded-full opacity-50 motion-safe:animate-ping" style={{ background: DOT[tone] }} />}
      <span className="relative size-2 rounded-full" style={{ background: DOT[tone] }} />
    </span>
  )
}

/* ------------------------------------------------------------------ PipelineSteps */

/** Connected pipeline readout. `active` is the current stage; earlier ones read as complete. Counts are real data. */
export function PipelineSteps({ stages, active, counts, className }: { stages: string[]; active: number; counts?: React.ReactNode[]; className?: string }) {
  return (
    <ol className={cn("grid gap-2", className)} style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }} aria-label="Intelligence pipeline">
      {stages.map((s, i) => {
        const done = i < active
        const on = i === active
        return (
          <li key={s} aria-current={on ? "step" : undefined} className="min-w-0">
            <span className={cn("block h-1.5 rounded-full", done ? "bg-[#4169F5]" : on ? "bg-[#FF8757]" : "bg-foreground/10")} />
            <span className="mt-2 block truncate text-[12px] text-muted-foreground">{s}</span>
            {counts?.[i] != null && <span className="block text-[17px] font-semibold tracking-tight tabular-nums">{counts[i]}</span>}
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------ SignalEmblem */

/** Compact animated network: sources converging on one insight. Decorative. */
export function SignalEmblem({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  const src: [number, number, string][] = [
    [18, 22, "#4169F5"],
    [14, 60, "#FF8757"],
    [22, 98, "#9BD24A"],
    [52, 12, "#92C9FF"],
    [56, 108, "#4169F5"],
  ]
  return (
    <svg viewBox="0 0 140 120" className={className} aria-hidden>
      {src.map(([x, y], i) => {
        const d = `M ${x} ${y} C 80 ${y}, 86 60, 112 60`
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="currentColor" strokeOpacity="0.14" />
            {!reduce && (
              <circle r="2.2" fill={src[i][2]}>
                <animateMotion dur={`${2.2 + i * 0.35}s`} begin={`${-i * 0.4}s`} repeatCount="indefinite" path={d} />
              </circle>
            )}
          </g>
        )
      })}
      {src.map(([x, y, c], i) => (
        <circle key={`n${i}`} cx={x} cy={y} r={i % 2 ? 4 : 5.5} fill={c} />
      ))}
      <circle cx="112" cy="60" r="16" fill="#4169F5" fillOpacity="0.16" />
      <circle cx="112" cy="60" r="8" fill="#FF8757" />
    </svg>
  )
}
