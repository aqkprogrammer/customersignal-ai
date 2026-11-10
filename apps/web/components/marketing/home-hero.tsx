import { ArrowRight, Check } from "lucide-react"
import Link from "next/link"
import { IntelligenceVisualization } from "@/components/aurora"
import { Magnetic } from "@/components/aurora/magnetic"
import { Button } from "@/components/ui/button"
import { HeroWords } from "./hero-words"

const TRUST = ["Free plan, no credit card", "English and Arabic reviews", "Official access only — no scraping"]

export function HomeHero() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden pt-28 pb-12 sm:pt-36 sm:pb-24 lg:pb-32">
      {/* light & geometry */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-dots absolute inset-0 [mask-image:radial-gradient(ellipse_60%_60%_at_70%_40%,#000_30%,transparent_80%)]" />
        <div className="absolute -top-40 right-[-12%] size-[760px] rounded-full bg-[radial-gradient(closest-side,rgb(255_213_190/0.85),transparent)]" />
        <div className="absolute top-[30%] left-[-14%] size-[560px] rounded-full bg-[radial-gradient(closest-side,rgb(146_201_255/0.42),transparent)]" />
        <svg className="absolute top-24 right-[4%] hidden h-[640px] w-[640px] text-[#4169F5] lg:block" viewBox="0 0 640 640" fill="none">
          <circle cx="320" cy="320" r="318" stroke="currentColor" strokeOpacity="0.08" />
          <circle cx="320" cy="320" r="240" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="2 8" />
        </svg>
      </div>

      <div className="relative mx-auto grid w-full max-w-[1240px] items-center gap-16 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-10">
        <div className="relative z-10">
          <Link
            href="/features#gap-finder"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-white/70 py-1 pr-3 pl-1 text-[13.5px] font-medium text-muted-foreground backdrop-blur transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
          >
            <span className="rounded-full bg-[#B7E66B] px-2 py-0.5 text-[12px] font-semibold text-[#20330a]">New</span>
            3-Star Gap Finder — what stops good becoming great
            <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>

          {/* The headline is static markup (LCP); HeroWords only animates the highlighted phrase in. */}
          <h1 id="hero-heading" className="mt-8 text-[2.9rem] leading-[0.98] font-semibold tracking-[-0.055em] text-balance text-foreground sm:text-[4.2rem] lg:text-[3.9rem] xl:text-[4.5rem]">
            Your customers are telling you <HeroWords />
          </h1>
          <p className="mt-7 max-w-[34rem] text-[18px] leading-relaxed text-pretty text-muted-foreground sm:text-[19px]">
            CustomerSignal reads the reviews you upload or connect — yours and your competitors’ — finds the themes that keep
            coming back, and turns them into evidence-backed opportunities your team can act on.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Magnetic className="w-full sm:w-auto">
              <Button asChild variant="signal" className="h-13 w-full rounded-full px-7 text-[16px] sm:w-auto">
                <Link href="/signup">
                  Start free <ArrowRight data-arrow aria-hidden className="size-4" />
                </Link>
              </Button>
            </Magnetic>
            <Button asChild variant="outline" className="h-13 w-full rounded-full px-7 text-[16px] sm:w-auto">
              <Link href="/contact?topic=demo">Book a demo</Link>
            </Button>
          </div>

          <ul className="mt-9 flex flex-col gap-2.5 text-[14.5px] text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-6">
            {TRUST.map((t) => (
              <li key={t} className="inline-flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#B7E66B]/45 text-[#3b6b0c]">
                  <Check aria-hidden className="size-3" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative min-w-0 lg:-mr-6">
          <IntelligenceVisualization />
        </div>
      </div>
    </section>
  )
}
