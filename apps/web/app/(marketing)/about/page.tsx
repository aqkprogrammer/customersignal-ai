import { Eye, Globe, Scale, ShieldCheck } from "lucide-react"
import { CtaSection } from "@/components/marketing/cta-section"
import { Reveal, RevealItem } from "@/components/marketing/motion"
import { Container, PageHero, Section, SectionHeader } from "@/components/marketing/section"
import { pageMetadata } from "@/components/marketing/seo"

export const metadata = pageMetadata({
  title: "About us",
  description:
    "CustomerSignal AI is a UAE-first customer intelligence company helping businesses turn reviews into evidence-backed decisions — ethically, securely and in English and Arabic.",
  path: "/about",
})

const PRINCIPLES = [
  {
    icon: Eye,
    title: "Evidence over opinion",
    body: "Every insight links back to the reviews that support it. If we can't show the quotes, we don't make the claim.",
  },
  {
    icon: Scale,
    title: "Ethical by design",
    body: "Uploads, official APIs and authorized providers only. No unauthorized scraping, no contacting reviewers, no shaming businesses.",
  },
  {
    icon: ShieldCheck,
    title: "Security as a feature",
    body: "Tenant isolation, encryption, role-based access and audit logs are part of the product, not an Enterprise add-on.",
  },
  {
    icon: Globe,
    title: "Built for the region",
    body: "Arabic and English, GCC-aware categories, and local competitor context — designed in the UAE for the markets we know.",
  },
]

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title={
          <>
            Customers already tell businesses what to fix. <span className="text-gradient">We help them listen.</span>
          </>
        }
        description="CustomerSignal AI started with a simple observation: the most valuable market research most businesses own is sitting in their reviews, unread."
      />

      <Section labelledBy="story-heading">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeader id="story-heading" eyebrow="Our story" title="From thousands of reviews to one clear next step." />
          <Reveal className="space-y-5 text-[17px] leading-relaxed text-muted-foreground">
            <p>
              A restaurant group with a dozen branches can collect thousands of reviews a year across platforms and in two
              languages. A growing ecommerce brand might collect tens of thousands. Almost nobody reads them systematically
              — and the ones who try end up with spreadsheets, gut feeling and arguments.
            </p>
            <p>
              We built CustomerSignal AI to do that reading for you: classify every review, cluster recurring themes, compare
              you with competitors on the same dimensions, and turn it all into prioritized, evidence-backed recommendations
              your team can act on this week.
            </p>
            <p>
              We are a UAE-first company. That means Arabic and English from day one, an understanding of how GCC customers
              review, and a commitment to data practices that hold up to scrutiny from customers, platforms and regulators.
            </p>
          </Reveal>
        </Container>
      </Section>

      <Section labelledBy="principles-heading" className="bg-card/50">
        <Container>
          <SectionHeader id="principles-heading" eyebrow="Principles" title="How we build." />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <RevealItem key={p.title} delay={(i % 2) * 0.06} className="surface p-6 sm:p-8">
                <p.icon aria-hidden className="size-5 text-primary" />
                <h3 className="mt-5 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{p.body}</p>
              </RevealItem>
            ))}
          </ul>
        </Container>
      </Section>

      <Section labelledBy="stage-heading">
        <Container className="max-w-3xl text-center">
          <SectionHeader
            id="stage-heading"
            align="center"
            eyebrow="Where we are"
            title="Early, focused and building in the open."
            description="We'd rather show you the product than a wall of logos. If you want to shape what we build next, we'd love to hear from you."
          />
        </Container>
      </Section>

      <CtaSection title="Help shape what we build next." description="Join early and get hands-on onboarding, direct access to the team and a voice in the roadmap." />
    </>
  )
}
