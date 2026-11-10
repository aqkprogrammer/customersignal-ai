"use client"
/**
 * Interactive demo: explore sample theme clusters the way the Review Intelligence workspace does.
 * Pure client state over a fixed sample dataset — no API calls, clearly labelled as sample data.
 */
import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { HolographicPanel, SentimentVisualization, TechnicalLabel } from "@/components/signal"
import { cn } from "@/lib/utils"

type Theme = {
  name: string
  share: number
  trend: "Rising" | "Stable" | "New" | "Easing"
  note: string
  weekly: number[]
  sentiment: [number, number, number]
  quotes: string[]
  action: string
  kind: "complaint" | "praise"
}

const THEMES: Theme[] = [
  {
    name: "Long waiting times",
    share: 23,
    trend: "Rising",
    note: "Weekend lunch peak · Marina branch",
    weekly: [9, 11, 10, 12, 14, 13, 16, 18, 17, 20, 22, 23],
    sentiment: [18, 21, 61],
    quotes: ["Waited 40 minutes for a table on Friday.", "Food was great once it came — the wait wasn’t."],
    action: "Add a second host for weekend lunch at Marina; re-check the theme in 4 weeks.",
    kind: "complaint",
  },
  {
    name: "Friendly, attentive staff",
    share: 31,
    trend: "Stable",
    note: "Strongest driver of 5-star ratings",
    weekly: [29, 30, 31, 30, 32, 31, 30, 31, 32, 31, 30, 31],
    sentiment: [88, 9, 3],
    quotes: ["The team remembered our order from last time.", "Staff made my mother feel at home."],
    action: "Name the behaviours in onboarding and feature them in local ads.",
    kind: "praise",
  },
  {
    name: "Booking confirmation confusion",
    share: 9,
    trend: "New",
    note: "Started after the app update",
    weekly: [0, 0, 0, 0, 0, 0, 1, 3, 5, 7, 8, 9],
    sentiment: [12, 30, 58],
    quotes: ["Never got a confirmation after booking in the app.", "Wasn’t sure the booking went through."],
    action: "Send confirmations by SMS and email; add a booking status screen.",
    kind: "complaint",
  },
  {
    name: "Value for money",
    share: 14,
    trend: "Easing",
    note: "Complaints easing since the menu refresh",
    weekly: [24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 15, 14],
    sentiment: [34, 28, 38],
    quotes: ["Portions are better than last year.", "Still a bit pricey for lunch."],
    action: "Keep the refreshed portions; test a weekday lunch set.",
    kind: "complaint",
  },
]

function Spark({ data, tone }: { data: number[]; tone: string }) {
  const reduce = useReducedMotion()
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 300},${70 - (v / max) * 60}`).join(" ")
  return (
    <svg viewBox="0 0 300 76" className="h-20 w-full" aria-hidden>
      {[0, 1, 2].map((i) => (
        <line key={i} x1="0" x2="300" y1={10 + i * 30} y2={10 + i * 30} stroke="var(--foreground)" strokeOpacity="0.07" strokeDasharray="2 4" />
      ))}
      <motion.polyline
        key={pts}
        points={pts}
        fill="none"
        stroke={tone}
        strokeWidth="1.8"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  )
}

export function ThemeExplorer() {
  const [i, setI] = React.useState(0)
  const t = THEMES[i]
  const tone = t.kind === "praise" || t.trend === "Easing" ? "var(--mint)" : "var(--ember)"
  const onKey = (e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp"].includes(e.key)) return
    e.preventDefault()
    const n = (i + (e.key === "ArrowDown" ? 1 : THEMES.length - 1)) % THEMES.length
    setI(n)
    document.getElementById(`theme-tab-${n}`)?.focus()
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
      <div>
        <div className="flex items-center justify-between border-b border-border pb-3">
          <TechnicalLabel>Top themes · last 90 days</TechnicalLabel>
          <TechnicalLabel tone="ember">Sample data</TechnicalLabel>
        </div>
        <div role="tablist" aria-label="Sample themes" aria-orientation="vertical" onKeyDown={onKey}>
          {THEMES.map((th, idx) => {
            const on = idx === i
            return (
              <button
                key={th.name}
                id={`theme-tab-${idx}`}
                role="tab"
                aria-selected={on}
                aria-controls="theme-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setI(idx)}
                className="group relative grid w-full grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-border py-4 text-left focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset"
              >
                {on && <motion.span layoutId="theme-ind" className="absolute inset-y-[-1px] -left-px w-px bg-signal shadow-[0_0_10px_var(--signal)]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                <span className={cn("pl-3 font-mono text-[11px] tabular", on ? "text-signal" : "text-subtle-foreground")}>{String(idx + 1).padStart(2, "0")}</span>
                <span>
                  <span className={cn("block text-[15px] font-medium transition-colors", on ? "text-foreground" : "text-foreground/70 group-hover:text-foreground")}>{th.name}</span>
                  <span className="mt-0.5 block text-[12.5px] text-subtle-foreground">{th.note}</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-[13px] text-foreground/90 tabular">{th.share}%</span>
                  <span className={cn("block font-mono text-[10px] tracking-[0.12em] uppercase", th.kind === "praise" || th.trend === "Easing" ? "text-mint" : "text-ember")}>{th.trend}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div id="theme-panel" role="tabpanel" aria-labelledby={`theme-tab-${i}`} className="text-[14px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={t.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <HolographicPanel label={`Theme · ${t.name}`} status={`${t.share}% of reviews`} statusTone={t.kind === "praise" ? "mint" : "ember"} bodyClassName="space-y-5">
              <div>
                <p className="micro-label">Share of reviews · 12 weeks</p>
                <Spark data={t.weekly} tone={tone} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="micro-label mb-2.5">Sentiment within theme</p>
                  <SentimentVisualization positive={t.sentiment[0]} neutral={t.sentiment[1]} negative={t.sentiment[2]} replayKey={t.name} />
                </div>
                <div>
                  <p className="micro-label mb-2.5">Evidence</p>
                  <ul className="space-y-2">
                    {t.quotes.map((q) => (
                      <li key={q} className="border-l border-signal/40 pl-2.5 text-[13px] leading-snug text-muted-foreground">“{q}”</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
                <div>
                  <p className="micro-label">Suggested action</p>
                  <p className="mt-1.5 text-[14.5px] leading-snug text-foreground">{t.action}</p>
                </div>
                <span className="shrink-0 rounded-[4px] border border-ember/40 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] text-ember uppercase">Needs review</span>
              </div>
            </HolographicPanel>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
