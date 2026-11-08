import { TriangleAlert } from "lucide-react"
import { Container, Eyebrow } from "./section"
import { LAST_UPDATED, LAST_UPDATED_LABEL } from "./site-data"

export type LegalSection = { id: string; title: string; body: React.ReactNode }

export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string
  title: string
  intro: React.ReactNode
  sections: LegalSection[]
}) {
  return (
    <article aria-labelledby="legal-title">
      <header className="relative overflow-hidden border-b border-border/60">
        <div aria-hidden className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
        <Container className="relative max-w-5xl pt-16 pb-12 sm:pt-24">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 id="legal-title" className="mt-5 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated: <time dateTime={LAST_UPDATED}>{LAST_UPDATED_LABEL}</time>
          </p>
          <div className="mt-6 max-w-3xl text-lg text-muted-foreground">{intro}</div>
          <p className="mt-6 flex max-w-3xl items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            This document is a template provided for transparency and must be reviewed by qualified legal counsel before it is
            relied on. It does not constitute legal advice.
          </p>
        </Container>
      </header>
      <Container className="grid max-w-5xl gap-12 py-12 sm:py-16 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Sections" className="hidden lg:block">
          <div className="sticky top-24">
            <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Contents</p>
            <ol className="mt-4 space-y-2 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-2 text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:underline focus-visible:outline-none">
                    <span className="w-5 shrink-0 font-mono text-xs tabular-nums opacity-60">{i + 1}.</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
        <div className="min-w-0 space-y-12">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
              <h2 id={`${s.id}-h`} className="text-xl font-semibold tracking-tight sm:text-2xl">
                <span className="mr-2 font-mono text-base text-primary tabular-nums">{i + 1}.</span>
                {s.title}
              </h2>
              <div className="mt-4 space-y-4 text-[16px] leading-relaxed text-foreground/80 [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:pl-1 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </article>
  )
}
