import { ArrowRight, ArrowUpRight, BrainCircuit, CircleCheck, Quote, Upload, X, Zap } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FEATURES } from "./features-data"
import { FaqAccordion, HOME_FAQ } from "./faq"
import { Reveal, RevealItem } from "./motion"
import { PricingPlans } from "./pricing-plans"
import { ProductWalkthrough } from "./product-walkthrough"
import { Container, Section, SectionHeader } from "./section"
import { BUILT_FOR, SOLUTIONS } from "./site-data"
import { cn } from "@/lib/utils"

export function BuiltForStrip() {
  return (
    <section aria-labelledby="built-for-heading" className="border-y border-border/60 bg-card/50 py-10">
      <Container>
        <h2 id="built-for-heading" className="text-center font-mono text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Built for businesses that live and die by their reviews
        </h2>
        <ul className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:grid-cols-8">
          {BUILT_FOR.map((b) => (
            <li key={b.label} className="flex items-center justify-center gap-2 text-sm font-medium text-foreground/75">
              <b.icon aria-hidden className="size-4 text-primary/80" />
              {b.label}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

const PROBLEMS = [
  "Thousands of reviews across branches, platforms and languages — read by nobody.",
  "Star ratings tell you something is wrong, not what or why.",
  "Teams argue from anecdotes while the same complaint repeats for months.",
  "Competitors fix what you ignore, and win your customers on the same street.",
]
const SOLUTIONS_LIST = [
  "Every review analyzed for sentiment, emotion, category and severity.",
  "Recurring complaints clustered and ranked by share and trend.",
  "Evidence-backed recommendations with the quotes to prove them.",
  "Theme-by-theme competitor comparison and alerts when things change.",
]

export function ProblemSolution() {
  return (
    <Section labelledBy="problem-heading" className="bg-navy text-white">
      <div aria-hidden className="bg-grid absolute inset-0 opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <Container className="relative">
        <SectionHeader
          id="problem-heading"
          invert
          eyebrow="The problem"
          title={
            <>
              Reviews are the most honest research you have.{" "}
              <span className="text-indigo-200/60">Most of it goes unread.</span>
            </>
          }
        />
        <div className="mt-14 grid gap-4 lg:grid-cols-2">
          <Reveal className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.16em] text-rose-300/80 uppercase">Without CustomerSignal</p>
            <ul className="mt-6 space-y-4">
              {PROBLEMS.map((p) => (
                <li key={p} className="flex gap-3 text-[15px] text-indigo-100/75">
                  <X aria-hidden className="mt-0.5 size-4 shrink-0 text-rose-300/70" />
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.08} className="rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.16em] text-indigo-200 uppercase">With CustomerSignal</p>
            <ul className="mt-6 space-y-4">
              {SOLUTIONS_LIST.map((p) => (
                <li key={p} className="flex gap-3 text-[15px] text-white">
                  <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-indigo-300" />
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}

export function FeatureOverview() {
  return (
    <Section labelledBy="features-heading">
      <Container>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeader
            id="features-heading"
            eyebrow="Platform"
            title="One workspace for everything your customers are saying."
            description="Seven connected modules that take you from raw reviews to decisions, reports and revenue."
          />
          <Button asChild variant="outline" className="h-10 self-start rounded-lg px-4 md:self-auto">
            <Link href="/features">
              Explore all features <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </div>
        <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <li key={f.id} className={cn("bg-card", i === 0 && "lg:col-span-2")}>
              <Link
                href={`/features#${f.id}`}
                className="group flex h-full flex-col p-6 transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none sm:p-8"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl border bg-background text-primary">
                    <f.icon aria-hidden className="size-5" />
                  </span>
                  <ArrowUpRight aria-hidden className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                </div>
                <h3 className="mt-6 text-lg font-semibold tracking-tight">{f.name}</h3>
                <p className="mt-1 text-sm font-medium text-primary">{f.tagline}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </Link>
            </li>
          ))}
          <li className="flex flex-col justify-center bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white sm:p-8">
            <p className="text-lg font-semibold">See it with your own reviews.</p>
            <p className="mt-2 text-sm text-indigo-100/85">Upload an export and get your first insights in minutes.</p>
            <Link href="/signup" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline">
              Start free <ArrowRight aria-hidden className="size-4" />
            </Link>
          </li>
        </ul>
      </Container>
    </Section>
  )
}

const STEPS = [
  {
    icon: Upload,
    title: "Upload or connect",
    body: "Drop in CSV or Excel exports, push via the Reviews API, or connect approved platform integrations. No scraping, ever.",
  },
  {
    icon: BrainCircuit,
    title: "AI analyzes",
    body: "Sentiment, emotion, categories, clusters, gaps and competitor comparisons — across English and Arabic reviews.",
  },
  {
    icon: Zap,
    title: "Act on evidence",
    body: "Prioritized recommendations with supporting quotes, shareable PDF reports and alerts when a theme starts rising.",
  },
]

export function HowItWorks() {
  return (
    <Section labelledBy="how-heading" className="bg-card/50">
      <Container>
        <SectionHeader id="how-heading" align="center" eyebrow="How it works" title="From review export to roadmap in three steps." />
        <div className="relative mt-16">
          <div aria-hidden className="absolute top-6 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent md:block" />
          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
          {STEPS.map((s, i) => (
            <RevealItem key={s.title} delay={i * 0.08} className="relative text-center">
                <span className="relative mx-auto flex size-12 items-center justify-center rounded-2xl border bg-background text-primary shadow-sm">
                  <s.icon aria-hidden className="size-5" />
                  <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-6 text-lg font-semibold">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </RevealItem>
          ))}
          </ol>
        </div>
      </Container>
    </Section>
  )
}

export function UseCases() {
  return (
    <Section labelledBy="usecases-heading">
      <Container>
        <SectionHeader
          id="usecases-heading"
          eyebrow="Use cases"
          title="Tuned for the industries where reviews move revenue."
          description="Industry-aware categories and playbooks, so insights speak your language from day one."
        />
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {SOLUTIONS.map((s, i) => (
            <RevealItem key={s.slug} delay={i * 0.05} className="h-full">
                <Link
                  href={`/solutions/${s.slug}`}
                  className="group surface flex h-full flex-col p-5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <s.icon aria-hidden className="size-5 text-primary" />
                  <h3 className="mt-5 text-[15px] font-semibold">{s.name}</h3>
                  <p className="mt-2 flex-1 text-sm leading-snug text-muted-foreground">{s.short}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Learn more <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
            </RevealItem>
          ))}
        </ul>
      </Container>
    </Section>
  )
}

export function WalkthroughSection() {
  return (
    <Section labelledBy="walkthrough-heading" className="bg-card/50">
      <Container>
        <SectionHeader
          id="walkthrough-heading"
          eyebrow="Product tour"
          title="Walk through a workspace."
          description="Click through each stage to see what your team works with every day."
        />
        <div className="mt-12">
          <ProductWalkthrough />
        </div>
      </Container>
    </Section>
  )
}

const INSIGHTS = [
  { label: "Long waiting times", stat: "23% of reviews", trend: "rising", note: "Weekend lunch peak, Marina branch" },
  { label: "Friendly, attentive staff", stat: "31% of reviews", trend: "stable", note: "Strongest driver of 5-star ratings" },
  { label: "Booking confirmation confusion", stat: "9% of reviews", trend: "new", note: "Started after the app update" },
  { label: "Value for money", stat: "14% of reviews", trend: "declining", note: "Complaints easing since menu refresh" },
]

export function SampleInsights() {
  return (
    <Section labelledBy="insights-heading">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <SectionHeader
            id="insights-heading"
            eyebrow="Sample insights"
            title="Specific enough to act on this week."
            description="Not “customers are unhappy”. Exactly what, how often, where — and whether it is getting better or worse."
          />
          <Reveal>
            <div className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <p className="text-sm font-semibold">Top themes · last 90 days</p>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  SAMPLE
                </span>
              </div>
              <ul className="divide-y">
                {INSIGHTS.map((i) => (
                  <li key={i.label} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="text-[15px] font-medium">{i.label}</p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">{i.note}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{i.stat}</p>
                      <p
                        className={cn(
                          "mt-0.5 text-[12px] font-medium capitalize",
                          i.trend === "rising" && "text-rose-600 dark:text-rose-400",
                          i.trend === "declining" && "text-emerald-600 dark:text-emerald-400",
                          i.trend === "stable" && "text-muted-foreground",
                          i.trend === "new" && "text-violet-600 dark:text-violet-400",
                        )}
                      >
                        {i.trend}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Sample data for illustration — not from a real business.</p>
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}

export function PricingPreview() {
  return (
    <Section labelledBy="pricing-preview-heading" className="bg-card/50">
      <Container>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeader
            id="pricing-preview-heading"
            eyebrow="Pricing"
            title="Start free. Scale when the insights pay for themselves."
            description="Simple monthly plans. Free forever for small datasets; Enterprise for custom needs."
          />
          <Button asChild variant="outline" className="h-10 self-start rounded-lg px-4 md:self-auto">
            <Link href="/pricing">
              Compare all plans <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-12">
          <PricingPlans compact />
        </div>
      </Container>
    </Section>
  )
}

const SAMPLE_TESTIMONIALS = [
  {
    quote: "We finally stopped debating which branch had a service problem. The clusters showed us in one afternoon.",
    role: "Operations lead, multi-branch restaurant group (sample persona)",
  },
  {
    quote: "The 3-star gap report became our quarterly roadmap. Every item came with real customer quotes attached.",
    role: "Head of product, DTC ecommerce brand (sample persona)",
  },
  {
    quote: "Our pitch decks now open with evidence instead of promises. Prospects take the meeting.",
    role: "Founder, digital marketing agency (sample persona)",
  },
]

export function Testimonials() {
  return (
    <Section labelledBy="testimonials-heading">
      <Container>
        <SectionHeader
          id="testimonials-heading"
          eyebrow="What teams tell us they want"
          title="The outcomes we're building for."
          description="We're early, and we won't invent customers. These quotes illustrate the outcomes CustomerSignal is designed to deliver."
        />
        <p className="mt-6 inline-flex rounded-md border border-amber-500/30 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          Sample testimonials — illustrative, not from real customers
        </p>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {SAMPLE_TESTIMONIALS.map((t, i) => (
            <RevealItem key={t.role} delay={i * 0.06} className="surface flex h-full flex-col p-6">
                <Quote aria-hidden className="size-5 text-primary/60" />
                <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-foreground">“{t.quote}”</blockquote>
                <p className="mt-6 border-t pt-4 text-[13px] text-muted-foreground">{t.role}</p>
            </RevealItem>
          ))}
        </ul>
        <Reveal className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-dashed border-primary/30 bg-accent/40 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold">Be our first case study.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Early customers get hands-on onboarding and a say in the roadmap. Tell us about your business.
            </p>
          </div>
          <Button asChild className="h-10 rounded-lg px-4">
            <Link href="/contact?topic=partnership">
              Talk to us <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </Reveal>
      </Container>
    </Section>
  )
}

export function HomeFaq() {
  return (
    <Section labelledBy="faq-heading" className="bg-card/50">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeader
          id="faq-heading"
          eyebrow="FAQ"
          title="Questions, answered."
          description={
            <>
              Something else? <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/contact">Contact our team</Link>.
            </>
          }
        />
        <Reveal>
          <FaqAccordion items={HOME_FAQ} />
        </Reveal>
      </Container>
    </Section>
  )
}
