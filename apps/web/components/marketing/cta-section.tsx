import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Reveal } from "./motion"
import { Container } from "./section"

export function CtaSection({
  title = "Your next best decision is already in your reviews.",
  description = "Start free in minutes. Upload a review export and see your first complaint clusters, gaps and opportunities today.",
}: {
  title?: string
  description?: string
}) {
  return (
    <section aria-labelledby="cta-heading" className="py-20 sm:py-28">
      <Container>
        <Reveal className="relative overflow-hidden rounded-3xl bg-navy px-6 py-14 text-center sm:px-14 sm:py-20">
          <div aria-hidden className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
          <div aria-hidden className="absolute -top-24 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.45),transparent)] blur-2xl" />
          <SignalLine className="absolute inset-x-0 bottom-0 h-24 w-full text-indigo-400/30" />
          <div className="relative mx-auto max-w-2xl">
            <h2 id="cta-heading" className="text-3xl font-semibold tracking-[-0.03em] text-balance text-white sm:text-5xl sm:leading-[1.05]">
              {title}
            </h2>
            <p className="mt-5 text-base text-pretty text-indigo-100/75 sm:text-lg">{description}</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild className="h-11 w-full rounded-xl bg-white px-6 text-[15px] text-navy hover:bg-indigo-50 sm:w-auto">
                <Link href="/signup">
                  Start Free <ArrowRight aria-hidden className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" className="h-11 w-full rounded-xl border border-white/15 px-6 text-[15px] text-white hover:bg-white/10 hover:text-white sm:w-auto">
                <Link href="/contact?topic=demo">Book a Demo</Link>
              </Button>
            </div>
            <p className="mt-5 text-xs text-indigo-200/60">Free plan · No credit card required · Cancel anytime</p>
          </div>
        </Reveal>
      </Container>
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
