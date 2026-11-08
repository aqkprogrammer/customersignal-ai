import { ArrowRight, Check } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CtaSection } from "@/components/marketing/cta-section"
import { ClusterList, InsightCard, SentimentChart } from "@/components/marketing/dashboard-preview"
import { FEATURES } from "@/components/marketing/features-data"
import { Reveal } from "@/components/marketing/motion"
import { Container, Eyebrow, PageHero } from "@/components/marketing/section"
import { pageMetadata } from "@/components/marketing/seo"
import { cn } from "@/lib/utils"

export const metadata = pageMetadata({
  title: "Features",
  description:
    "Review intelligence, 1-star Opportunity Finder, 3-Star Gap Finder, competitor intelligence, AI PDF reports, monitoring and integrations — everything to turn reviews into decisions.",
  path: "/features",
})

function Visual({ index }: { index: number }) {
  const v = index % 3
  return (
    <div className="surface relative overflow-hidden p-5 sm:p-6">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative">
        {v === 0 && (
          <>
            <p className="mb-3 text-[13px] font-semibold">Complaint clusters</p>
            <ClusterList />
          </>
        )}
        {v === 1 && <InsightCard />}
        {v === 2 && (
          <>
            <p className="mb-2 text-[13px] font-semibold">Sentiment trend</p>
            <SentimentChart className="text-foreground" gradientId={`feat-${index}`} />
          </>
        )}
        <p className="mt-4 text-[11px] text-muted-foreground">Illustrative preview with sample data</p>
      </div>
    </div>
  )
}

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title={
          <>
            Everything between a review and <span className="text-gradient">a better business.</span>
          </>
        }
        description="Seven modules that work together: understand what customers say, find what to fix and build, compare against competitors, and keep everyone informed."
      >
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

      <nav aria-label="Features on this page" className="sticky top-16 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <Container>
          <ul className="flex gap-1 overflow-x-auto py-2.5 text-sm">
            {FEATURES.map((f) => (
              <li key={f.id} className="shrink-0">
                <a href={`#${f.id}`} className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </nav>

      <Container className="py-12 sm:py-20">
        <div className="space-y-24 sm:space-y-32">
          {FEATURES.map((f, i) => (
            <section key={f.id} id={f.id} aria-labelledby={`${f.id}-title`} className="scroll-mt-32">
              <div className={cn("grid items-center gap-10 lg:grid-cols-2 lg:gap-16", i % 2 === 1 && "lg:[&>*:first-child]:order-2")}>
                <Reveal>
                  <Eyebrow>{String(i + 1).padStart(2, "0")} · {f.tagline}</Eyebrow>
                  <h2 id={`${f.id}-title`} className="mt-4 flex items-center gap-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                    <span className="flex size-10 items-center justify-center rounded-xl border bg-card text-primary">
                      <f.icon aria-hidden className="size-5" />
                    </span>
                    {f.name}
                  </h2>
                  <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{f.description}</p>
                  <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-[15px]">
                        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </Reveal>
                <Reveal delay={0.08}>
                  <Visual index={i} />
                </Reveal>
              </div>
            </section>
          ))}
        </div>
      </Container>

      <CtaSection />
    </>
  )
}
