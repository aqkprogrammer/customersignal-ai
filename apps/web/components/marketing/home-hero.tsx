import { ArrowRight, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CinematicBackground, SignalScene, TechnicalLabel } from "@/components/signal"
import { Magnetic } from "@/components/signal/magnetic"

const SPEC = [
  { k: "Inputs", v: "CSV · Excel · Reviews API · approved integrations" },
  { k: "Languages", v: "English and العربية, translated side by side" },
  { k: "Analysis", v: "Anthropic or OpenAI — or a labelled built-in engine" },
  { k: "Outputs", v: "Branded PDF reports · alerts · signed webhooks" },
]

export function HomeHero() {
  return (
    <section aria-labelledby="hero-heading" className="relative -mt-16 overflow-hidden pt-16">
      <CinematicBackground />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent,var(--background))]" />

      <div className="relative mx-auto w-full max-w-[1320px] px-5 sm:px-8">
        {/* HUD rule */}
        <div className="flex items-center justify-between border-b border-border py-3">
          <TechnicalLabel index="CS-01">Customer intelligence // Signals into growth</TechnicalLabel>
          <TechnicalLabel className="hidden md:inline-flex">Uploads · official APIs · authorized providers</TechnicalLabel>
        </div>

        <div className="grid items-center gap-10 pt-12 pb-14 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-6 lg:pt-16 lg:pb-16">
          {/* Copy is not opacity-animated so the LCP element paints immediately. */}
          <div className="relative z-10 max-w-xl">
            <Link
              href="/features#gap-finder"
              className="group inline-flex items-center gap-2.5 font-mono text-[11px] tracking-[0.16em] text-signal uppercase transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <span aria-hidden className="h-px w-6 bg-current" />
              New · 3-Star Gap Finder
              <ArrowUpRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-px group-hover:-translate-y-px" />
            </Link>

            <h1
              id="hero-heading"
              className="mt-7 text-[2.7rem] leading-[0.98] font-semibold tracking-[-0.048em] text-balance sm:text-[3.6rem] lg:text-[3.5rem] xl:text-[4.15rem]"
            >
              Your customers are telling you <span className="text-gradient">what to build next.</span>
            </h1>
            <p className="mt-7 max-w-[34rem] text-[16.5px] leading-relaxed text-pretty text-muted-foreground sm:text-lg">
              CustomerSignal reads the reviews you upload or connect — yours and your competitors’ — clusters what keeps
              coming up, and hands you evidence-backed opportunities, with the quotes to prove them.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Magnetic className="w-full sm:w-auto">
                <Button asChild variant="signal" className="h-12 w-full rounded-lg px-6 text-[15px] sm:w-auto">
                  <Link href="/signup">
                    Start free <ArrowRight data-arrow aria-hidden className="size-4" />
                  </Link>
                </Button>
              </Magnetic>
              <Button asChild variant="outline" className="h-12 w-full rounded-lg bg-background/40 px-6 text-[15px] backdrop-blur-sm sm:w-auto">
                <Link href="/contact?topic=demo">Book a demo</Link>
              </Button>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10.5px] tracking-[0.14em] text-subtle-foreground uppercase">
              {["Free plan · no card", "English + Arabic", "No scraping, ever"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <span aria-hidden className="h-px w-2.5 bg-signal/70" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative min-w-0 lg:-mr-8 xl:-mr-16">
            <SignalScene variant="hero" />
          </div>
        </div>

        <dl className="relative grid grid-cols-1 border-y border-border sm:grid-cols-2 lg:grid-cols-4">
          {SPEC.map((f, i) => (
            <div
              key={f.k}
              className={[
                "py-5 sm:px-5",
                i > 0 ? "border-t border-border sm:border-t-0" : "",
                i % 2 === 1 ? "sm:border-l" : "",
                i >= 2 ? "sm:border-t lg:border-t-0" : "",
                i === 2 ? "lg:border-l" : "",
                i === 0 ? "sm:pl-0" : "",
              ].join(" ")}
            >
              <dt className="micro-label flex items-center gap-2">
                <span className="text-signal/80 tabular">{String(i + 1).padStart(2, "0")}</span> {f.k}
              </dt>
              <dd className="mt-2 text-[14px] leading-snug text-foreground/85">{f.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
