import { ArrowRight, Building2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ComparisonTable } from "@/components/marketing/comparison-table"
import { CtaSection } from "@/components/marketing/cta-section"
import { FaqAccordion } from "@/components/marketing/faq"
import { Reveal } from "@/components/marketing/motion"
import { PRICING_FAQ } from "@/components/marketing/pricing-data"
import { PricingPlans } from "@/components/marketing/pricing-plans"
import { Container, PageHero, Section, SectionHeader } from "@/components/marketing/section"
import { faqJsonLd, JsonLd, pageMetadata } from "@/components/marketing/seo"

export const metadata = pageMetadata({
  title: "Pricing",
  description:
    "Simple monthly plans for AI review analysis. Start free with 100 reviews a month, then scale to Starter, Pro, Business or a custom Enterprise plan.",
  path: "/pricing",
})

export default function PricingPage() {
  return (
    <>
      <JsonLd data={faqJsonLd(PRICING_FAQ)} />
      <PageHero
        eyebrow="Pricing"
        title={
          <>
            Pay for insight, <span className="text-gradient">not seats you don&apos;t use.</span>
          </>
        }
        description="Start free, upgrade when your review volume grows. Every paid plan includes a free trial, and you can change or cancel at any time."
      />

      <Section labelledBy="plans-heading" className="pt-12 sm:pt-16">
        <Container className="max-w-7xl">
          <h2 id="plans-heading" className="sr-only">
            Plans
          </h2>
          <PricingPlans />
          <Reveal className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                <Building2 aria-hidden className="size-5" />
              </span>
              <div>
                <p className="font-semibold">Need custom limits, a dedicated contact or a data processing agreement?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enterprise includes dedicated support, API access, advanced permissions and custom integrations.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="h-10 rounded-lg px-4">
              <Link href="/contact?topic=enterprise">
                Talk to sales <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </Reveal>
        </Container>
      </Section>

      <Section labelledBy="compare-heading" className="bg-card/50">
        <Container>
          <SectionHeader id="compare-heading" eyebrow="Compare" title="Every plan, side by side." />
          <Reveal className="mt-10">
            <ComparisonTable />
          </Reveal>
        </Container>
      </Section>

      <Section labelledBy="pricing-faq-heading">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeader
            id="pricing-faq-heading"
            eyebrow="FAQ"
            title="Billing questions."
            description={
              <>
                Still unsure which plan fits?{" "}
                <Link href="/contact?topic=sales" className="font-medium text-primary underline-offset-4 hover:underline">
                  Ask our team
                </Link>
                .
              </>
            }
          />
          <Reveal>
            <FaqAccordion items={PRICING_FAQ} />
          </Reveal>
        </Container>
      </Section>

      <CtaSection />
    </>
  )
}
