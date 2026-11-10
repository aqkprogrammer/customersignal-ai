"use client"
/**
 * SignalScene — the CustomerSignal story in one composition:
 *   review signals (Google Business Profile, Trustpilot, CSV imports, the Reviews API) travel into the
 *   intelligence core → sentiment is resolved → recurring themes are clustered → an evidence-backed
 *   recommendation waits for human review.
 *
 * Everything shown is ILLUSTRATIVE SAMPLE DATA and is labelled as such. The loop pauses off-screen and
 * holds the final stage under reduced motion.
 *
 * Layout: a fixed-aspect stage in "units" (1 unit = 0.1% of the stage width, via container query units),
 * so HTML panels and SVG connectors stay registered at every width. Below `md` a different, simplified
 * composition is rendered — not a shrunken copy of the desktop one.
 */
import * as React from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"
import { Braces, FileSpreadsheet, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { route, SignalConnector } from "./connector"
import { ReputationIntelligenceCore } from "./core"
import { HolographicPanel, IntelligenceStatus, SentimentVisualization, StatusDot, TechnicalLabel } from "./primitives"

const STAGE_MS = 2700

/* ------------------------------------------------------------------ sample stories */

type SourceKey = "google" | "trustpilot" | "csv" | "api"
type Story = {
  source: SourceKey
  sentiment: [number, number, number]
  theme: { name: string; share: string; trend: "Rising" | "New" | "Stable"; severity: "High" | "Medium" | "Praise"; quote: string; evidence: number }
  rec: { kind: string; text: string }
}

const STORIES: Story[] = [
  {
    source: "google",
    sentiment: [58, 19, 23],
    theme: { name: "Long waiting times", share: "23%", trend: "Rising", severity: "High", quote: "Waited 40 minutes for a table on Friday.", evidence: 412 },
    rec: { kind: "Operational fix", text: "Add a second host for the weekend lunch peak at the Marina branch." },
  },
  {
    source: "csv",
    sentiment: [64, 22, 14],
    theme: { name: "Booking confirmation confusion", share: "9%", trend: "New", severity: "Medium", quote: "Never got a confirmation after booking in the app.", evidence: 96 },
    rec: { kind: "Product fix", text: "Send booking confirmations by SMS and email after the app update." },
  },
  {
    source: "trustpilot",
    sentiment: [49, 30, 21],
    theme: { name: "Late delivery", share: "14%", trend: "Rising", severity: "High", quote: "Late twice this month — packaging was excellent though.", evidence: 188 },
    rec: { kind: "3-star gap", text: "Publish a delivery-time promise; it is the top wish in 3-star reviews." },
  },
  {
    source: "api",
    sentiment: [81, 13, 6],
    theme: { name: "Friendly, attentive staff", share: "31%", trend: "Stable", severity: "Praise", quote: "The team remembered our order from last time.", evidence: 540 },
    rec: { kind: "Strength", text: "Use staff praise in branch onboarding and local ads." },
  },
]

/** One tick per stage; the loop only advances while enabled (on screen, motion allowed). */
function useStoryLoop(enabled: boolean) {
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    if (!enabled) return
    const t = setInterval(() => setTick((n) => n + 1), STAGE_MS)
    return () => clearInterval(t)
  }, [enabled])
  // Before the loop starts (SSR, reduced motion, off-screen at load) show the completed story.
  const started = enabled || tick > 0
  return { tick, stage: started ? tick % 4 : 3, cycle: Math.floor(tick / 4) }
}

/* ------------------------------------------------------------------ panel content */

function GoogleBody({ story }: { story: Story }) {
  const g = story.source === "google"
  return (
    <>
      <div className="flex items-baseline gap-[0.5em]">
        <span className="text-[1.55em] leading-none font-semibold tracking-[-0.03em] tabular">{g ? "2.0" : "4.1"}</span>
        <span className="flex gap-[0.1em] text-ember">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cn("size-[0.85em]", i < (g ? 2 : 4) ? "fill-current" : "opacity-30")} />
          ))}
        </span>
      </div>
      <p className="mt-[0.45em] text-[0.88em] leading-snug text-foreground/85">“{g ? "Waited 40 minutes for a table on Friday — food was great once it came." : "Great brunch, a little noisy on weekends."}”</p>
      <p className="mt-[0.5em] font-mono text-[0.66em] tracking-[0.14em] text-subtle-foreground uppercase">{g ? "New review detected · Marina" : "Synced · official API"}</p>
    </>
  )
}

function CsvBody({ story }: { story: Story }) {
  const on = story.source === "csv"
  return (
    <>
      <p className="flex items-center gap-[0.5em] font-mono text-[0.78em] text-foreground/90">
        <FileSpreadsheet className="size-[1.05em] text-signal" /> branch-reviews-q3.csv
      </p>
      <dl className="mt-[0.55em] grid grid-cols-3 gap-[0.5em] border-t border-border pt-[0.5em]">
        {[
          ["Rows", "2,481"],
          ["Dupes", "37"],
          ["EN / AR", "71 / 29"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="font-mono text-[0.6em] tracking-[0.14em] text-subtle-foreground uppercase">{k}</dt>
            <dd className="mt-[0.15em] font-mono text-[0.86em] text-foreground tabular">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-[0.6em] h-[0.25em] overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--foreground)_8%,transparent)]">
        <motion.div key={String(on)} className="h-full bg-signal" initial={{ width: on ? "8%" : "100%" }} animate={{ width: "100%" }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }} />
      </div>
    </>
  )
}

function SourceChip({ icon, label, detail, active }: { icon: React.ReactNode; label: string; detail: string; active: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-[0.6em] rounded-[0.45em] border bg-[color-mix(in_oklab,var(--card)_60%,transparent)] px-[0.7em] py-[0.5em] backdrop-blur-[6px] transition-[border-color,box-shadow] duration-500",
        active ? "border-[color-mix(in_oklab,var(--signal)_55%,transparent)] shadow-[0_0_24px_-8px_var(--signal)]" : "border-[color-mix(in_oklab,var(--signal)_18%,var(--border))]",
      )}
    >
      <span className={cn("flex size-[1.9em] items-center justify-center rounded-[0.35em] border border-border", active ? "text-signal" : "text-muted-foreground")}>{icon}</span>
      <span className="min-w-0">
        <span className="block font-mono text-[0.7em] tracking-[0.14em] text-foreground/85 uppercase">{label}</span>
        <span className="block truncate font-mono text-[0.64em] tracking-[0.06em] text-subtle-foreground">{detail}</span>
      </span>
      <StatusDot tone={active ? "signal" : "idle"} className="ml-auto" />
    </div>
  )
}

function SentimentPanel({ story, cycle, stage, depth }: { story: Story; cycle: number; stage: number; depth?: "left" | "right" }) {
  const [p, n, neg] = story.sentiment
  return (
    <HolographicPanel depth={depth} label="Sentiment engine" status={stage === 1 ? "Analysing" : "Resolved"} statusTone={stage === 1 ? "signal" : "mint"} active={stage === 1} delay={0.25}>
      <SentimentVisualization positive={p} neutral={n} negative={neg} replayKey={cycle} />
      <p className="mt-[0.6em] flex justify-between font-mono text-[0.64em] tracking-[0.14em] text-subtle-foreground uppercase">
        <span>Lang · EN + AR</span>
        <span>Emotion · {neg > 20 ? "Frustration" : "Delight"}</span>
      </p>
    </HolographicPanel>
  )
}

function ThemePanel({ story, stage, depth }: { story: Story; stage: number; depth?: "left" | "right" }) {
  const t = story.theme
  const praise = t.severity === "Praise"
  return (
    <HolographicPanel depth={depth} label="Theme cluster" status={stage === 2 ? "Clustering" : `${t.evidence} reviews`} statusTone={stage === 2 ? "signal" : "muted"} active={stage === 2} delay={0.35}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={t.name} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }}>
          <p className="text-[1.02em] leading-tight font-medium text-foreground">{t.name}</p>
          <div className="mt-[0.45em] flex flex-wrap gap-[0.4em] font-mono text-[0.64em] tracking-[0.12em] uppercase">
            <span className="rounded-[0.3em] border border-border-strong px-[0.45em] py-[0.1em] text-foreground/80 tabular">{t.share} of reviews</span>
            <span className={cn("rounded-[0.3em] border px-[0.45em] py-[0.1em]", praise ? "border-mint/40 text-mint" : "border-ember/40 text-ember")}>{t.severity}</span>
            <span className="rounded-[0.3em] border border-border-strong px-[0.45em] py-[0.1em] text-muted-foreground">{t.trend}</span>
          </div>
          <p className="mt-[0.55em] border-l border-signal/45 pl-[0.6em] text-[0.82em] leading-snug text-muted-foreground">“{t.quote}”</p>
        </motion.div>
      </AnimatePresence>
    </HolographicPanel>
  )
}

function RecommendationPanel({ story, stage, cycle, depth, showTheme }: { story: Story; stage: number; cycle: number; depth?: "left" | "right"; showTheme?: boolean }) {
  const reduce = useReducedMotion()
  const writing = stage === 3
  return (
    <HolographicPanel
      depth={depth}
      label="AI recommendation"
      status={writing ? "Awaiting review" : showTheme && stage === 2 ? "Clustering" : "Draft"}
      statusTone={writing ? "ember" : showTheme && stage === 2 ? "signal" : "muted"}
      active={writing || (showTheme && stage === 2)}
      delay={0.45}
    >
      <p className="font-mono text-[0.64em] tracking-[0.14em] text-subtle-foreground uppercase">
        {story.rec.kind}
        {showTheme && <> · {story.theme.name} · {story.theme.share}</>}
      </p>
      <motion.p
        key={`${cycle}-${writing}`}
        initial={reduce || !writing ? false : { clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ duration: 1.8, ease: "linear" }}
        className="mt-[0.4em] text-[0.9em] leading-snug text-foreground"
      >
        {story.rec.text}
      </motion.p>
      <div className="mt-[0.6em] flex items-center justify-between border-t border-border pt-[0.5em] font-mono text-[0.64em] tracking-[0.12em] uppercase">
        <span className="text-muted-foreground">Evidence · {story.theme.evidence} reviews</span>
        <span className={cn(writing ? "text-ember" : "text-subtle-foreground")}>Approve · Edit</span>
      </div>
    </HolographicPanel>
  )
}

/* ------------------------------------------------------------------ layouts */

type Pt = [number, number]
type Layout = {
  w: number
  h: number
  core: { left: number; top: number; width: number }
  panels: { key: string; x: number; y: number; w: number }[]
  links: { key: string; d: string; dir: "in" | "out" }[]
}

const HERO: Layout = (() => {
  const L = (from: Pt, to: Pt, via: number) => route(from, to, via)
  return {
    w: 1000,
    h: 640,
    core: { left: 270, top: 52, width: 460 },
    panels: [
      { key: "google", x: 0, y: 26, w: 236 },
      { key: "trustpilot", x: 0, y: 212, w: 180 },
      { key: "csv", x: 0, y: 290, w: 236 },
      { key: "api", x: 0, y: 492, w: 180 },
      { key: "sentiment", x: 764, y: 10, w: 236 },
      { key: "theme", x: 764, y: 194, w: 236 },
      { key: "rec", x: 764, y: 410, w: 236 },
    ],
    links: [
      { key: "google", dir: "in", d: L([236, 42], [378, 146], 326) },
      { key: "trustpilot", dir: "in", d: L([180, 230], [334, 236], 288) },
      { key: "csv", dir: "in", d: L([236, 306], [334, 292], 290) },
      { key: "api", dir: "in", d: L([180, 510], [380, 380], 330) },
      { key: "sentiment", dir: "out", d: L([622, 146], [764, 26], 690) },
      { key: "theme", dir: "out", d: L([667, 280], [764, 210], 716) },
      { key: "rec", dir: "out", d: L([624, 375], [764, 426], 690) },
    ],
  }
})()

const AUTH: Layout = (() => {
  const L = (from: Pt, to: Pt, via: number) => route(from, to, via)
  return {
    w: 640,
    h: 760,
    core: { left: 130, top: 156, width: 380 },
    panels: [
      { key: "google", x: 0, y: 0, w: 250 },
      { key: "sentiment", x: 390, y: 34, w: 250 },
      { key: "csv", x: 0, y: 598, w: 250 },
      { key: "rec", x: 390, y: 584, w: 250 },
    ],
    links: [
      { key: "google", dir: "in", d: L([250, 15], [282, 202], 266) },
      { key: "csv", dir: "in", d: L([250, 613], [282, 458], 266) },
      { key: "sentiment", dir: "out", d: L([358, 202], [390, 49], 374) },
      { key: "rec", dir: "out", d: L([358, 458], [390, 599], 374) },
    ],
  }
})()

const pct = (v: number, of: number) => `${(v / of) * 100}%`

/* ------------------------------------------------------------------ scene */

export function SignalScene({ variant = "hero", className, showStatus = true }: { variant?: "hero" | "auth"; className?: string; showStatus?: boolean }) {
  const reduce = useReducedMotion() ?? false
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-60px" })
  const animate = !reduce
  const { tick, stage, cycle } = useStoryLoop(animate && inView)
  const story = STORIES[cycle % STORIES.length]
  const layout = variant === "auth" ? AUTH : HERO
  const live = animate && inView

  // One packet per stage on the relevant connector (keyed by tick). The core responds when an incoming
  // packet lands (~1s after the stage starts) and when it emits on the analysis stages.
  const activeKey = stage === 0 ? story.source : stage === 1 ? "sentiment" : stage === 2 ? (variant === "auth" ? "rec" : "theme") : "rec"
  const [arrived, setArrived] = React.useState(-1)
  React.useEffect(() => {
    if (!live || stage !== 0) return
    const t = setTimeout(() => setArrived(tick), 1050)
    return () => clearTimeout(t)
  }, [live, stage, tick])
  const pulse = stage === 0 ? arrived : tick

  const panel = (key: string, depth: "left" | "right") => {
    switch (key) {
      case "google":
        return (
          <HolographicPanel depth={depth} label="Google Business Profile" status={stage === 0 && story.source === "google" ? "Signal detected" : "Synced"} statusTone={stage === 0 && story.source === "google" ? "signal" : "muted"} active={stage === 0 && story.source === "google"} delay={0.1}>
            <GoogleBody story={story} />
          </HolographicPanel>
        )
      case "csv":
        return (
          <HolographicPanel depth={depth} label="Review import" status={stage === 0 && story.source === "csv" ? "Validating" : "Validated"} statusTone={stage === 0 && story.source === "csv" ? "signal" : "mint"} active={stage === 0 && story.source === "csv"} delay={0.2}>
            <CsvBody story={story} />
          </HolographicPanel>
        )
      case "trustpilot":
        return <SourceChip icon={<Star className="size-[1em]" />} label="Trustpilot" detail={story.source === "trustpilot" ? "3★ review · approved access" : "Approved access"} active={stage === 0 && story.source === "trustpilot"} />
      case "api":
        return <SourceChip icon={<Braces className="size-[1em]" />} label="Reviews API" detail={story.source === "api" ? "POST /reviews · 202" : "Signed requests"} active={stage === 0 && story.source === "api"} />
      case "sentiment":
        return <SentimentPanel story={story} cycle={cycle} stage={stage} depth={depth} />
      case "theme":
        return <ThemePanel story={story} stage={stage} depth={depth} />
      case "rec":
        return <RecommendationPanel story={story} stage={stage} cycle={cycle} depth={depth} showTheme={variant === "auth"} />
    }
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* ---------------------------------------------------- desktop / tablet stage */}
      <div className="relative hidden w-full [container-type:inline-size] md:block" style={{ aspectRatio: `${layout.w} / ${layout.h}` }}>
        <div className="absolute inset-0" style={{ fontSize: `${(14 / layout.w) * 100}cqw` }}>
          <svg viewBox={`0 0 ${layout.w} ${layout.h}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
            {layout.links.map((l) => (
              <SignalConnector key={l.key} d={l.d} fire={live && activeKey === l.key ? tick + 1 : 0} active={activeKey === l.key} color={l.dir === "in" ? "var(--signal)" : l.key === "rec" ? "var(--ember)" : "var(--mint)"} animate={animate} />
            ))}
            {layout.links.map((l) => {
              const m = /M ([\d.]+) ([\d.]+)/.exec(l.d)
              return m ? <rect key={l.key} x={+m[1] - 2.5} y={+m[2] - 2.5} width="5" height="5" fill="var(--background)" stroke="var(--signal)" strokeOpacity="0.7" /> : null
            })}
          </svg>

          <div className="absolute" style={{ left: pct(layout.core.left, layout.w), top: pct(layout.core.top, layout.h), width: pct(layout.core.width, layout.w) }}>
            <ReputationIntelligenceCore pulseKey={live && pulse >= 0 ? pulse : undefined} />
          </div>

          {layout.panels.map((p) => (
            <div key={p.key} className="absolute" style={{ left: pct(p.x, layout.w), top: pct(p.y, layout.h), width: pct(p.w, layout.w) }}>
              {panel(p.key, p.x < layout.w / 2 ? "left" : "right")}
            </div>
          ))}
        </div>
        {variant === "hero" && (
          <div className="absolute right-0 bottom-0">
            <TechnicalLabel>Illustrative · sample data</TechnicalLabel>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- mobile composition */}
      <div className="md:hidden">
        <div className="relative mx-auto w-[84%] max-w-[340px]">
          <ReputationIntelligenceCore detail="lite" pulseKey={live && pulse >= 0 ? pulse : undefined} />
        </div>
        <div className="mt-2 flex justify-center gap-1.5 font-mono text-[9.5px] tracking-[0.14em] uppercase">
          {(["google", "trustpilot", "csv", "api"] as const).map((s) => (
            <span key={s} className={cn("rounded-[4px] border px-1.5 py-0.5 transition-colors duration-500", story.source === s && stage === 0 ? "border-signal/60 text-signal" : "border-border text-subtle-foreground")}>
              {{ google: "Google", trustpilot: "Trustpilot", csv: "CSV", api: "API" }[s]}
            </span>
          ))}
        </div>
        <div className="mt-4 text-[13px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={stage === 0 ? `src-${story.source}` : `out-${stage}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
              {stage === 0
                ? story.source === "csv"
                  ? panel("csv", "left")
                  : panel("google", "left")
                : stage === 1
                  ? panel("sentiment", "left")
                  : stage === 2
                    ? panel("theme", "left")
                    : panel("rec", "left")}
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="mt-2 text-center">
          <TechnicalLabel>Illustrative · sample data</TechnicalLabel>
        </p>
      </div>

      {showStatus && <IntelligenceStatus active={stage} className="mt-5 justify-center md:justify-start" />}
      {variant === "auth" && (
        <p className="mt-3 hidden md:block">
          <TechnicalLabel>Illustrative · sample data</TechnicalLabel>
        </p>
      )}
    </div>
  )
}
