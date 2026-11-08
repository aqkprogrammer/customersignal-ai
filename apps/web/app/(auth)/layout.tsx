import { Check, Quote } from "lucide-react"
import { Logo } from "@/components/brand/logo"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f3f4fb] p-3 sm:p-6 dark:bg-background">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-3xl border bg-card shadow-xl shadow-indigo-900/5 sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[1fr_1.05fr]">
        <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-14">
          <Logo />
          <main className="flex flex-1 items-center py-10">
            <div className="w-full max-w-sm">{children}</div>
          </main>
          <p className="text-xs text-muted-foreground">© CustomerSignal AI · Built for teams in the UAE and beyond</p>
        </div>
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#4f46e5] via-[#5b4ff0] to-[#7c3aed] p-12 text-white lg:flex lg:flex-col lg:justify-center">
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="absolute -top-24 -right-24 size-80 rounded-full bg-white/10 blur-3xl" />
          <div className="relative max-w-md">
            <p className="text-sm font-medium text-indigo-100">Customer intelligence platform</p>
            <h2 className="mt-3 text-3xl leading-tight font-semibold">Your customers are telling you what to build next.</h2>
            <p className="mt-4 text-indigo-100">
              CustomerSignal AI turns thousands of reviews into recurring themes, competitor gaps and evidence-backed opportunities.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Sentiment, complaints and trends from your own review data",
                "1-star review cold pitches grounded in real evidence",
                "3-star gap finder and competitor intelligence",
                "Branded PDF reports you can share securely",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <Check className="size-3" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <figure className="mt-10 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
              <Quote className="size-5 text-indigo-200" />
              <blockquote className="mt-2 text-sm leading-relaxed text-indigo-50">
                Every insight links back to the actual reviews behind it — so you can act with confidence, not guesswork.
              </blockquote>
              <figcaption className="mt-3 text-xs text-indigo-200">How CustomerSignal AI works</figcaption>
            </figure>
          </div>
        </aside>
      </div>
    </div>
  )
}
