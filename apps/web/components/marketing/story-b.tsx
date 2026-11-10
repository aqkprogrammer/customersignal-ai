"use client"
/**
 * Homepage story, part B: 04 intelligence engine · 05 opportunity discovery · 06 competitive intelligence ·
 * 07 reports & exports. Sample data throughout, labelled.
 */
import * as React from "react"
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from "motion/react"
import { BellRing, Check, Download, Link2, Mail, Webhook } from "lucide-react"
import { COMPETITORS, Chip, InsightCard, Label, OpportunityIndicator, SampleTag, TONE_HEX, type Tone } from "@/components/aurora"
import { cn } from "@/lib/utils"
import { Reveal } from "./motion"
import { Container, Eyebrow, SectionHeader } from "./section"

const EASE = [0.22, 1, 0.36, 1] as const

/* ================================================================== 04 · INTELLIGENCE ENGINE (navy) */

const WEEKS = [42, 45, 44, 50, 53, 51, 57, 60, 58, 63, 61, 62]
const NEG = [21, 20, 22, 19, 18, 20, 17, 16, 18, 15, 17, 17]
const EMOTIONS: { k: string; v: number; tone: Tone }[] = [
  { k: "Joy", v: 38, tone: "lime" },
  { k: "Trust", v: 27, tone: "sky" },
  { k: "Frustration", v: 19, tone: "orange" },
  { k: "Disappointment", v: 11, tone: "orange" },
  { k: "Surprise", v: 5, tone: "cobalt" },
]
const TOPICS = [
  { k: "Weekend wait", d: "+18%", up: true },
  { k: "App booking", d: "New", up: true },
  { k: "Portion size", d: "−9%", up: false },
  { k: "Outdoor seating", d: "+6%", up: true },
  { k: "Parking", d: "+3%", up: true },
]
const RATINGS = [6, 9, 14, 29, 42]

function line(data: number[], w: number, h: number, max: number) {
  return data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ")
}

export function EngineSection() {
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-120px" })
  const reduce = useReducedMotion()
  const draw = inView || reduce
  return (
    <section aria-labelledby="engine-heading" className="dark relative overflow-hidden bg-background py-20 text-foreground sm:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-dots absolute inset-0 opacity-70" />
        <div className="absolute -top-40 left-1/3 size-[620px] rounded-full bg-[radial-gradient(closest-side,rgb(65_105_245/0.32),transparent)]" />
        <div className="absolute right-[-10%] bottom-[-20%] size-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(255_135_87/0.14),transparent)]" />
      </div>
      <Container className="relative">
        <Reveal className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Eyebrow index="04">Intelligence engine</Eyebrow>
            <h2 id="engine-heading" className="mt-5 text-[2.3rem] leading-[1.04] font-semibold tracking-[-0.045em] text-balance text-white sm:text-[3.25rem]">
              Raw feedback in. Structured intelligence out.
            </h2>
          </div>
          <p className="text-[17px] leading-relaxed text-muted-foreground lg:col-span-4 lg:col-start-9 lg:pb-2">
            Every review is scored for sentiment, emotion, category and severity, then rolled up into topics and trends you can
            filter by location, platform and date.
          </p>
        </Reveal>

        <div ref={ref} className="mt-14 grid gap-4 lg:grid-cols-12">
          {/* trend */}
          <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label>Sentiment trend · 12 weeks</Label>
              <div className="flex gap-4 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-lime" /> Positive %</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-orange" /> Negative %</span>
              </div>
            </div>
            <svg viewBox="0 0 600 200" className="mt-6 h-auto w-full overflow-visible" role="img" aria-label="Positive sentiment rose from 42% to 62% over 12 weeks while negative fell from 21% to 17% (sample data)">
              <defs>
                <linearGradient id="eng-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B7E66B" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#B7E66B" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map((i) => (
                <line key={i} x1="0" x2="600" y1={i * 66} y2={i * 66} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 6" />
              ))}
              <motion.polygon points={`0,200 ${line(WEEKS, 600, 200, 70)} 600,200`} fill="url(#eng-area)" initial={{ opacity: 0 }} animate={{ opacity: draw ? 1 : 0 }} transition={{ duration: 1, delay: 0.4 }} />
              <motion.polyline points={line(WEEKS, 600, 200, 70)} fill="none" stroke="#B7E66B" strokeWidth="3" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: draw ? 1 : 0 }} transition={{ duration: 1.2, ease: EASE }} />
              <motion.polyline points={line(NEG, 600, 200, 70)} fill="none" stroke="#FF8757" strokeWidth="3" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: draw ? 1 : 0 }} transition={{ duration: 1.2, delay: 0.2, ease: EASE }} />
            </svg>
            <div className="mt-3 flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>Week 1</span>
              <span>Week 12</span>
            </div>
          </div>

          {/* emotions */}
          <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-5">
            <Label>Customer emotions</Label>
            <ul className="mt-5 space-y-3.5">
              {EMOTIONS.map((e, i) => (
                <li key={e.k} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3">
                  <span className="text-[14.5px]">{e.k}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.span className="block h-full rounded-full" style={{ background: TONE_HEX[e.tone] }} initial={{ width: 0 }} animate={{ width: draw ? `${(e.v / 40) * 100}%` : 0 }} transition={{ duration: 0.9, delay: 0.1 * i, ease: EASE }} />
                  </span>
                  <span className="text-right text-[14px] font-semibold tabular-nums">{e.v}%</span>
                </li>
              ))}
            </ul>
          </div>

          {/* emerging topics */}
          <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-4">
            <Label>Emerging topics</Label>
            <ul className="mt-5 flex flex-wrap gap-2">
              {TOPICS.map((t, i) => (
                <motion.li
                  key={t.k}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.04] px-3 py-1.5 text-[14px]"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: draw ? 1 : 0, scale: draw ? 1 : 0.9 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                >
                  {t.k}
                  <span className={cn("text-[12.5px] font-semibold", t.up ? "text-orange" : "text-lime")}>{t.d}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* complaint clusters */}
          <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-4">
            <Label>Complaint clusters</Label>
            <svg viewBox="0 0 300 150" className="mt-4 h-auto w-full" role="img" aria-label="Complaint clusters sized by share: wait time 23%, delivery 14%, value 11%, booking 9% (sample data)">
              {[
                { x: 88, y: 76, r: 62, t: "Wait time", v: "23%", c: "#FF8757" },
                { x: 196, y: 58, r: 42, t: "Delivery", v: "14%", c: "#FF8757" },
                { x: 252, y: 112, r: 32, t: "Value", v: "11%", c: "#92C9FF" },
                { x: 182, y: 124, r: 26, t: "Booking", v: "9%", c: "#6C8BF8" },
              ].map((b, i) => (
                <motion.g key={b.t} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: draw ? 1 : 0.4, opacity: draw ? 1 : 0 }} transition={{ type: "spring", stiffness: 200, damping: 18, delay: i * 0.08 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                  <circle cx={b.x} cy={b.y} r={b.r} fill={b.c} fillOpacity="0.18" stroke={b.c} strokeWidth="1.5" />
                  <text x={b.x} y={b.y - 2} textAnchor="middle" fontSize={b.r > 35 ? 13 : 10.5} fontWeight="600" fill="currentColor">{b.t}</text>
                  <text x={b.x} y={b.y + 13} textAnchor="middle" fontSize={b.r > 35 ? 12 : 10} fill="currentColor" opacity="0.7">{b.v}</text>
                </motion.g>
              ))}
            </svg>
          </div>

          {/* review distribution */}
          <div className="rounded-3xl border border-border bg-card p-6 lg:col-span-4">
            <Label>Review distribution</Label>
            <div className="mt-5 flex h-[130px] items-end gap-3">
              {RATINGS.map((v, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[12.5px] font-semibold tabular-nums">{v}%</span>
                  <motion.span
                    className="w-full rounded-t-lg"
                    style={{ background: i < 2 ? "#FF8757" : i === 2 ? "#92C9FF" : "#B7E66B" }}
                    initial={{ height: 0 }}
                    animate={{ height: draw ? `${(v / 42) * 90}px` : 0 }}
                    transition={{ duration: 0.8, delay: i * 0.07, ease: EASE }}
                  />
                  <span className="text-[12.5px] text-muted-foreground">{i + 1}★</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-6"><SampleTag /></p>
      </Container>
    </section>
  )
}

/* ================================================================== 05 · OPPORTUNITY DISCOVERY */

type Opp = { id: string; kind: string; tone: Tone; title: string; score: number; why: string; evidence: number; quotes: string[]; impact: string; effort: string }
const OPPS: Opp[] = [
  { id: "a", kind: "Customer experience", tone: "orange", title: "Add a second host for weekend lunch", score: 82, why: "Waiting-time complaints doubled on weekends and drive most 2-star reviews at the Marina branch.", evidence: 412, quotes: ["Waited 40 minutes for a table on Friday.", "Great food, the wait ruined it."], impact: "High", effort: "Low" },
  { id: "b", kind: "Feature demand", tone: "cobalt", title: "Let guests modify bookings in the app", score: 76, why: "“Change my booking” is the most-requested capability in 3-star reviews since the app launched.", evidence: 131, quotes: ["Had to call to change the time.", "Wish I could edit my reservation."], impact: "High", effort: "Medium" },
  { id: "c", kind: "Competitor weakness", tone: "lime", title: "Win on delivery reliability", score: 71, why: "Rival B’s delivery complaints rose 27% while yours are falling — an opening for a delivery-time promise.", evidence: 96, quotes: ["Switched from Rival B, they’re always late."], impact: "Medium", effort: "Medium" },
  { id: "d", kind: "Product improvement", tone: "sky", title: "Lighter lunch portions at a lower price", score: 64, why: "Value-for-money mentions cluster around weekday lunch; dinner value scores are fine.", evidence: 151, quotes: ["Pricey for a quick lunch.", "Would love a smaller lunch plate."], impact: "Medium", effort: "Low" },
  { id: "e", kind: "Emerging trend", tone: "orange", title: "Outdoor seating demand is rising", score: 58, why: "Mentions of terraces and outdoor tables grew 6% month over month across three branches.", evidence: 74, quotes: ["Any chance of outdoor tables?"], impact: "Medium", effort: "High" },
]
const FILTERS = ["All", "Customer experience", "Feature demand", "Competitor weakness", "Product improvement", "Emerging trend"]

export function OpportunitySection() {
  const [filter, setFilter] = React.useState("All")
  const [open, setOpen] = React.useState(OPPS[0].id)
  const list = OPPS.filter((o) => filter === "All" || o.kind === filter)
  const sel = OPPS.find((o) => o.id === open) ?? list[0]
  return (
    <section aria-labelledby="opp-heading" className="relative overflow-hidden py-20 sm:py-28">
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,#F7F6F2_0%,#FFF1E8_45%,#F7F6F2_100%)]" />
      <Container className="relative">
        <SectionHeader
          split
          id="opp-heading"
          index="05"
          eyebrow="Opportunity discovery"
          title="The opportunities hiding in plain sight."
          description="Every opportunity is ranked by frequency and impact, and carries the reviews that prove it. Pick a card to see the evidence."
        />

        <div className="mt-10 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Filter opportunities">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-[14px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                filter === f ? "border-[#101B35] bg-[#101B35] text-white" : "border-border-strong bg-white text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.05fr]">
          <LayoutGroup>
            <motion.ul layout className="grid content-start gap-3">
              <AnimatePresence initial={false}>
                {list.map((o) => (
                  <motion.li key={o.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.3, ease: EASE }}>
                    <InsightCard
                      interactive
                      active={sel?.id === o.id}
                      onClick={() => setOpen(o.id)}
                      tone={o.tone}
                      eyebrow={o.kind}
                      title={o.title}
                      aside={<OpportunityIndicator score={o.score} size={50} tone={o.tone === "sky" ? "cobalt" : o.tone} />}
                      meta={
                        <>
                          <Chip>{o.evidence} reviews</Chip>
                          <Chip tone={o.impact === "High" ? "orange" : "sky"}>Impact · {o.impact}</Chip>
                          <Chip>Effort · {o.effort}</Chip>
                        </>
                      }
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          </LayoutGroup>

          <div className="lg:sticky lg:top-28 lg:self-start">
            <AnimatePresence mode="wait">
              {sel && (
                <motion.article
                  key={sel.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="dark relative overflow-hidden rounded-[28px] bg-background p-7 text-foreground sm:p-8"
                  aria-live="polite"
                >
                  <div aria-hidden className="absolute -top-28 -right-20 size-72 rounded-full" style={{ background: `radial-gradient(closest-side, ${TONE_HEX[sel.tone]}55, transparent)` }} />
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12.5px] font-semibold tracking-[0.08em] uppercase" style={{ color: TONE_HEX[sel.tone] }}>{sel.kind}</p>
                      <h3 className="mt-2 text-[1.6rem] leading-tight font-semibold tracking-[-0.03em] text-white">{sel.title}</h3>
                    </div>
                    <OpportunityIndicator score={sel.score} size={64} tone={sel.tone === "sky" ? "cobalt" : sel.tone} />
                  </div>
                  <p className="relative mt-4 text-[16px] leading-relaxed text-muted-foreground">{sel.why}</p>
                  <p className="relative mt-6 text-[12.5px] font-semibold tracking-[0.08em] text-[#92C9FF] uppercase">Evidence · {sel.evidence} reviews</p>
                  <ul className="relative mt-3 space-y-2">
                    {sel.quotes.map((q) => (
                      <li key={q} className="rounded-2xl bg-white/[0.06] px-4 py-3 text-[15px]">“{q}”</li>
                    ))}
                  </ul>
                  <div className="relative mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border p-3">
                      <p className="text-[12px] text-muted-foreground">Impact</p>
                      <p className="text-[17px] font-semibold">{sel.impact}</p>
                    </div>
                    <div className="rounded-2xl border border-border p-3">
                      <p className="text-[12px] text-muted-foreground">Effort</p>
                      <p className="text-[17px] font-semibold">{sel.effort}</p>
                    </div>
                  </div>
                  <p className="relative mt-5"><SampleTag /></p>
                </motion.article>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Container>
    </section>
  )
}

/* ================================================================== 06 · COMPETITIVE INTELLIGENCE */

const THEMES = [
  { k: "Staff & service", you: 82, a: 76, b: 64 },
  { k: "Waiting time", you: 41, a: 68, b: 38 },
  { k: "Value for money", you: 58, a: 55, b: 61 },
  { k: "Delivery", you: 63, a: 70, b: 34 },
  { k: "Booking experience", you: 47, a: 72, b: 52 },
]
const SERIES = [
  { key: "you" as const, label: "You", color: "#4169F5" },
  { key: "a" as const, label: "Rival A", color: "#FF8757" },
  { key: "b" as const, label: "Rival B", color: "#9BD24A" },
]

export function CompetitiveSection() {
  const [focus, setFocus] = React.useState<"you" | "a" | "b" | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-120px" })
  const reduce = useReducedMotion()
  return (
    <section aria-labelledby="comp-heading" className="relative bg-white py-20 sm:py-28">
      <Container>
        <SectionHeader split id="comp-heading" index="06" eyebrow="Competitive intelligence" title="See where rivals win — theme by theme." description="Positive-sentiment score per theme, side by side. Gaps nobody owns become your positioning." />

        <div ref={ref} className="mt-14 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="rounded-[28px] border border-border bg-[#F7F6F2] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label>Positive sentiment by theme · 0–100</Label>
              <div className="flex gap-2" role="group" aria-label="Highlight a business">
                {SERIES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={focus === s.key}
                    onClick={() => setFocus(focus === s.key ? null : s.key)}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors", focus === s.key ? "border-transparent bg-[#101B35] text-white" : "border-border-strong bg-white")}
                  >
                    <span className="size-2.5 rounded-full" style={{ background: s.color }} /> {s.label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="mt-7 space-y-6">
              {THEMES.map((t, i) => {
                const lo = Math.min(t.you, t.a, t.b)
                const hi = Math.max(t.you, t.a, t.b)
                return (
                  <li key={t.k} className="grid gap-2 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-4">
                    <span className="text-[15px] font-medium">{t.k}</span>
                    <div className="relative h-8">
                      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-foreground/10" />
                      <motion.div
                        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-foreground/15"
                        initial={{ left: "50%", width: 0 }}
                        animate={inView || reduce ? { left: `${lo}%`, width: `${hi - lo}%` } : {}}
                        transition={{ duration: 0.8, delay: i * 0.06, ease: EASE }}
                      />
                      {SERIES.map((s) => (
                        <motion.span
                          key={s.key}
                          title={`${s.label}: ${t[s.key]}`}
                          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                          style={{ background: s.color, opacity: focus && focus !== s.key ? 0.25 : 1, zIndex: focus === s.key ? 2 : 1 }}
                          initial={{ left: "50%" }}
                          animate={inView || reduce ? { left: `${t[s.key]}%`, scale: focus === s.key ? 1.25 : 1 } : {}}
                          transition={{ duration: 0.8, delay: i * 0.06, ease: EASE }}
                        />
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="mt-6"><SampleTag /></p>
          </div>

          <div className="grid content-start gap-4">
            <Reveal>
              <div className="rounded-[28px] border border-border bg-white p-6">
                <Label tone="orange">Market gap</Label>
                <p className="mt-3 text-[20px] leading-snug font-semibold tracking-[-0.02em]">Nobody nearby scores above 72 on booking experience.</p>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">Fix app re-booking and you own the theme in your area.</p>
              </div>
            </Reveal>
            <Reveal delay={0.06}>
              <div className="rounded-[28px] border border-border bg-white p-6">
                <Label tone="cobalt">Opportunity ranking</Label>
                <ol className="mt-4 space-y-3">
                  {[
                    { t: "Waiting time", d: "You trail Rival A by 27 pts", s: 82 },
                    { t: "Booking experience", d: "Gap of 25 pts to the leader", s: 76 },
                    { t: "Delivery", d: "Rival B is weakest — 34", s: 71 },
                  ].map((r, i) => (
                    <li key={r.t} className="flex items-center gap-4">
                      <span className="font-mono text-[13px] text-subtle-foreground">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15.5px] font-semibold">{r.t}</p>
                        <p className="text-[13.5px] text-muted-foreground">{r.d}</p>
                      </div>
                      <OpportunityIndicator score={r.s} size={44} />
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="grid grid-cols-3 gap-2 rounded-[28px] border border-border bg-white p-4">
                {COMPETITORS.map((c) => (
                  <div key={c.name} className="rounded-2xl bg-[#F7F6F2] p-3 text-center">
                    <p className={cn("text-[13px] font-medium", c.you && "text-[#2f52dd]")}>{c.name}</p>
                    <p className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums">{c.rating}★</p>
                    <p className="text-[12px] text-muted-foreground">{c.positive}% positive</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  )
}

/* ================================================================== 07 · REPORTS & EXPORTS */

export function ReportsSection() {
  return (
    <section aria-labelledby="reports-heading" className="relative overflow-hidden py-20 sm:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        {/* PDF preview stack */}
        <Reveal className="relative order-2 mx-auto w-full max-w-[560px] lg:order-1">
          <div aria-hidden className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgb(255_213_190/0.8),transparent)]" />
          <div className="absolute top-8 left-10 h-[88%] w-[78%] rotate-[-6deg] rounded-2xl border border-border bg-white shadow-lg" aria-hidden />
          <div className="absolute top-4 left-5 h-[92%] w-[80%] rotate-[-3deg] rounded-2xl border border-border bg-white shadow-lg" aria-hidden />
          <div className="relative ml-auto w-[86%] rounded-2xl border border-border bg-white p-6 shadow-[0_40px_80px_-40px_rgb(23_32_51/0.45)]">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#101B35]">Marina Kitchen Group</span>
              <span className="rounded-full bg-[#101B35] px-2.5 py-0.5 text-[11px] font-semibold text-white">PDF</span>
            </div>
            <p className="mt-5 text-[11.5px] font-semibold tracking-[0.08em] text-[#d9561f] uppercase">Executive summary · Q3</p>
            <p className="mt-1 text-[22px] leading-tight font-semibold tracking-[-0.03em]">Weekend waits are costing you stars.</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ["2,481", "reviews", "#4169F5"],
                ["62%", "positive", "#5E9E1F"],
                ["+18%", "wait mentions", "#d9561f"],
              ].map(([v, k, c]) => (
                <div key={k} className="rounded-xl bg-[#F7F6F2] p-2.5">
                  <p className="text-[18px] font-semibold tabular-nums" style={{ color: c }}>{v}</p>
                  <p className="text-[11px] text-muted-foreground">{k}</p>
                </div>
              ))}
            </div>
            <svg viewBox="0 0 300 70" className="mt-4 w-full" aria-hidden>
              <polyline points={line(WEEKS, 300, 60, 70)} fill="none" stroke="#4169F5" strokeWidth="2.5" />
              <polyline points={line(NEG.map((n) => n * 1.6), 300, 60, 70)} fill="none" stroke="#FF8757" strokeWidth="2.5" />
            </svg>
            <div className="mt-4 space-y-1.5">
              {["Add a weekend host at Marina", "Confirm app bookings by SMS"].map((r) => (
                <p key={r} className="flex items-center gap-2 text-[13px]">
                  <Check className="size-3.5 text-[#5E9E1F]" strokeWidth={3} /> {r}
                </p>
              ))}
            </div>
            <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">Every claim links to the reviews behind it · Sample report</p>
          </div>
        </Reveal>

        <div className="order-1 lg:order-2">
          <SectionHeader id="reports-heading" index="07" eyebrow="Reports & exports" title="Board-ready in minutes. Alerts before it’s a trend." description="Nine report types, exported as branded PDFs and shared by expiring link. Rules watch your themes and tell the right people when something moves." />
          <ul className="mt-9 grid gap-3 sm:grid-cols-2">
            {[
              { icon: Download, t: "Branded PDF export", d: "Your logo and colours on Business plans.", c: "#4169F5" },
              { icon: Link2, t: "Expiring share links", d: "Revocable links for clients and boards.", c: "#2E7FD0" },
              { icon: BellRing, t: "Threshold & trend alerts", d: "“Wait-time complaints up 18% this week.”", c: "#FF8757" },
              { icon: Mail, t: "Email the right people", d: "Route alerts by theme or location.", c: "#5E9E1F" },
              { icon: Webhook, t: "Signed webhooks", d: "Push alerts into your own systems.", c: "#101B35" },
            ].map((f, i) => (
              <Reveal key={f.t} delay={i * 0.04}>
                <div className="flex h-full items-start gap-3 rounded-2xl border border-border bg-white p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${f.c}14`, color: f.c }}>
                    <f.icon className="size-5" />
                  </span>
                  <span>
                    <span className="block text-[15.5px] font-semibold">{f.t}</span>
                    <span className="mt-0.5 block text-[14px] leading-snug text-muted-foreground">{f.d}</span>
                  </span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  )
}
