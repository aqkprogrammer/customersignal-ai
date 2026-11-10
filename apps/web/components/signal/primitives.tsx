"use client"
/**
 * Holographic interface primitives shared by the marketing site, auth, the customer app and the
 * admin console. Colour comes from tokens only; every animation respects reduced motion.
 */
import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

const EASE = [0.22, 1, 0.36, 1] as const

/* ------------------------------------------------------------------ TechnicalLabel */

export function TechnicalLabel({
  children,
  index,
  tone = "muted",
  className,
}: {
  children: React.ReactNode
  index?: string
  tone?: "muted" | "signal" | "mint" | "ember" | "ice"
  className?: string
}) {
  const color = { muted: "text-subtle-foreground", signal: "text-signal", mint: "text-mint", ember: "text-ember", ice: "text-ice" }[tone]
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] uppercase", color, className)}>
      {index && <span className="shrink-0 whitespace-nowrap text-subtle-foreground tabular">{index}</span>}
      {index && <span aria-hidden className="h-px w-5 shrink-0 bg-current opacity-40" />}
      <span>{children}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ StatusDot */

export function StatusDot({ tone = "signal", pulse, className }: { tone?: "signal" | "mint" | "ember" | "ice" | "danger" | "idle"; pulse?: boolean; className?: string }) {
  const c = { signal: "bg-signal", mint: "bg-mint", ember: "bg-ember", ice: "bg-ice", danger: "bg-destructive", idle: "bg-subtle-foreground" }[tone]
  return (
    <span aria-hidden className={cn("relative inline-flex size-1.5 shrink-0", className)}>
      {pulse && <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", c)} />}
      <span className={cn("relative size-1.5 rounded-full shadow-[0_0_8px_currentColor]", c)} />
    </span>
  )
}

/* ------------------------------------------------------------------ HolographicPanel */

/**
 * Translucent operational display: thin signal border, edge light, corner ticks, mono header with a
 * status readout and internal separators. `active` brightens the edge light; `depth` adds a little
 * perspective toward the scene centre.
 */
export function HolographicPanel({
  label,
  status,
  statusTone = "signal",
  active,
  depth,
  className,
  bodyClassName,
  children,
  delay = 0,
}: {
  label: React.ReactNode
  status?: React.ReactNode
  statusTone?: "signal" | "mint" | "ember" | "ice" | "muted"
  active?: boolean
  depth?: "left" | "right"
  className?: string
  bodyClassName?: string
  children?: React.ReactNode
  delay?: number
}) {
  const reduce = useReducedMotion()
  const tone = { signal: "text-signal", mint: "text-mint", ember: "text-ember", ice: "text-ice", muted: "text-subtle-foreground" }[statusTone]
  const panel = (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={cn(
        "relative overflow-hidden rounded-[0.55em] border bg-[color-mix(in_oklab,var(--card)_62%,transparent)] backdrop-blur-[6px] transition-[border-color,box-shadow] duration-500",
        active
          ? "border-[color-mix(in_oklab,var(--signal)_55%,transparent)] shadow-[0_0_0_1px_color-mix(in_oklab,var(--signal)_14%,transparent),0_18px_48px_-20px_color-mix(in_oklab,var(--signal)_55%,transparent)]"
          : "border-[color-mix(in_oklab,var(--signal)_20%,var(--border))] shadow-[0_18px_44px_-24px_rgb(0_0_0/0.9)]",
        className,
      )}
    >
      {/* edge light */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--signal)_75%,transparent),transparent)] opacity-70" />
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,color-mix(in_oklab,var(--signal)_7%,transparent),transparent_42%)]" />
      {/* corner ticks */}
      <span aria-hidden className="pointer-events-none absolute top-[0.4em] right-[0.4em] size-[0.55em] border-t border-r border-[color-mix(in_oklab,var(--signal)_60%,transparent)]" />
      <span aria-hidden className="pointer-events-none absolute bottom-[0.4em] left-[0.4em] size-[0.55em] border-b border-l border-[color-mix(in_oklab,var(--signal)_35%,transparent)]" />
      <div className="relative flex items-center justify-between gap-[0.8em] border-b border-[color-mix(in_oklab,var(--signal)_13%,var(--border))] px-[0.85em] py-[0.55em]">
        <span className="truncate font-mono text-[0.72em] tracking-[0.16em] text-foreground/85 uppercase">{label}</span>
        {status && (
          <span className={cn("flex shrink-0 items-center gap-[0.4em] font-mono text-[0.66em] tracking-[0.14em] uppercase", tone)}>
            <span className="size-[0.45em] rounded-full bg-current shadow-[0_0_6px_currentColor]" />
            {status}
          </span>
        )}
      </div>
      {children != null && <div className={cn("relative px-[0.85em] py-[0.7em]", bodyClassName)}>{children}</div>}
    </motion.div>
  )
  if (!depth) return panel
  // Perspective sits on a wrapper so Motion's entrance transform doesn't override it.
  return <div style={{ transform: `perspective(1400px) rotateY(${depth === "left" ? 6 : -6}deg)` }}>{panel}</div>
}

/* ------------------------------------------------------------------ SentimentVisualization */

export function SentimentVisualization({
  positive,
  neutral,
  negative,
  className,
  replayKey,
}: {
  positive: number
  neutral: number
  negative: number
  className?: string
  replayKey?: React.Key
}) {
  const reduce = useReducedMotion()
  const rows = [
    { label: "Positive", value: positive, bar: "bg-mint", text: "text-mint" },
    { label: "Neutral", value: neutral, bar: "bg-ice", text: "text-ice" },
    { label: "Negative", value: negative, bar: "bg-ember", text: "text-ember" },
  ]
  return (
    <div className={cn("space-y-[0.45em]", className)}>
      {rows.map((r, i) => (
        <div key={r.label} className="grid grid-cols-[5.4em_1fr_2.8em] items-center gap-[0.6em]">
          <span className="font-mono text-[0.72em] tracking-[0.12em] text-muted-foreground uppercase">{r.label}</span>
          <span className="relative h-[0.38em] overflow-hidden rounded-[2px] bg-[color-mix(in_oklab,var(--foreground)_8%,transparent)]">
            <motion.span
              key={replayKey}
              className={cn("absolute inset-y-0 left-0 rounded-[2px] shadow-[0_0_8px_currentColor]", r.bar, r.text)}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(100, r.value))}%` }}
              transition={{ duration: 1, delay: 0.12 * i, ease: EASE }}
            />
          </span>
          <span className={cn("text-right font-mono text-[0.8em] tabular", r.text)}>{Math.round(r.value)}%</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ IntelligenceStatus */

export const PIPELINE = ["Signal ingestion", "Sentiment analysis", "Theme clustering", "Opportunity ready"] as const

/** Pipeline stage readout. `active` is the current stage; earlier stages read as complete. */
export function IntelligenceStatus({
  active,
  stages = [...PIPELINE],
  className,
  counts,
}: {
  active: number
  stages?: string[]
  className?: string
  /** Optional real counts per stage (dashboard/admin use). */
  counts?: (string | number | null | undefined)[]
}) {
  return (
    <ol className={cn("flex flex-wrap gap-x-5 gap-y-2", className)} aria-label="Intelligence pipeline">
      {stages.map((s, i) => {
        const state = i < active ? "done" : i === active ? "active" : "idle"
        return (
          <li
            key={s}
            aria-current={state === "active" ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] uppercase transition-colors duration-500",
              state === "active" && "text-signal",
              state === "done" && "text-foreground/70",
              state === "idle" && "text-subtle-foreground",
            )}
          >
            <span className="tabular text-subtle-foreground">{String(i + 1).padStart(2, "0")}</span>
            <span className={cn("h-px w-3 bg-current transition-[width] duration-500", state === "active" && "w-6 shadow-[0_0_6px_currentColor]")} />
            {s}
            {counts?.[i] != null && <span className="text-foreground tabular">{counts[i]}</span>}
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------ Backgrounds */

/** Fine technical grid with sparse “+” registration marks (no fake coordinates). */
export function AmbientGrid({ className, markers = true, fade = true }: { className?: string; markers?: boolean; fade?: boolean }) {
  const pid = `cs-plus-${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const mask = fade ? "[mask-image:radial-gradient(ellipse_85%_70%_at_55%_40%,#000_30%,transparent_100%)]" : undefined
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <div className={cn("bg-tech-grid absolute inset-0", mask)} />
      {markers && (
        <svg className={cn("absolute inset-0 size-full text-[color-mix(in_oklab,var(--signal)_42%,transparent)]", mask)}>
          <defs>
            <pattern id={pid} width="256" height="256" patternUnits="userSpaceOnUse">
              <path d="M128 123v10M123 128h10" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${pid})`} />
        </svg>
      )}
    </div>
  )
}

/** Deep cinematic backdrop: one ambient light source, technical grid, a slow scan line and grain. */
export function CinematicBackground({ className, scan = true, light = "right" }: { className?: string; scan?: boolean; light?: "right" | "center" | "left" }) {
  const pos = { right: "72%_36%", center: "50%_40%", left: "28%_40%" }[light]
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(60% 55% at ${pos.replace("_", " ")}, color-mix(in oklab, var(--signal) 11%, transparent), transparent 70%)` }}
      />
      <AmbientGrid />
      {scan && (
        <div className="absolute inset-x-0 top-0 h-full motion-safe:animate-[cs-scanline_14s_linear_infinite] motion-reduce:hidden">
          <div className="h-px w-full bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--signal)_38%,transparent),transparent)]" />
          <div className="h-20 w-full bg-[linear-gradient(180deg,color-mix(in_oklab,var(--signal)_4%,transparent),transparent)]" />
        </div>
      )}
      <div className="bg-noise absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_55%,var(--background)_100%)]" />
    </div>
  )
}
