import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { CinematicBackground, SignalScene, StatusDot, TechnicalLabel } from "@/components/signal"
import { ApiWarmup } from "@/components/shared/api-warmup"
import { ForceDark } from "@/components/signal/force-dark"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <ForceDark />
      <ApiWarmup />
      <div className="mx-auto grid min-h-dvh max-w-[1680px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]">
        {/* ---------------------------------------------------- workspace access terminal */}
        <div className="relative flex flex-col overflow-hidden px-5 py-5 sm:px-10 lg:px-14">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="bg-tech-grid absolute inset-x-0 top-0 h-[380px] opacity-70 [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_0%_0%,color-mix(in_oklab,var(--signal)_8%,transparent),transparent_70%)]" />
          </div>
          <header className="relative flex items-center justify-between gap-4">
            <Logo />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-sm font-mono text-[10.5px] tracking-[0.14em] text-subtle-foreground uppercase transition-colors hover:text-signal focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <ArrowLeft className="size-3.5" /> Back to site
            </Link>
          </header>
          <main className="relative flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-[420px]">{children}</div>
          </main>
          <footer className="relative flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 font-mono text-[10.5px] tracking-[0.12em] text-subtle-foreground uppercase">
            <span>© CustomerSignal AI · UAE</span>
            <span className="flex gap-5">
              <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
              <Link href="/contact" className="transition-colors hover:text-foreground">Help</Link>
            </span>
          </footer>
        </div>

        {/* ---------------------------------------------------- immersive intelligence panel */}
        <aside aria-hidden className="relative hidden overflow-hidden border-l border-border bg-background-subtle lg:flex lg:flex-col">
          <CinematicBackground light="center" />
          <div className="relative flex items-center justify-between border-b border-border px-10 py-4">
            <TechnicalLabel>
              <span className="inline-flex items-center gap-2">
                <StatusDot tone="signal" /> Intelligence core · demo loop
              </span>
            </TechnicalLabel>
            <TechnicalLabel>Uploads · official APIs only</TechnicalLabel>
          </div>
          <div className="relative px-10 pt-10 xl:px-14">
            <TechnicalLabel tone="signal">Customer intelligence // Signals into growth</TechnicalLabel>
            <p className="mt-4 max-w-md text-[1.9rem] leading-[1.06] font-semibold tracking-[-0.04em] text-balance">
              Every insight links back to the reviews behind it.
            </p>
          </div>
          <div className="relative flex flex-1 flex-col justify-center px-8 py-8 xl:px-14">
            <div className="mx-auto w-full" style={{ maxWidth: "min(640px, calc((100dvh - 370px) * 0.842))" }}>
              <SignalScene variant="auth" />
            </div>
          </div>
          <div className="relative grid grid-cols-3 divide-x divide-border border-t border-border">
            {["No scraping, ever", "English + العربية", "Evidence on every insight"].map((t) => (
              <span key={t} className="flex items-center gap-2 px-6 py-4 font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase xl:px-10">
                <span className="size-1 rounded-full bg-signal" /> {t}
              </span>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
