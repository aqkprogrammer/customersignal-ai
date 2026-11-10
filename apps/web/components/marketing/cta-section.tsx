import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CinematicBackground, ReputationIntelligenceCore, TechnicalLabel } from "@/components/signal"
import { Magnetic } from "@/components/signal/magnetic"
import { Reveal } from "./motion"

export function CtaSection({
  title = "Your next best decision is already in your reviews.",
  description = "Start free in minutes. Upload a review export and see your first complaint clusters, gaps and opportunities today.",
}: {
  title?: string
  description?: string
}) {
  return (
    <section aria-labelledby="cta-heading" className="relative overflow-hidden border-t border-border">
      <CinematicBackground light="right" scan={false} />
      <div className="relative mx-auto grid w-full max-w-[1320px] items-center gap-6 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <TechnicalLabel index="END">Ready when you are</TechnicalLabel>
          <h2 id="cta-heading" className="mt-6 max-w-2xl text-[2.2rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-[3.4rem]">
            {title}
          </h2>
          <p className="mt-5 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">{description}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Magnetic className="w-full sm:w-auto">
              <Button asChild variant="signal" className="h-12 w-full rounded-lg px-6 text-[15px] sm:w-auto">
                <Link href="/signup">
                  Start free <ArrowRight data-arrow aria-hidden className="size-4" />
                </Link>
              </Button>
            </Magnetic>
            <Button asChild variant="outline" className="h-12 w-full rounded-lg px-6 text-[15px] sm:w-auto">
              <Link href="/contact?topic=demo">Book a demo</Link>
            </Button>
          </div>
          <p className="mt-6 font-mono text-[10.5px] tracking-[0.14em] text-subtle-foreground uppercase">Free plan · No credit card required · Cancel anytime</p>
        </Reveal>
        <div aria-hidden className="relative mx-auto hidden w-full max-w-[380px] lg:col-span-4 lg:col-start-9 lg:block">
          <ReputationIntelligenceCore detail="lite" title="" />
        </div>
      </div>
    </section>
  )
}

/** Brand motif: the waveform from the logo mark, stretched into a signal line. */
export function SignalLine({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 1200 120" preserveAspectRatio="none" className={className}>
      <path
        d="M0 80 C 80 80, 110 40, 170 40 S 260 100, 320 100 S 410 20, 480 20 S 580 90, 640 90 S 730 50, 800 50 S 900 105, 960 105 S 1060 30, 1120 30 S 1180 70, 1200 70"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}
