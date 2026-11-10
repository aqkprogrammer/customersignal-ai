import type { Metadata } from "next"
import { CtaSection } from "@/components/marketing/cta-section"
import { HOME_FAQ } from "@/components/marketing/faq"
import { HomeHero } from "@/components/marketing/home-hero"
import {
  HomeFaq,
  PricingPreview,
  ProblemSolution,
  SampleInsights,
  Testimonials,
  UseCases,
  WalkthroughSection,
} from "@/components/marketing/home-sections"
import { SignalPath } from "@/components/marketing/signal-path"
import { absoluteUrl, faqJsonLd, JsonLd } from "@/components/marketing/seo"
import { SITE } from "@/lib/site"

const TITLE = "CustomerSignal AI — Your Customers Are Telling You What to Build Next"
const DESCRIPTION =
  "Turn thousands of customer reviews into actionable business intelligence with AI-powered review analysis, competitor intelligence, and product opportunity discovery."

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE.name, title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
}

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": absoluteUrl("/#organization"),
  name: SITE.name,
  url: absoluteUrl("/"),
  logo: absoluteUrl("/icon.svg"),
  description: SITE.description,
  email: SITE.supportEmail,
  areaServed: ["AE", "SA", "QA", "KW", "BH", "OM"],
  contactPoint: [
    { "@type": "ContactPoint", contactType: "sales", email: SITE.salesEmail, availableLanguage: ["English", "Arabic"] },
    { "@type": "ContactPoint", contactType: "customer support", email: SITE.supportEmail, availableLanguage: ["English"] },
  ],
}

const software = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE.name,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: absoluteUrl("/"),
  description: DESCRIPTION,
  publisher: { "@id": absoluteUrl("/#organization") },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "0",
    highPrice: "249",
    offerCount: 5,
    url: absoluteUrl("/pricing"),
  },
  featureList: [
    "AI review analysis",
    "Complaint clustering",
    "3-Star Gap Finder",
    "Competitor intelligence",
    "AI reports with PDF export",
    "Monitoring and alerts",
  ],
}

export default function HomePage() {
  return (
    <>
      <JsonLd data={[organization, software, faqJsonLd(HOME_FAQ)]} />
      <HomeHero />
      <ProblemSolution />
      <SignalPath />
      <SampleInsights />
      <WalkthroughSection />
      <UseCases />
      <PricingPreview />
      <Testimonials />
      <HomeFaq />
      <CtaSection />
    </>
  )
}
