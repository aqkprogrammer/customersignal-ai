"use client"
/**
 * The signal path — a scroll-driven walk through the product. A sticky schematic on the left lights up
 * the stage whose chapter is in view; each chapter carries a small instrument readout (sample data,
 * labelled). Below `lg` the schematic collapses into each chapter's header.
 */
import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"
import { ArrowUpRight, FileSpreadsheet } from "lucide-react"
import { HolographicPanel, SentimentVisualization, TechnicalLabel } from "@/components/signal"
import { cn } from "@/lib/utils"

type Chapter = {
  code: string
  stage: string
  title: string
  body: string
  points: string[]
  href: string
  module: string
}

const CHAPTERS: Chapter[] = [
  {
    code: "01",
    stage: "Ingest",
    title: "Bring every review into one place — the legitimate way.",
    body: "Start with the CSV or Excel exports you already have. Push new reviews through the Reviews API, or connect platforms through their official, approved access.",
    points: ["Auto column mapping, validation and de-duplication", "Reviews API with signed webhooks", "Google Business Profile, Trustpilot and Amazon SP-API via approved access"],
    href: "/features#integrations",
    module: "Integrations",
  },
  {
    code: "02",
    stage: "Understand",
    title: "Read them all. In English and in Arabic.",
    body: "Each review gets sentiment, emotion, category and severity, with confidence. Arabic is detected and translated so one team can read the whole market.",
    points: ["Sentiment and emotion per review", "Categories: waiting time, pricing, staff, quality…", "Semantic search across every review"],
    href: "/features#review-intelligence",
    module: "Review Intelligence",
  },
  {
    code: "03",
    stage: "Cluster",
    title: "Find the complaint that keeps coming back.",
    body: "Recurring themes are clustered and ranked by share of voice and trend. Three-star reviews get their own pass: what people liked, what let them down, and the smallest fix that earns the fifth star.",
    points: ["Theme clusters with share and trend", "3-Star Gap Finder with opportunity scores", "Verbatim quotes attached to every gap"],
    href: "/features#gap-finder",
    module: "3-Star Gap Finder",
  },
  {
    code: "04",
    stage: "Compare",
    title: "See where rivals win, theme by theme.",
    body: "Put your reviews next to your competitors’ on the same themes. Spot where they are gaining and the positions nobody in your area owns yet.",
    points: ["Side-by-side theme scores and ratings", "Strengths and weaknesses per competitor", "Built for Dubai, Abu Dhabi and Riyadh markets"],
    href: "/features#competitor-intelligence",
    module: "Competitor Intelligence",
  },
  {
    code: "05",
    stage: "Act",
    title: "Turn evidence into decisions, reports and alerts.",
    body: "Recommendations arrive with the reviews behind them, for a person to approve. Export board-ready PDFs, share them by expiring link, and get told when a theme starts rising.",
    points: ["Nine AI report types, branded PDF export", "Threshold and trend alerts by email or webhook", "1-Star Cold Pitch briefs for agencies — never contacting reviewers"],
    href: "/features#ai-reports",
    module: "AI Reports · Monitoring",
  },
]

/* ------------------------------------------------------------------ instrument readouts (sample) */

function Readout({ i }: { i: number }) {
  switch (i) {
    case 0:
      return (
        <HolographicPanel label="Review import" status="Validated" statusTone="mint">
          <p className="flex items-center gap-2 font-mono text-[0.82em] text-foreground/90">
            <FileSpreadsheet className="size-[1.1em] text-signal" /> branch-reviews-q3.csv
          </p>
          <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3">
            {[["Rows", "2,481"], ["Mapped", "6 cols"], ["Dupes", "37"], ["EN / AR", "71/29"]].map(([k, v]) => (
              <div key={k}>
                <dt className="font-mono text-[0.62em] tracking-[0.14em] text-subtle-foreground uppercase">{k}</dt>
                <dd className="mt-1 font-mono text-[0.9em] text-foreground tabular">{v}</dd>
              </div>
            ))}
          </dl>
        </HolographicPanel>
      )
    case 1:
      return (
        <HolographicPanel label="Sentiment engine" status="Resolved" statusTone="mint">
          <SentimentVisualization positive={62} neutral={21} negative={17} />
          <p className="mt-3 border-t border-border pt-3 text-[0.86em] leading-snug text-muted-foreground" dir="auto">
            <span className="text-foreground/90">“الخدمة ممتازة لكن الانتظار طويل”</span>
            <span className="mt-1 block font-mono text-[0.72em] tracking-[0.12em] text-subtle-foreground uppercase">AR → EN · “Excellent service, but a long wait”</span>
          </p>
        </HolographicPanel>
      )
    case 2:
      return (
        <HolographicPanel label="Theme clusters · 90 days" status="3 rising" statusTone="ember">
          <ul className="space-y-2.5">
            {[
              ["Long waiting times", 23, "Rising"],
              ["Booking confirmation confusion", 9, "New"],
              ["Value for money", 14, "Easing"],
            ].map(([n, v, t]) => (
              <li key={n as string}>
                <div className="flex justify-between text-[0.86em]">
                  <span className="text-foreground/90">{n}</span>
                  <span className="font-mono text-[0.86em] text-muted-foreground tabular">{v}%</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-foreground/8">
                    <span className={cn("block h-full", t === "Easing" ? "bg-mint" : "bg-ember")} style={{ width: `${(v as number) * 3}%` }} />
                  </span>
                  <span className={cn("w-12 text-right font-mono text-[0.66em] tracking-[0.12em] uppercase", t === "Easing" ? "text-mint" : "text-ember")}>{t}</span>
                </div>
              </li>
            ))}
          </ul>
        </HolographicPanel>
      )
    case 3:
      return (
        <HolographicPanel label="Competitor matrix · waiting time" status="You trail" statusTone="ember">
          <table className="w-full text-left text-[0.84em]">
            <thead>
              <tr className="font-mono text-[0.72em] tracking-[0.12em] text-subtle-foreground uppercase">
                <th className="pb-2 font-normal">Business</th>
                <th className="pb-2 text-right font-normal">Rating</th>
                <th className="pb-2 text-right font-normal">Complaint share</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular">
              {[
                ["You", "4.1", "23%", true],
                ["Rival A", "4.3", "11%", false],
                ["Rival B", "3.9", "27%", false],
              ].map(([n, r, s, you]) => (
                <tr key={n as string} className="border-t border-border">
                  <td className={cn("py-2 font-sans", you ? "text-signal" : "text-foreground/85")}>{n}</td>
                  <td className="py-2 text-right text-foreground/85">{r}</td>
                  <td className="py-2 text-right text-foreground/85">{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </HolographicPanel>
      )
    default:
      return (
        <HolographicPanel label="AI recommendation" status="Awaiting review" statusTone="ember">
          <p className="font-mono text-[0.68em] tracking-[0.14em] text-subtle-foreground uppercase">Operational fix · evidence 412 reviews</p>
          <p className="mt-2 text-[0.95em] leading-snug text-foreground">Add a second host for the weekend lunch peak at the Marina branch.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 font-mono text-[0.7em] tracking-[0.12em] uppercase">
            <span className="text-muted-foreground">PDF · executive summary</span>
            <span className="text-right text-mint">Ready</span>
            <span className="text-muted-foreground">Alert · wait time &gt; 20%</span>
            <span className="text-right text-ember">Armed</span>
          </div>
        </HolographicPanel>
      )
  }
}

/* ------------------------------------------------------------------ schematic */

function Schematic({ active }: { active: number }) {
  const reduce = useReducedMotion()
  const ys = CHAPTERS.map((_, i) => 40 + i * 92)
  return (
    <svg viewBox="0 0 220 460" className="h-full max-h-[440px] w-auto" aria-hidden>
      <line x1="40" y1="20" x2="40" y2="440" stroke="var(--foreground)" strokeOpacity="0.12" />
      <motion.line
        x1="40"
        y1="20"
        x2="40"
        y2={ys[ys.length - 1]}
        stroke="var(--signal)"
        strokeWidth="1.5"
        initial={false}
        animate={{ scaleY: (ys[active] - 20) / (ys[ys.length - 1] - 20) }}
        transition={reduce ? { duration: 0 } : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformBox: "fill-box", originY: 0 }}
      />
      {CHAPTERS.map((c, i) => {
        const on = i === active
        const done = i < active
        return (
          <g key={c.code} transform={`translate(40 ${ys[i]})`}>
            <circle r={on ? 13 : 9} fill="var(--background)" stroke={on ? "var(--signal)" : done ? "var(--signal)" : "var(--foreground)"} strokeOpacity={on ? 1 : done ? 0.6 : 0.2} style={{ transition: "r .4s, stroke-opacity .4s" }} />
            <circle r="3" fill={on || done ? "var(--signal)" : "var(--foreground)"} fillOpacity={on ? 1 : done ? 0.7 : 0.25} />
            {on && !reduce && (
              <circle r="13" fill="none" stroke="var(--signal)" opacity="0">
                <animate attributeName="r" values="13;26" dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0" dur="2.2s" repeatCount="indefinite" />
              </circle>
            )}
            <text x="30" y="-3" className="font-mono" fontSize="9" letterSpacing="1.4" fill="var(--subtle-foreground)">{c.code}</text>
            <text x="30" y="11" fontSize="13" fontWeight={on ? 600 : 400} fill={on ? "var(--foreground)" : "var(--muted-foreground)"} style={{ transition: "fill .4s" }}>
              {c.stage}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ------------------------------------------------------------------ chapter */

function ChapterBlock({ c, i, onActive }: { c: Chapter; i: number; onActive: (i: number) => void }) {
  const ref = React.useRef<HTMLElement>(null)
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" })
  React.useEffect(() => {
    if (inView) onActive(i)
  }, [inView, i, onActive])
  return (
    <article ref={ref} aria-labelledby={`path-${c.code}`} className="relative border-t border-border py-12 lg:flex lg:min-h-[78vh] lg:flex-col lg:justify-center lg:py-16">
      <TechnicalLabel index={c.code} tone="signal">
        {c.stage} · {c.module}
      </TechnicalLabel>
      <h3 id={`path-${c.code}`} className="mt-5 max-w-xl text-[1.75rem] leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-[2.2rem]">
        {c.title}
      </h3>
      <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground">{c.body}</p>
      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[1fr_1.05fr]">
        <ul className="space-y-3">
          {c.points.map((p) => (
            <li key={p} className="flex gap-3 text-[14px] leading-snug text-foreground/85">
              <span aria-hidden className="mt-[9px] h-px w-3 shrink-0 bg-signal" />
              {p}
            </li>
          ))}
          <li className="pt-2">
            <Link href={c.href} className="group inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-signal uppercase hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none">
              {c.module} <ArrowUpRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-px group-hover:-translate-y-px" />
            </Link>
          </li>
        </ul>
        <div className="text-[13px]">
          <Readout i={i} />
        </div>
      </div>
    </article>
  )
}

export function SignalPath() {
  const [active, setActive] = React.useState(0)
  const onActive = React.useCallback((i: number) => setActive(i), [])
  return (
    <section aria-labelledby="path-heading" className="relative py-20 sm:py-28">
      <div className="mx-auto grid w-full max-w-[1320px] gap-x-16 px-5 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <TechnicalLabel index="02 / 06">The signal path</TechnicalLabel>
            <h2 id="path-heading" className="mt-5 text-[2.1rem] leading-[1.04] font-semibold tracking-[-0.04em] text-balance sm:text-[2.75rem]">
              From raw reviews to a decision you can defend.
            </h2>
            <div className="mt-10 hidden h-[440px] items-start lg:flex">
              <Schematic active={active} />
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={active}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 hidden font-mono text-[10.5px] tracking-[0.14em] text-subtle-foreground uppercase lg:block"
              >
                Stage {CHAPTERS[active].code} of 05 · {CHAPTERS[active].stage}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <div className="mt-10 lg:col-span-8 lg:mt-0">
          {CHAPTERS.map((c, i) => (
            <ChapterBlock key={c.code} c={c} i={i} onActive={onActive} />
          ))}
          <p className="border-t border-border pt-4">
            <TechnicalLabel>Readouts show illustrative sample data</TechnicalLabel>
          </p>
        </div>
      </div>
    </section>
  )
}
