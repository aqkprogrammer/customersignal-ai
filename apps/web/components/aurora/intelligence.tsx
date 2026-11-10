"use client"
/**
 * IntelligenceVisualization — the hero/auth composition around CustomerSignalMap:
 * a canvas with the live network, plus two insight cards that always describe the selected cluster
 * (its evidence and its sentiment). Below `md` a purpose-built compact layout is used: a tappable row of
 * cluster bubbles and the insight card — not a shrunken copy of the desktop map.
 */
import * as React from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { CLUSTERS, OPPORTUNITIES, TONE_HEX } from "./data"
import { CustomerSignalMap } from "./signal-map"
import { Chip, InsightCard, Label, OpportunityIndicator, SampleTag, SentimentDistribution } from "./viz"

function useTour(enabled: boolean, ids: string[], ms = 4200) {
  const [i, setI] = React.useState(1)
  React.useEffect(() => {
    if (!enabled) return
    const t = setInterval(() => setI((n) => (n + 1) % ids.length), ms)
    return () => clearInterval(t)
  }, [enabled, ids.length, ms])
  return [ids[i], (id: string) => setI(ids.indexOf(id))] as const
}

function ClusterInsight({ id, compact }: { id: string; compact?: boolean }) {
  const c = CLUSTERS.find((x) => x.id === id)!
  const o = OPPORTUNITIES.find((x) => x.from === id)
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
        <InsightCard
          tone={o?.tone ?? c.tone}
          eyebrow={o ? `Opportunity · ${o.kind}` : "Theme"}
          title={o ? o.title : c.name}
          aside={o ? <OpportunityIndicator score={o.score} size={compact ? 48 : 54} tone={o.tone} /> : undefined}
          body={<>“{c.quote}”</>}
          meta={
            <>
              <Chip tone={c.tone}>{c.name}</Chip>
              <Chip>{c.share}% of reviews</Chip>
              <Chip>{c.reviews} reviews of evidence</Chip>
            </>
          }
        />
      </motion.div>
    </AnimatePresence>
  )
}

export function IntelligenceVisualization({ className, tone = "light" }: { className?: string; tone?: "light" | "navy" }) {
  const reduce = useReducedMotion() ?? false
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-40px" })
  const [selected, setSelected] = React.useState(CLUSTERS[1].id)
  const [mobileSel, setMobileSel] = useTour(!reduce && inView, CLUSTERS.map((c) => c.id))
  const c = CLUSTERS.find((x) => x.id === selected)!

  return (
    <div ref={ref} className={cn("light relative text-foreground", className)}>
      {/* ---------------------------------------------------- desktop / tablet */}
      <div className="relative hidden md:block">
        <div
          className={cn(
            "relative overflow-hidden rounded-[28px] border p-5 pb-24 lg:p-6 lg:pb-28",
            tone === "light"
              ? "border-border bg-white shadow-[0_2px_4px_rgb(23_32_51/0.03),0_40px_80px_-40px_rgb(23_32_51/0.3)]"
              : "border-white/10 bg-[#17243B]",
          )}
        >
          <div aria-hidden className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_75%_70%_at_50%_45%,#000_40%,transparent_100%)]" />
          <div className="relative flex items-center justify-between gap-3">
            <Label tone="cobalt">Customer signal map</Label>
            <SampleTag />
          </div>
          <CustomerSignalMap className="relative mt-2" selected={selected} onSelect={setSelected} />
        </div>
        {/* overlay cards anchored to the canvas edge */}
        <div className="absolute -bottom-10 left-6 w-[38%] min-w-[230px] text-left lg:-left-8">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_14px_34px_-18px_rgb(23_32_51/0.3)]">
            <div className="flex items-center justify-between">
              <Label>Sentiment · {c.name}</Label>
            </div>
            <SentimentDistribution className="mt-3" positive={c.mix[0]} neutral={c.mix[1]} negative={c.mix[2]} replayKey={c.id} />
          </div>
        </div>
        <div className="absolute right-6 -bottom-12 w-[48%] min-w-[280px] lg:-right-6">
          <ClusterInsight id={selected} />
        </div>
      </div>

      {/* ---------------------------------------------------- mobile */}
      <div className="md:hidden">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-white p-4 shadow-[0_30px_60px_-36px_rgb(23_32_51/0.35)]">
          <div className="flex items-center justify-between">
            <Label tone="cobalt">Signal map</Label>
            <SampleTag />
          </div>
          <svg viewBox="0 0 340 170" className="mt-3 w-full" aria-hidden>
            {CLUSTERS.map((cl, i) => {
              const x = 38 + i * 66
              const y = i % 2 ? 108 : 78
              const r = cl.r * 0.42
              const on = cl.id === mobileSel
              return (
                <g key={cl.id} style={{ opacity: on ? 1 : 0.45, transition: "opacity .4s" }}>
                  <path d={`M ${x} 0 C ${x} 30, ${x} 40, ${x} ${y - r}`} fill="none" stroke="var(--foreground)" strokeOpacity="0.12" />
                  {!reduce && on && (
                    <circle r="3" fill="#4169F5">
                      <animateMotion dur="1.6s" repeatCount="indefinite" path={`M ${x} 0 C ${x} 30, ${x} 40, ${x} ${y - r}`} />
                    </circle>
                  )}
                  <circle cx={x} cy={y} r={r} fill={TONE_HEX[cl.tone]} fillOpacity={on ? 0.22 : 0.12} stroke={TONE_HEX[cl.tone]} strokeWidth={on ? 1.6 : 1} />
                  <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--foreground)">{cl.share}%</text>
                </g>
              )
            })}
          </svg>
          <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Sample themes">
            {CLUSTERS.map((cl) => (
              <button
                key={cl.id}
                type="button"
                onClick={() => setMobileSel(cl.id)}
                aria-pressed={cl.id === mobileSel}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                  cl.id === mobileSel ? "border-[#4169F5] bg-[#eef2ff] text-[#2641b5]" : "border-border text-muted-foreground",
                )}
              >
                {cl.name}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <ClusterInsight id={mobileSel} compact />
        </div>
      </div>
    </div>
  )
}

/** Small "explore" link style used under visualizations. */
export function ExploreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="group inline-flex items-center gap-1 text-[14px] font-semibold text-[#2f52dd] hover:underline">
      {children} <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </a>
  )
}
