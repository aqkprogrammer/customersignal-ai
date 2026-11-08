import { ArrowRight, Check, Sparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CtaSection } from "./cta-section"
import { FaqAccordion } from "./faq"
import { Reveal, RevealItem } from "./motion"
import { Container, PageHero, Section, SectionHeader } from "./section"
import { faqJsonLd, JsonLd } from "./seo"
import { SOLUTIONS } from "./site-data"
import { SOLUTION_CONTENT, type SolutionContent } from "./solutions-data"

export function SolutionPage({ slug }: { slug: SolutionContent["slug"] }) {
  const c = SOLUTION_CONTENT[slug]
  const others = SOLUTIONS.filter((s) => s.slug !== slug)
  return (
    <>
      <JsonLd data={faqJsonLd(c.faqs)} />
      <PageHero eyebrow={c.eyebrow} title={c.headline} description={c.intro}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-11 rounded-xl px-5">
            <Link href="/signup">
              Start free <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-xl bg-card px-5">
            <Link href="/contact?topic=demo">Book a demo</Link>
          </Button>
        </div>
      </PageHero>

      <Section labelledBy="pains-heading">
        <Container>
          <SectionHeader id="pains-heading" eyebrow="Why it matters" title="The problems hiding in your reviews." />
          <ul className="mt-12 grid gap-4 md:grid-cols-3">
            {c.pains.map((p, i) => (
              <RevealItem key={p.title} delay={i * 0.06} className="surface p-6">
                <p className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-3 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </RevealItem>
            ))}
          </ul>
        </Container>
      </Section>

      <Section labelledBy="themes-heading" className="bg-card/50">
        <Container className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeader
              id="themes-heading"
              eyebrow="Industry-aware analysis"
              title="Categories that match how your business runs."
              description="Reviews are classified into themes that make sense for your industry, so trends are comparable month to month and branch to branch."
            />
            <Reveal className="mt-8 flex flex-wrap gap-2">
              {c.themes.map((t) => (
                <span key={t} className="rounded-full border bg-background px-3 py-1.5 text-sm font-medium">
                  {t}
                </span>
              ))}
            </Reveal>
          </div>
          <Reveal delay={0.08}>
            <div className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles aria-hidden className="size-4 text-primary" /> Sample insight
                </p>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  SAMPLE
                </span>
              </div>
              <div className="p-6">
                <p className="text-2xl font-semibold tracking-tight">{c.sampleInsight.label}</p>
                <p className="mt-1 text-sm font-medium text-rose-600 dark:text-rose-400">{c.sampleInsight.stat}</p>
                <div className="mt-5 rounded-xl bg-accent/60 p-4">
                  <p className="text-xs font-semibold tracking-wide text-primary uppercase">Recommended action</p>
                  <p className="mt-1.5 text-[15px]">{c.sampleInsight.action}</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Illustrative preview with sample data</p>
          </Reveal>
        </Container>
      </Section>

      <Section labelledBy="plays-heading">
        <Container>
          <SectionHeader id="plays-heading" eyebrow="Playbook" title="What teams do with it." />
          <ul className="mt-12 grid gap-4 md:grid-cols-3">
            {c.plays.map((p, i) => (
              <RevealItem key={p.title} delay={i * 0.06} className="rounded-2xl border bg-card p-6">
                <Check aria-hidden className="size-5 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </RevealItem>
            ))}
          </ul>
        </Container>
      </Section>

      <Section labelledBy="sol-faq-heading" className="bg-card/50">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeader id="sol-faq-heading" eyebrow="FAQ" title={`${c.eyebrow}: common questions`} />
          <Reveal>
            <FaqAccordion items={c.faqs} />
          </Reveal>
        </Container>
      </Section>

      <Section labelledBy="other-solutions-heading" className="py-16 sm:py-20">
        <Container>
          <h2 id="other-solutions-heading" className="text-xl font-semibold tracking-tight">
            Other industries
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/solutions/${s.slug}`}
                  className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <s.icon aria-hidden className="size-4 text-primary" />
                  <span className="text-sm font-medium">{s.name}</span>
                  <ArrowRight aria-hidden className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <CtaSection />
    </>
  )
}
