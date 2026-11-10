"use client"
/**
 * Homepage story, part A: 01 the problem · 02 how it works · 03 data ingestion.
 * All product visuals use labelled sample data.
 */
import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"
import { ArrowRight, BellRing, Braces, Check, FileSpreadsheet, FileText, Plug, Sheet as SheetIcon, Upload } from "lucide-react"
import { CLUSTERS, COMPETITORS, Chip, InsightCard, Label, OpportunityIndicator, SampleTag, SentimentDistribution, TONE_HEX } from "@/components/aurora"
import { cn } from "@/lib/utils"
import { Reveal } from "./motion"
import { Container, SectionHeader } from "./section"

const EASE = [0.22, 1, 0.36, 1] as const

/* ================================================================== 01 · THE PROBLEM */

const SCATTER = [
  { t: "Waited 40 minutes for a table on Friday.", s: "★★", r: -6, x: "4%", y: "6%" },
  { t: "Lovely staff, will come back!", s: "★★★★★", r: 4, x: "48%", y: "2%" },
  { t: "App booking never confirmed???", s: "★", r: -3, x: "30%", y: "30%" },
  { t: "Good food but pricey for lunch", s: "★★★", r: 7, x: "62%", y: "36%" },
  { t: "Delivery late again.", s: "★★", r: -8, x: "6%", y: "52%" },
  { t: "الخدمة ممتازة لكن الانتظار طويل", s: "★★★", r: 3, x: "40%", y: "64%" },
  { t: "Same wait problem as last month", s: "★★", r: -2, x: "8%", y: "80%" },
]

export function ProblemSection() {
  return (
    <section aria-labelledby="problem-heading" className="relative py-20 sm:py-28">
      <Container>
        <SectionHeader
          split
          id="problem-heading"
          index="01"
          eyebrow="The problem"
          title="Reviews are the most honest research you have."
          description="Thousands of reviews arrive across branches, platforms and languages. Star ratings say something is wrong — not what, why, or what to do about it. So the same complaint repeats for months."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {/* without */}
          <Reveal className="relative overflow-hidden rounded-[28px] border border-border bg-[#EFEEE9] p-6 sm:p-8">
            <p className="text-[13px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Without CustomerSignal</p>
            <div className="relative mt-6 h-[300px]" aria-hidden>
              {SCATTER.map((c, i) => (
                <motion.div
                  key={i}
                  className="absolute max-w-[62%] rounded-xl border border-border bg-white/90 px-3 py-2 text-[13px] text-muted-foreground shadow-sm"
                  style={{ left: c.x, top: c.y, rotate: c.r }}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.5 }}
                  dir="auto"
                >
                  <span className="mr-1.5 text-[11px] text-[#c79a3a]">{c.s}</span>
                  {c.t}
                </motion.div>
              ))}
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-[15px] text-muted-foreground">
              {["Disconnected reviews", "Unstructured feedback", "Missed opportunities", "Repeated complaints"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#929AAA]" /> {t}
                </li>
              ))}
            </ul>
          </Reveal>

          {/* with */}
          <Reveal delay={0.08} className="dark relative overflow-hidden rounded-[28px] bg-background p-6 text-foreground sm:p-8">
            <div aria-hidden className="absolute -top-24 -right-24 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(65_105_245/0.45),transparent)]" />
            <p className="relative text-[13px] font-semibold tracking-[0.08em] text-[#92C9FF] uppercase">With CustomerSignal</p>
            <ol className="relative mt-6 space-y-2.5">
              {CLUSTERS.slice(0, 4).map((c, i) => (
                <motion.li
                  key={c.id}
                  className="flex items-center gap-4 rounded-2xl bg-white/[0.05] px-4 py-3"
                  initial={{ opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.5, ease: EASE }}
                >
                  <span className="font-mono text-[12px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <span className="size-3 rounded-full" style={{ background: TONE_HEX[c.tone] }} />
                  <span className="flex-1 text-[15px] font-medium">{c.name}</span>
                  <span className="text-[15px] font-semibold tabular-nums">{c.share}%</span>
                  <span className={cn("w-16 text-right text-[12px] font-medium", c.trend === "Rising" ? "text-orange" : c.trend === "Easing" ? "text-lime" : "text-muted-foreground")}>{c.trend}</span>
                </motion.li>
              ))}
            </ol>
            <div className="relative mt-4 flex items-center gap-4 rounded-2xl border border-orange/30 bg-orange/10 px-4 py-3">
              <OpportunityIndicator score={82} size={46} />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold tracking-[0.06em] text-orange uppercase">Top opportunity</p>
                <p className="text-[15px] font-medium">Add a weekend host — backed by 412 reviews</p>
              </div>
            </div>
            <ul className="relative mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-[15px]">
              {["Organized intelligence", "Emerging themes", "Evidence-backed opportunities", "Competitive insights"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4 text-lime" strokeWidth={3} /> {t}
                </li>
              ))}
            </ul>
            <p className="relative mt-5"><SampleTag /></p>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}

/* ================================================================== 02 · HOW IT WORKS */

const STAGES = [
  { code: "01", key: "Ingest", title: "Bring every review in — the legitimate way", body: "CSV or Excel exports, the Reviews API, or platforms connected through official, approved access. Columns are mapped, rows validated, duplicates removed.", href: "/features#integrations" },
  { code: "02", key: "Understand", title: "Read every review, in English and Arabic", body: "Sentiment, emotion, category and severity for each review — with confidence. Arabic is detected and translated so one team reads the whole market.", href: "/features#review-intelligence" },
  { code: "03", key: "Cluster", title: "Find the complaint that keeps coming back", body: "Recurring themes are clustered and ranked by share of voice and trend. Three-star reviews get their own pass to find the smallest fix that earns the fifth star.", href: "/features#gap-finder" },
  { code: "04", key: "Compare", title: "See where competitors win, theme by theme", body: "Your reviews next to your competitors’ on the same themes: who is gaining, where, and the positions nobody owns yet.", href: "/features#competitor-intelligence" },
  { code: "05", key: "Act", title: "Turn evidence into decisions, reports and alerts", body: "Recommendations arrive with the quotes behind them for a person to approve. Export branded PDFs and get alerted when a theme starts rising.", href: "/features#ai-reports" },
]

function StageVisual({ i }: { i: number }) {
  if (i === 0)
    return (
      <div className="grid gap-2.5 sm:grid-cols-2">
        {[
          { icon: FileSpreadsheet, t: "branch-reviews-q3.csv", d: "2,481 rows · validated", c: "#4169F5" },
          { icon: SheetIcon, t: "trustpilot-export.xlsx", d: "642 rows · mapped", c: "#2E7FD0" },
          { icon: Braces, t: "POST /v1/reviews", d: "Signed · 202 accepted", c: "#5E9E1F" },
          { icon: Plug, t: "Google Business Profile", d: "Approved access", c: "#FF8757" },
        ].map((f) => (
          <div key={f.t} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3.5">
            <span className="flex size-10 items-center justify-center rounded-xl" style={{ background: `${f.c}14`, color: f.c }}>
              <f.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold">{f.t}</span>
              <span className="block text-[12.5px] text-muted-foreground">{f.d}</span>
            </span>
          </div>
        ))}
      </div>
    )
  if (i === 1)
    return (
      <div className="grid gap-4 sm:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-border bg-white p-5">
          <Label>Sentiment · 2,481 reviews</Label>
          <SentimentDistribution className="mt-4" positive={62} neutral={21} negative={17} />
        </div>
        <div className="rounded-2xl border border-border bg-white p-5" dir="auto">
          <Label>Arabic → English</Label>
          <p className="mt-3 text-[16px] font-medium">“الخدمة ممتازة لكن الانتظار طويل”</p>
          <p className="mt-1 text-[14px] text-muted-foreground">“Excellent service, but a long wait.”</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip tone="lime">Staff · positive</Chip>
            <Chip tone="orange">Wait time · negative</Chip>
          </div>
        </div>
      </div>
    )
  if (i === 2)
    return (
      <div className="rounded-2xl border border-border bg-white p-5">
        <Label>Theme clusters · 90 days</Label>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          {CLUSTERS.map((c) => (
            <div key={c.id} className="flex flex-col items-center gap-2">
              <motion.span
                className="flex items-center justify-center rounded-full text-[13px] font-semibold"
                style={{ width: c.r * 1.3, height: c.r * 1.3, background: `${TONE_HEX[c.tone]}22`, border: `1.5px solid ${TONE_HEX[c.tone]}` }}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                {c.share}%
              </motion.span>
              <span className="max-w-[7rem] text-center text-[12.5px] leading-tight text-muted-foreground">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    )
  if (i === 3)
    return (
      <div className="rounded-2xl border border-border bg-white p-5">
        <Label>Waiting-time complaints · share of reviews</Label>
        <div className="mt-4 space-y-3">
          {COMPETITORS.map((c, k) => (
            <div key={c.name} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3">
              <span className={cn("text-[14px] font-medium", c.you && "text-[#2f52dd]")}>{c.name}</span>
              <span className="h-3 overflow-hidden rounded-full bg-foreground/[0.06]">
                <motion.span
                  className="block h-full rounded-full"
                  style={{ background: c.you ? "#4169F5" : k === 1 ? "#9BD24A" : "#FF8757" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${c.complaint * 3}%` }}
                  transition={{ duration: 0.8, delay: k * 0.1, ease: EASE }}
                />
              </span>
              <span className="text-right text-[14px] font-semibold tabular-nums">{c.complaint}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <InsightCard tone="orange" eyebrow="Recommendation · awaiting review" title="Add a second host for the weekend lunch peak" aside={<OpportunityIndicator score={82} size={48} />} body="Evidence: 412 reviews, 3 sources." />
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4">
          <FileText className="size-5 text-[#4169F5]" />
          <span className="text-[14px] font-medium">Executive summary PDF · ready</span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4">
          <BellRing className="size-5 text-[#FF8757]" />
          <span className="text-[14px] font-medium">Alert armed · wait time &gt; 20%</span>
        </div>
      </div>
    </div>
  )
}

export function ProcessSection() {
  const [active, setActive] = React.useState(0)
  const [touched, setTouched] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-120px" })
  const reduce = useReducedMotion()

  React.useEffect(() => {
    if (touched || reduce || !inView) return
    const t = setInterval(() => setActive((a) => (a + 1) % STAGES.length), 5200)
    return () => clearInterval(t)
  }, [touched, reduce, inView])

  const pick = (i: number) => {
    setTouched(true)
    setActive(i)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return
    e.preventDefault()
    const n = (active + (e.key === "ArrowRight" ? 1 : STAGES.length - 1)) % STAGES.length
    pick(n)
    document.getElementById(`stage-tab-${n}`)?.focus()
  }
  const s = STAGES[active]

  return (
    <section aria-labelledby="process-heading" className="relative bg-white py-20 sm:py-28">
      <Container>
        <SectionHeader
          split
          id="process-heading"
          index="02"
          eyebrow="How it works"
          title="From raw customer signals to decisions you can defend."
          description="Five connected stages. Select one to see what it does — every stage keeps a link back to the reviews behind it."
        />

        <div ref={ref} className="mt-14">
          {/* connected stepper */}
          <div role="tablist" aria-label="Process stages" onKeyDown={onKey} className="relative grid grid-cols-5 gap-2">
            <div aria-hidden className="absolute top-[22px] right-[10%] left-[10%] h-[2px] bg-foreground/10">
              <motion.div className="h-full origin-left bg-[#4169F5]" animate={{ scaleX: active / (STAGES.length - 1) }} transition={{ duration: 0.6, ease: EASE }} />
            </div>
            {STAGES.map((st, i) => {
              const on = i === active
              const done = i < active
              return (
                <button
                  key={st.code}
                  id={`stage-tab-${i}`}
                  role="tab"
                  aria-selected={on}
                  aria-controls="stage-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => pick(i)}
                  className="group relative flex flex-col items-center gap-3 rounded-2xl py-1 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                >
                  <motion.span
                    className={cn(
                      "relative z-10 flex size-11 items-center justify-center rounded-full border-2 font-mono text-[13px] font-semibold transition-colors",
                      on ? "border-[#4169F5] bg-[#4169F5] text-white" : done ? "border-[#4169F5] bg-white text-[#2f52dd]" : "border-border-strong bg-white text-muted-foreground group-hover:border-[#4169F5]/60",
                    )}
                    animate={on && !reduce ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    {done ? <Check className="size-4" strokeWidth={3} /> : st.code}
                  </motion.span>
                  <span className={cn("text-[12px] font-semibold tracking-[0.08em] uppercase sm:text-[13px]", on ? "text-foreground" : "text-muted-foreground")}>{st.key}</span>
                </button>
              )
            })}
          </div>

          <div id="stage-panel" role="tabpanel" aria-labelledby={`stage-tab-${active}`} className="mt-10 rounded-[28px] border border-border bg-[#F7F6F2] p-6 sm:p-10">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.32, ease: EASE }}
                className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center"
              >
                <div>
                  <p className="font-mono text-[13px] font-semibold text-[#FF8757]">{s.code} — {s.key.toUpperCase()}</p>
                  <h3 className="mt-3 text-[1.8rem] leading-[1.1] font-semibold tracking-[-0.035em] text-balance sm:text-[2.2rem]">{s.title}</h3>
                  <p className="mt-4 text-[16.5px] leading-relaxed text-muted-foreground">{s.body}</p>
                  <Link href={s.href} className="group mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#2f52dd] hover:underline">
                    Learn more <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
                <StageVisual i={active} />
              </motion.div>
            </AnimatePresence>
            <p className="mt-6"><SampleTag /></p>
          </div>
        </div>
      </Container>
    </section>
  )
}

/* ================================================================== 03 · DATA INGESTION */

const METHODS = [
  { icon: FileSpreadsheet, t: "CSV files", d: "Any export — columns are detected and mapped for you.", c: "#4169F5" },
  { icon: SheetIcon, t: "Excel exports", d: "Multi-sheet .xlsx straight from your platforms.", c: "#2E7FD0" },
  { icon: Braces, t: "Reviews API", d: "Push reviews in real time with signed requests and webhooks.", c: "#5E9E1F" },
  { icon: Plug, t: "Approved integrations", d: "Google Business Profile, Trustpilot and Amazon SP-API via official access.", c: "#FF8757" },
]
const CHECKS = ["File received", "Columns mapped", "Rows validated", "Duplicates removed", "Languages detected"]

export function IngestionSection() {
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-120px" })
  const reduce = useReducedMotion()
  const [step, setStep] = React.useState(reduce ? CHECKS.length : 0)
  React.useEffect(() => {
    if (!inView || reduce) return
    const t = setInterval(() => setStep((s) => (s >= CHECKS.length ? s : s + 1)), 650)
    return () => clearInterval(t)
  }, [inView, reduce])
  const done = step >= CHECKS.length

  return (
    <section aria-labelledby="ingest-heading" className="relative py-20 sm:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHeader id="ingest-heading" index="03" eyebrow="Data ingestion" title="Connect the reviews you already have." description="Start with an export today. Add the API or approved integrations when you’re ready. We never scrape." />
          <ul className="mt-9 space-y-3">
            {METHODS.map((m, i) => (
              <Reveal key={m.t} delay={i * 0.05}>
                <div className="flex items-start gap-4 rounded-2xl border border-border bg-white p-4 transition-shadow hover:shadow-[0_14px_30px_-20px_rgb(23_32_51/0.35)]">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${m.c}14`, color: m.c }}>
                    <m.icon className="size-5" />
                  </span>
                  <span>
                    <span className="block text-[16px] font-semibold">{m.t}</span>
                    <span className="mt-0.5 block text-[14.5px] leading-snug text-muted-foreground">{m.d}</span>
                  </span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>

        <div ref={ref} className="relative">
          <div aria-hidden className="absolute -inset-6 rounded-[36px] bg-[radial-gradient(60%_60%_at_70%_30%,rgb(146_201_255/0.35),transparent_70%)]" />
          <div className="relative rounded-[28px] border border-border bg-white p-6 shadow-[0_40px_80px_-40px_rgb(23_32_51/0.35)] sm:p-7">
            <div className="flex items-center justify-between">
              <Label tone="cobalt">Import reviews</Label>
              <SampleTag />
            </div>
            <div className="mt-5 flex items-center gap-4 rounded-2xl border-2 border-dashed border-[#4169F5]/35 bg-[#eef2ff]/60 p-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-[#4169F5] text-white">
                <Upload className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">branch-reviews-q3.csv</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <motion.div className="h-full rounded-full bg-[#4169F5]" initial={{ width: reduce ? "100%" : "4%" }} animate={{ width: `${Math.min(100, (step / CHECKS.length) * 100)}%` }} transition={{ duration: 0.5, ease: EASE }} />
                </div>
              </div>
              <span className="font-mono text-[13px] text-muted-foreground tabular-nums">{Math.round(Math.min(1, step / CHECKS.length) * 2481).toLocaleString()} rows</span>
            </div>

            <ol className="mt-5 grid gap-2 sm:grid-cols-5">
              {CHECKS.map((c, i) => {
                const ok = i < step
                return (
                  <li key={c} className={cn("flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[12.5px] font-medium transition-colors sm:flex-col sm:items-start", ok ? "border-[#B7E66B] bg-[#f3fbe6] text-[#3b6b0c]" : "border-border text-muted-foreground")}>
                    <span className={cn("flex size-5 items-center justify-center rounded-full", ok ? "bg-[#9BD24A] text-white" : "bg-foreground/[0.06]")}>
                      {ok ? <Check className="size-3" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-foreground/25" />}
                    </span>
                    {c}
                  </li>
                )
              })}
            </ol>

            <div className="mt-5 grid gap-4 sm:grid-cols-[1.2fr_1fr]">
              <div className="overflow-hidden rounded-2xl border border-border">
                <table className="w-full text-left text-[13.5px]">
                  <thead className="bg-[#F7F6F2] text-[12px] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Your column</th>
                      <th className="px-3 py-2 font-medium">Mapped to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["review_text", "Review"],
                      ["stars", "Rating"],
                      ["created", "Date"],
                      ["branch", "Location"],
                    ].map(([a, b]) => (
                      <tr key={a} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-[12.5px]">{a}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 font-medium text-[#2f52dd]">
                            <ArrowRight className="size-3.5" /> {b}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AnimatePresence>
                {done && (
                  <motion.dl initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-2">
                    {[
                      ["2,481", "Rows imported", "#4169F5"],
                      ["37", "Duplicates removed", "#FF8757"],
                      ["12", "Rows skipped (no text)", "#929AAA"],
                      ["71 / 29", "English / Arabic %", "#5E9E1F"],
                    ].map(([v, k, c]) => (
                      <div key={k} className="rounded-2xl bg-[#F7F6F2] p-3">
                        <dd className="text-[20px] font-semibold tracking-tight tabular-nums" style={{ color: c }}>{v}</dd>
                        <dt className="text-[12px] leading-tight text-muted-foreground">{k}</dt>
                      </div>
                    ))}
                  </motion.dl>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
