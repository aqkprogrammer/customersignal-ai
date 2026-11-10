import { ArrowRight, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TechnicalLabel } from "@/components/signal"
import { FaqAccordion, HOME_FAQ } from "./faq"
import { Reveal, RevealItem } from "./motion"
import { PricingPlans } from "./pricing-plans"
import { ProductWalkthrough } from "./product-walkthrough"
import { Container, Section, SectionHeader } from "./section"
import { SOLUTIONS } from "./site-data"
import { ThemeExplorer } from "./theme-explorer"

const WIDE = "mx-auto w-full max-w-[1320px] px-5 sm:px-8"

/* ------------------------------------------------------------------ 01 · the problem, as an editorial statement */

const PROBLEMS = [
  "Thousands of reviews across branches, platforms and languages — read by nobody.",
  "Star ratings tell you something is wrong, not what or why.",
  "Teams argue from anecdotes while the same complaint repeats for months.",
  "Competitors fix what you ignore, and win your customers on the same street.",
]
const ANSWERS = [
  "Every review analyzed for sentiment, emotion, category and severity.",
  "Recurring complaints clustered and ranked by share and trend.",
  "Evidence-backed recommendations with the quotes to prove them.",
  "Theme-by-theme competitor comparison, and alerts when things change.",
]

export function ProblemSolution() {
  return (
    <section aria-labelledby="problem-heading" className="relative border-t border-border py-20 sm:py-28">
      <div className={WIDE}>
        <Reveal className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <TechnicalLabel index="01 / 06">The problem</TechnicalLabel>
          </div>
          <h2 id="problem-heading" className="text-[2.1rem] leading-[1.06] font-semibold tracking-[-0.042em] text-balance sm:text-[3.1rem] lg:col-span-9">
            Reviews are the most honest research you have. <span className="text-subtle-foreground">Most of it goes unread.</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid lg:grid-cols-12">
          <div className="hidden lg:col-span-3 lg:block" />
          <div className="grid border-t border-border sm:grid-cols-2 lg:col-span-9">
            <Reveal className="py-8 sm:pr-10">
              <TechnicalLabel tone="ember">Without a signal layer</TechnicalLabel>
              <ol className="mt-6 space-y-5">
                {PROBLEMS.map((p, i) => (
                  <li key={p} className="grid grid-cols-[2rem_1fr] text-[15px] leading-snug text-muted-foreground">
                    <span className="font-mono text-[11px] text-subtle-foreground tabular">{String(i + 1).padStart(2, "0")}</span>
                    {p}
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal delay={0.08} className="border-t border-border py-8 sm:border-t-0 sm:border-l sm:pl-10">
              <TechnicalLabel tone="signal">With CustomerSignal</TechnicalLabel>
              <ol className="mt-6 space-y-5">
                {ANSWERS.map((p, i) => (
                  <li key={p} className="grid grid-cols-[2rem_1fr] text-[15px] leading-snug text-foreground">
                    <span className="font-mono text-[11px] text-signal tabular">{String(i + 1).padStart(2, "0")}</span>
                    {p}
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 03 · interactive theme explorer */

export function SampleInsights() {
  return (
    <section aria-labelledby="insights-heading" className="relative border-t border-border bg-background-subtle py-20 sm:py-28">
      <div className={WIDE}>
        <SectionHeader
          split
          id="insights-heading"
          index="03 / 06"
          eyebrow="Try it"
          title="Specific enough to act on this week."
          description="Not “customers are unhappy”. Exactly what, how often, where — and whether it is getting better or worse. Select a theme to explore it."
        />
        <div className="mt-14">
          <ThemeExplorer />
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 04 · product tour */

export function WalkthroughSection() {
  return (
    <Section labelledBy="walkthrough-heading" className="border-t border-border">
      <div className={WIDE}>
        <SectionHeader
          split
          id="walkthrough-heading"
          index="04 / 06"
          eyebrow="Product tour"
          title="Walk through a workspace."
          description="Click through each stage to see what your team works with every day. Every value in the tour is sample data."
        />
        <div className="mt-12">
          <ProductWalkthrough />
        </div>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ 05 · industries as an index */

export function UseCases() {
  return (
    <Section labelledBy="usecases-heading" className="border-t border-border">
      <div className={WIDE}>
        <SectionHeader
          split
          id="usecases-heading"
          index="05 / 06"
          eyebrow="Industries"
          title="Tuned for the places where reviews move revenue."
          description="Industry-aware categories and playbooks, so insights speak your language from day one."
        />
        <ul className="mt-14 border-t border-border">
          {SOLUTIONS.map((s, i) => (
            <RevealItem key={s.slug} delay={i * 0.04}>
              <Link
                href={`/solutions/${s.slug}`}
                className="group grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 border-b border-border py-6 transition-colors hover:bg-surface-hover/40 focus-visible:bg-surface-hover/40 focus-visible:outline-none sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:px-3"
              >
                <span className="font-mono text-[11px] text-subtle-foreground tabular group-hover:text-signal">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex items-center gap-3 text-[1.2rem] font-medium tracking-[-0.02em] text-foreground sm:text-[1.45rem]">
                  <s.icon aria-hidden className="size-4 text-subtle-foreground transition-colors group-hover:text-signal" />
                  {s.name}
                </span>
                <span className="hidden text-[14px] leading-snug text-muted-foreground sm:block">{s.short}</span>
                <ArrowUpRight aria-hidden className="size-4 text-subtle-foreground transition-[color,transform] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-signal" />
              </Link>
            </RevealItem>
          ))}
        </ul>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ 06 · pricing */

export function PricingPreview() {
  return (
    <Section labelledBy="pricing-preview-heading" className="border-t border-border bg-background-subtle">
      <div className={WIDE}>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeader
            id="pricing-preview-heading"
            index="06 / 06"
            eyebrow="Pricing"
            title="Start free. Scale when the insights pay for themselves."
            description="Simple monthly plans. Free forever for small datasets; Enterprise for custom needs."
          />
          <Button asChild variant="outline" className="h-10 self-start rounded-lg px-4 lg:self-auto">
            <Link href="/pricing">
              Compare all plans <ArrowRight data-arrow aria-hidden className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-12">
          <PricingPlans compact />
        </div>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ outcomes (sample personas) */

const SAMPLE_TESTIMONIALS = [
  {
    quote: "We finally stopped debating which branch had a service problem. The clusters showed us in one afternoon.",
    role: "Operations lead, multi-branch restaurant group",
  },
  {
    quote: "The 3-star gap report became our quarterly roadmap. Every item came with real customer quotes attached.",
    role: "Head of product, DTC ecommerce brand",
  },
  {
    quote: "Our pitch decks now open with evidence instead of promises. Prospects take the meeting.",
    role: "Founder, digital marketing agency",
  },
]

export function Testimonials() {
  return (
    <Section labelledBy="testimonials-heading" className="border-t border-border">
      <div className={WIDE}>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeader
              id="testimonials-heading"
              eyebrow="Outcomes"
              title="The outcomes we’re building for."
              description="We’re early, and we won’t invent customers. These are sample personas that illustrate what CustomerSignal is designed to deliver."
            />
            <p className="mt-6">
              <TechnicalLabel tone="ember">Sample personas · not real customers</TechnicalLabel>
            </p>
          </div>
          <ul className="border-t border-border lg:col-span-8">
            {SAMPLE_TESTIMONIALS.map((t, i) => (
              <RevealItem key={t.role} delay={i * 0.06} className="grid gap-3 border-b border-border py-8 sm:grid-cols-[3rem_1fr]">
                <span className="font-mono text-[11px] text-subtle-foreground tabular">{String(i + 1).padStart(2, "0")}</span>
                <figure>
                  <blockquote className="text-[1.3rem] leading-[1.4] font-medium tracking-[-0.02em] text-pretty text-foreground sm:text-[1.5rem]">“{t.quote}”</blockquote>
                  <figcaption className="mt-4 flex items-center gap-3 text-[13px] text-muted-foreground">
                    <span aria-hidden className="h-px w-5 bg-signal" />
                    {t.role} <span className="font-mono text-[10px] tracking-[0.14em] text-ember uppercase">Sample</span>
                  </figcaption>
                </figure>
              </RevealItem>
            ))}
          </ul>
        </div>
        <Reveal className="mt-10 flex flex-col items-start justify-between gap-4 border border-dashed border-signal/30 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium">Be our first case study.</p>
            <p className="mt-1 text-sm text-muted-foreground">Early customers get hands-on onboarding and a say in the roadmap. Tell us about your business.</p>
          </div>
          <Button asChild variant="outline" className="h-10 rounded-lg px-4">
            <Link href="/contact?topic=partnership">
              Talk to us <ArrowRight data-arrow aria-hidden className="size-4" />
            </Link>
          </Button>
        </Reveal>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ FAQ */

export function HomeFaq() {
  return (
    <Section labelledBy="faq-heading" className="border-t border-border bg-background-subtle">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeader
          id="faq-heading"
          eyebrow="FAQ"
          title="Questions, answered."
          description={
            <>
              Something else?{" "}
              <Link className="font-medium text-signal underline-offset-4 hover:underline" href="/contact">
                Contact our team
              </Link>
              .
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
