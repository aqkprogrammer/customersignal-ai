import { ArrowRight, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DashboardPreview } from "./dashboard-preview"
import { Reveal } from "./motion"
import { Container } from "./section"

export function HomeHero() {
  return (
    <section aria-labelledby="hero-heading" className="relative -mt-16 overflow-hidden pt-16">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_30%,transparent_75%)]" />
        <div className="absolute -top-48 left-1/2 h-[34rem] w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.20),transparent)] blur-2xl" />
        <div className="absolute top-40 -right-40 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.14),transparent)] blur-2xl" />
      </div>

      <Container className="relative pt-16 pb-10 sm:pt-24">
        {/* Hero copy is not opacity-animated so the LCP element paints immediately. */}
        <div className="mx-auto max-w-4xl text-center">
          <Link
            href="/features#gap-finder"
            className="inline-flex items-center gap-2 rounded-full border bg-card/80 py-1 pr-3 pl-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">New</span>
            <span>
              3-Star Gap Finder<span className="hidden sm:inline">: find what stops good from becoming great</span>
            </span>
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
          <h1
            id="hero-heading"
            className="mt-7 text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-[4.6rem]"
          >
            Your Customers Are Telling You <span className="text-gradient">What to Build Next.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted-foreground sm:text-xl sm:leading-relaxed">
            Turn thousands of customer reviews into actionable business intelligence with AI-powered review analysis,
            competitor intelligence, and product opportunity discovery.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="h-12 w-full rounded-xl px-6 text-[15px] shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_12px_28px_-10px_rgba(79,70,229,0.8)] sm:w-auto"
            >
              <Link href="/signup">
                Start Free <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 w-full rounded-xl bg-card px-6 text-[15px] sm:w-auto">
              <Link href="/contact?topic=demo">Book a Demo</Link>
            </Button>
          </div>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden className="size-3.5 text-primary" />
            Free plan · No credit card · Uploads, official APIs and authorized providers only
          </p>
        </div>

        <Reveal delay={0.15} y={28} className="relative mx-auto mt-14 max-w-5xl sm:mt-20">
          <div aria-hidden className="absolute -inset-x-6 -top-6 -bottom-2 rounded-[2rem] bg-gradient-to-b from-indigo-500/10 to-transparent blur-xl" />
          <DashboardPreview className="relative" />
        </Reveal>
      </Container>
    </section>
  )
}
