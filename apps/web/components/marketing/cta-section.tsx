import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { Magnetic } from "@/components/aurora/magnetic"
import { Button } from "@/components/ui/button"
import { Reveal } from "./motion"
import { Container } from "./section"

/** Decorative network motif: signals converging on one insight. */
function NetworkMotif({ className }: { className?: string }) {
  const nodes = [
    [40, 60, 7, "#4169F5"], [90, 150, 5, "#92C9FF"], [30, 230, 6, "#FF8757"], [150, 40, 4, "#B7E66B"],
    [170, 250, 5, "#4169F5"], [120, 300, 4, "#FF8757"], [60, 330, 5, "#B7E66B"],
  ] as const
  return (
    <svg viewBox="0 0 360 380" className={className} aria-hidden>
      {nodes.map(([x, y], i) => (
        <path key={i} d={`M ${x} ${y} C 200 ${y}, 220 190, 300 190`} fill="none" stroke="#F7F6F2" strokeOpacity="0.16" />
      ))}
      {nodes.map(([x, y, r, c], i) => (
        <circle key={`n${i}`} cx={x} cy={y} r={r} fill={c} />
      ))}
      <circle cx="300" cy="190" r="34" fill="#4169F5" fillOpacity="0.25" />
      <circle cx="300" cy="190" r="18" fill="#FF8757" />
    </svg>
  )
}

export function CtaSection({
  title = "Your next best decision is already in your reviews.",
  description = "Start free in minutes. Upload a review export and see your first complaint clusters, gaps and opportunities today.",
}: {
  title?: string
  description?: string
}) {
  return (
    <section aria-labelledby="cta-heading" className="py-16 sm:py-24">
      <Container>
        <Reveal className="dark relative overflow-hidden rounded-[36px] bg-background px-6 py-14 text-foreground sm:px-14 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="bg-dots absolute inset-0 opacity-60" />
            <div className="absolute -top-32 -left-24 size-[460px] rounded-full bg-[radial-gradient(closest-side,rgb(65_105_245/0.5),transparent)]" />
            <div className="absolute -right-24 -bottom-40 size-[420px] rounded-full bg-[radial-gradient(closest-side,rgb(255_135_87/0.35),transparent)]" />
          </div>
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 id="cta-heading" className="text-[2.3rem] leading-[1.04] font-semibold tracking-[-0.045em] text-balance text-white sm:text-[3.4rem]">
                {title}
              </h2>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground sm:text-lg">{description}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Magnetic className="w-full sm:w-auto">
                  <Button asChild variant="signal" className="h-13 w-full rounded-full px-7 text-[16px] sm:w-auto">
                    <Link href="/signup">
                      Start free <ArrowRight data-arrow aria-hidden className="size-4" />
                    </Link>
                  </Button>
                </Magnetic>
                <Button asChild variant="outline" className="h-13 w-full rounded-full border-white/25 px-7 text-[16px] text-white hover:bg-white/10 sm:w-auto">
                  <Link href="/contact?topic=demo">Book a demo</Link>
                </Button>
              </div>
              <p className="mt-6 text-[14px] text-muted-foreground">Free plan · No credit card required · Cancel anytime</p>
            </div>
            <NetworkMotif className="mx-auto hidden w-full max-w-[340px] lg:block" />
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
