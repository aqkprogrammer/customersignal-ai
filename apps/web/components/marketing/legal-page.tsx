import { TriangleAlert } from "lucide-react"
import { ScrollSpyNav } from "./scroll-spy-nav"
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
      <header className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="bg-dots absolute inset-0 [mask-image:radial-gradient(ellipse_70%_80%_at_30%_0%,black_20%,transparent_75%)]" />
          <div className="absolute -top-40 right-[-8%] size-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(255_213_190/0.7),transparent)]" />
        </div>
        <Container className="relative max-w-6xl pt-32 pb-14 sm:pt-40">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 id="legal-title" className="mt-6 text-[2.6rem] leading-[1.04] font-semibold tracking-[-0.045em] text-balance sm:text-[3.6rem]">
            {title}
          </h1>
          <p className="mt-4 text-[14px] text-muted-foreground">
            Last updated: <time dateTime={LAST_UPDATED}>{LAST_UPDATED_LABEL}</time>
          </p>
          <div className="mt-6 max-w-3xl text-[18px] leading-relaxed text-muted-foreground">{intro}</div>
          <p className="mt-6 flex max-w-3xl items-start gap-2.5 rounded-2xl border border-[#FF8757]/30 bg-[#FFF1E8] px-5 py-4 text-[14px] leading-relaxed text-[#7a3412]">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            This document is a template provided for transparency and must be reviewed by qualified legal counsel before it is
            relied on. It does not constitute legal advice.
          </p>
        </Container>
      </header>
      <Container className="grid max-w-6xl gap-12 py-14 sm:py-20 lg:grid-cols-[16rem_1fr]">
        <div className="hidden lg:block">
          <div className="sticky top-28">
            <ScrollSpyNav items={sections.map((x) => ({ id: x.id, title: x.title }))} />
          </div>
        </div>
        <div className="min-w-0 space-y-12">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28">
              <h2 id={`${s.id}-h`} className="flex items-baseline gap-3 text-[1.4rem] font-semibold tracking-[-0.03em] sm:text-[1.65rem]">
                <span className="font-mono text-[14px] text-[#4169F5] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </h2>
              <div className="mt-4 space-y-4 text-[16.5px] leading-relaxed text-foreground/80 [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:pl-1 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </article>
  )
}
