import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { CtaSection } from "@/components/marketing/cta-section"
import { RevealItem } from "@/components/marketing/motion"
import { Container, PageHero, Section, SectionHeader } from "@/components/marketing/section"
import { pageMetadata } from "@/components/marketing/seo"
import { BUILT_FOR, SOLUTIONS } from "@/components/marketing/site-data"
import { SOLUTION_CONTENT } from "@/components/marketing/solutions-data"

export const metadata = pageMetadata({
  title: "Solutions by industry",
  description:
    "Review intelligence tuned for restaurants, beauty & wellness, clinics, ecommerce brands and marketing agencies — with industry-aware categories and playbooks.",
  path: "/solutions",
})

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title={
          <>
            Built for the businesses <span className="text-gradient">customers review most.</span>
          </>
        }
        description="Every industry has its own vocabulary of praise and complaint. CustomerSignal ships with categories and playbooks that match how your business actually runs."
      />
      <Section labelledBy="industries-heading">
        <Container>
          <h2 id="industries-heading" className="sr-only">
            Industries
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {SOLUTIONS.map((s, i) => {
              const c = SOLUTION_CONTENT[s.slug]
              return (
                <RevealItem key={s.slug} delay={(i % 2) * 0.06} className={i === 0 ? "md:col-span-2" : undefined}>
                  <Link
                    href={`/solutions/${s.slug}`}
                    className="group surface flex h-full flex-col p-6 transition-colors hover:border-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-8"
                  >
                    <span className="flex size-11 items-center justify-center rounded-xl border bg-accent text-primary">
                      <s.icon aria-hidden className="size-5" />
                    </span>
                    <p className="mt-6 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">{s.name}</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight">{c.headline}</h3>
                    <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{s.short}</p>
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {c.themes.slice(0, 4).map((t) => (
                        <span key={t} className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                    <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Explore {s.name.toLowerCase()} <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </RevealItem>
              )
            })}
          </ul>
        </Container>
      </Section>
      <Section labelledBy="more-industries-heading" className="bg-card/50">
        <Container>
          <SectionHeader
            id="more-industries-heading"
            eyebrow="And more"
            title="Works for any business with customer feedback."
            description="Hotels, retail, real estate, automotive and education teams can use the same core platform with general-purpose categories."
          />
          <ul className="mt-10 flex flex-wrap gap-2">
            {BUILT_FOR.map((b) => (
              <li key={b.label} className="flex items-center gap-2 rounded-full border bg-background px-3.5 py-2 text-sm font-medium">
                <b.icon aria-hidden className="size-4 text-primary" /> {b.label}
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <CtaSection />
    </>
  )
}
