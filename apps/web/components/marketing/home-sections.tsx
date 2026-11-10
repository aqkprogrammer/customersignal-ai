import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FaqAccordion, HOME_FAQ } from "./faq"
import { Reveal } from "./motion"
import { PricingPlans } from "./pricing-plans"
import { Container, Section, SectionHeader } from "./section"

/* ------------------------------------------------------------------ 08 · pricing */

export function PricingPreview() {
  return (
    <Section labelledBy="pricing-preview-heading" className="bg-white">
      <Container>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeader
            id="pricing-preview-heading"
            index="08"
            eyebrow="Pricing"
            title="Start free. Scale when the insights pay for themselves."
            description="Simple monthly plans. Free forever for small datasets; Enterprise for custom needs."
          />
          <Button asChild variant="outline" className="h-11 self-start rounded-full px-5 text-[15px] lg:self-auto">
            <Link href="/pricing">
              Compare all plans <ArrowRight data-arrow aria-hidden className="size-4" />
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

/* ------------------------------------------------------------------ 09 · FAQ */

export function HomeFaq() {
  return (
    <Section labelledBy="faq-heading">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.5fr]">
        <SectionHeader
          id="faq-heading"
          index="09"
          eyebrow="FAQ"
          title="Questions, answered."
          description={
            <>
              Something else?{" "}
              <Link className="font-semibold text-[#2f52dd] underline-offset-4 hover:underline" href="/contact">
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
