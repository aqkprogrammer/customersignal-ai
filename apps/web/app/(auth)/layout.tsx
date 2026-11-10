import Link from "next/link"
import { ArrowLeft, Check } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { IntelligenceVisualization } from "@/components/aurora"
import { ApiWarmup } from "@/components/shared/api-warmup"
import { ForceLight } from "@/components/shared/force-light"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="light min-h-dvh bg-background text-foreground">
      <ApiWarmup />
      <ForceLight />
      <div className="mx-auto grid min-h-dvh max-w-[1680px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ---------------------------------------------------- form side (warm ivory) */}
        <div className="relative flex flex-col overflow-hidden px-5 py-6 sm:px-10 lg:px-16">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="bg-dots absolute inset-x-0 top-0 h-[420px] [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
            <div className="absolute -top-40 -left-40 size-[480px] rounded-full bg-[radial-gradient(closest-side,rgb(255_213_190/0.7),transparent)]" />
          </div>
          <header className="relative flex items-center justify-between gap-4">
            <Logo />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <ArrowLeft className="size-4" /> Back to site
            </Link>
          </header>
          <main className="relative flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-[440px]">{children}</div>
          </main>
          <footer className="relative flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted-foreground">
            <span>© CustomerSignal AI · Built in the UAE</span>
            <span className="flex gap-5">
              <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
              <Link href="/contact" className="transition-colors hover:text-foreground">Help</Link>
            </span>
          </footer>
        </div>

        {/* ---------------------------------------------------- showcase side (navy) */}
        <aside className="dark relative hidden overflow-hidden bg-background p-3 lg:block">
          <div className="relative flex h-full flex-col overflow-hidden rounded-[32px] bg-[#17243B] px-10 py-10 xl:px-14">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="bg-dots absolute inset-0 opacity-70" />
              <div className="absolute -top-40 -right-32 size-[560px] rounded-full bg-[radial-gradient(closest-side,rgb(65_105_245/0.45),transparent)]" />
              <div className="absolute -bottom-48 -left-24 size-[480px] rounded-full bg-[radial-gradient(closest-side,rgb(255_135_87/0.25),transparent)]" />
            </div>
            <div className="relative">
              <p className="text-[13px] font-semibold tracking-[0.08em] text-[#92C9FF] uppercase">Customer intelligence</p>
              <p className="mt-4 max-w-lg text-[2.1rem] leading-[1.08] font-semibold tracking-[-0.04em] text-balance text-white">
                Every insight links back to the reviews behind it.
              </p>
            </div>
            <div className="relative mt-10 flex flex-1 items-center">
              <div className="mx-auto w-full max-w-[640px] pb-12" aria-hidden>
                <IntelligenceVisualization />
              </div>
            </div>
            <ul className="relative mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-muted-foreground">
              {["No scraping — official access only", "English and Arabic", "Evidence on every insight"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <Check className="size-4 text-lime" strokeWidth={3} /> {t}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
