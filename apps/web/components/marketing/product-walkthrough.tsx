"use client"

import { AnimatePresence, motion } from "motion/react"
import {
  BellRing,
  BrainCircuit,
  CircleCheck,
  FileDown,
  FileText,
  LoaderCircle,
  ScanSearch,
  Star,
  Upload,
  type LucideIcon,
} from "lucide-react"
import { useId, useState } from "react"
import { cn } from "@/lib/utils"
import { ClusterList, InsightCard, SentimentChart } from "./dashboard-preview"

type Step = { key: string; label: string; icon: LucideIcon; title: string; body: string }

const STEPS: Step[] = [
  {
    key: "connect",
    label: "Connect",
    icon: Upload,
    title: "Bring in reviews the right way",
    body: "Upload CSV or Excel exports, push via the Reviews API, or connect approved platform integrations. Columns are mapped automatically and duplicates removed.",
  },
  {
    key: "analyze",
    label: "Analyze",
    icon: BrainCircuit,
    title: "AI reads every review, in English and Arabic",
    body: "Each review gets sentiment, emotion, categories and severity. Recurring themes are clustered so you see patterns, not noise.",
  },
  {
    key: "discover",
    label: "Discover",
    icon: ScanSearch,
    title: "Find the gaps that cost you stars",
    body: "The 3-Star Gap Finder isolates what stops “good” from becoming “great”. Competitor views show where rivals are winning on the same themes.",
  },
  {
    key: "report",
    label: "Report",
    icon: FileText,
    title: "Share evidence, not opinions",
    body: "Generate executive, complaint, competitor or opportunity reports with quotes as evidence — then export a branded PDF.",
  },
  {
    key: "monitor",
    label: "Monitor",
    icon: BellRing,
    title: "Know the moment something changes",
    body: "Set thresholds on rating, sentiment or a specific complaint. Get alerted by email or webhook when a theme starts rising.",
  },
]

export function ProductWalkthrough() {
  const [active, setActive] = useState(0)
  const baseId = useId()
  const step = STEPS[active]

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    e.preventDefault()
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1
    const next = (active + dir + STEPS.length) % STEPS.length
    setActive(next)
    document.getElementById(`${baseId}-tab-${next}`)?.focus()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[19rem_1fr] lg:gap-10">
      <div role="tablist" aria-label="Product walkthrough" aria-orientation="vertical" onKeyDown={onKeyDown} className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {STEPS.map((s, i) => {
          const selected = i === active
          return (
            <button
              key={s.key}
              id={`${baseId}-tab-${i}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={cn(
                "group relative flex shrink-0 items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:px-4 lg:py-4",
                selected ? "border-primary/30 bg-card shadow-sm" : "border-transparent hover:bg-card/60",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                  selected ? "border-primary/20 bg-primary text-primary-foreground" : "bg-background text-muted-foreground",
                )}
              >
                <s.icon aria-hidden className="size-4" />
              </span>
              <span className="flex flex-col">
                <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Step {String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm font-semibold text-foreground">{s.label}</span>
                <span className={cn("mt-1 hidden text-[13px] leading-snug text-muted-foreground", selected && "lg:block")}>{s.title}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active}`}
        className="surface relative min-h-[26rem] overflow-hidden p-5 sm:p-7"
      >
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="relative"
          >
            <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{step.title}</h3>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">{step.body}</p>
            <div className="mt-6">
              <Panel stepKey={step.key} />
            </div>
          </motion.div>
        </AnimatePresence>
        <p className="relative mt-6 text-xs text-muted-foreground">Illustrative preview with sample data</p>
      </div>
    </div>
  )
}

function Panel({ stepKey }: { stepKey: string }) {
  switch (stepKey) {
    case "connect":
      return (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {[
            { name: "marina-branch-reviews.csv", meta: "1,204 rows · mapped", done: true },
            { name: "jbr-branch-q3.xlsx", meta: "866 rows · 14 duplicates removed", done: true },
            { name: "Reviews API (POS feedback)", meta: "Streaming · 38 today", done: true },
            { name: "Google Business Profile", meta: "Official API · awaiting approval", done: false },
          ].map((f) => (
            <li key={f.name} className="flex items-center gap-3 rounded-xl border bg-background p-3">
              <span className={cn("flex size-8 items-center justify-center rounded-lg", f.done ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : "bg-amber-50 text-amber-600 dark:bg-amber-500/10")}>
                {f.done ? <CircleCheck aria-hidden className="size-4" /> : <LoaderCircle aria-hidden className="size-4" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{f.name}</span>
                <span className="block text-[12px] text-muted-foreground">{f.meta}</span>
              </span>
            </li>
          ))}
        </ul>
      )
    case "analyze":
      return (
        <div className="space-y-2.5">
          {[
            { text: "Food was great but we waited 40 minutes for a table even with a booking.", rating: 3, sentiment: "Mixed", tags: ["Waiting time", "Booking"] },
            { text: "الموظفين لطيفين جداً والخدمة سريعة", rating: 5, sentiment: "Positive", tags: ["Staff behavior", "Speed"] },
            { text: "Charged for a service I never received and nobody answered my emails.", rating: 1, sentiment: "Negative", tags: ["Pricing", "Communication"] },
          ].map((r) => (
            <div key={r.text} className="rounded-xl border bg-background p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-0.5 text-amber-500" aria-label={`${r.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} aria-hidden className={cn("size-3", i < r.rating ? "fill-current" : "text-muted")} />
                  ))}
                </span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                    r.sentiment === "Positive" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
                    r.sentiment === "Negative" && "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
                    r.sentiment === "Mixed" && "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
                  )}
                >
                  {r.sentiment}
                </span>
              </div>
              <p className="mt-2 text-[13px] text-foreground" dir="auto">
                “{r.text}”
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.tags.map((t) => (
                  <span key={t} className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    case "discover":
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border bg-background p-4">
            <p className="mb-3 text-[13px] font-semibold">3-star gap: what blocks a 5-star visit</p>
            <ClusterList />
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-[13px] font-semibold">You vs. 3 nearby competitors</p>
            <table className="mt-3 w-full text-[12px]">
              <caption className="sr-only">Sample competitor comparison</caption>
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th scope="col" className="pb-2 font-medium">Theme</th>
                  <th scope="col" className="pb-2 text-right font-medium">You</th>
                  <th scope="col" className="pb-2 text-right font-medium">Avg. rivals</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[
                  ["Waiting time", "−41", "−18"],
                  ["Food quality", "+62", "+48"],
                  ["Value for money", "+12", "+27"],
                  ["Staff", "+55", "+39"],
                ].map(([t, a, b]) => (
                  <tr key={t} className="border-t">
                    <th scope="row" className="py-2 text-left font-medium">{t}</th>
                    <td className={cn("py-2 text-right font-semibold", a.startsWith("−") ? "text-rose-600" : "text-emerald-600")}>{a}</td>
                    <td className="py-2 text-right text-muted-foreground">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-muted-foreground">Net sentiment score per theme (sample).</p>
          </div>
        </div>
      )
    case "report":
      return (
        <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
          <div className="rounded-xl border bg-background p-4">
            <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Executive summary · Q3</p>
            <p className="mt-2 text-[15px] font-semibold">Wait times are now the #1 driver of lost stars.</p>
            <ul className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
              <li>• 23% of reviews mention waiting, up from 15% last quarter.</li>
              <li>• Staff warmth remains your strongest differentiator (+55 net).</li>
              <li>• Two competitors gained on value-for-money after menu changes.</li>
            </ul>
            <SentimentChart className="mt-3 text-foreground" gradientId="wt-report" />
          </div>
          <div className="flex flex-col gap-2">
            {["Executive summary", "Complaint analysis", "Competitor intelligence", "Product opportunities"].map((r, i) => (
              <div key={r} className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-[12px]", i === 0 ? "border-primary/30 bg-accent font-medium" : "bg-background")}>
                {r}
                {i === 0 && <FileDown aria-hidden className="size-3.5 text-primary" />}
              </div>
            ))}
            <span className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">
              <FileDown aria-hidden className="size-3.5" /> Export PDF
            </span>
          </div>
        </div>
      )
    default:
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2.5">
            {[
              { title: "“Waiting time” complaints up 38% week-over-week", level: "Warning", tone: "amber" },
              { title: "Average rating dropped below 4.0 at JBR branch", level: "Critical", tone: "rose" },
              { title: "New theme detected: “parking”", level: "Info", tone: "sky" },
            ].map((a) => (
              <div key={a.title} className="flex items-start gap-3 rounded-xl border bg-background p-3">
                <BellRing aria-hidden className={cn("mt-0.5 size-4", a.tone === "amber" && "text-amber-500", a.tone === "rose" && "text-rose-500", a.tone === "sky" && "text-sky-500")} />
                <div>
                  <p className="text-[13px] font-medium">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground">{a.level} · emailed to 3 teammates</p>
                </div>
              </div>
            ))}
          </div>
          <InsightCard />
        </div>
      )
  }
}
