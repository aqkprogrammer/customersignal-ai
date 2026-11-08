import Link from "next/link"
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page"
import { pageMetadata } from "@/components/marketing/seo"
import { SITE } from "@/lib/site"

export const metadata = pageMetadata({
  title: "Terms of service",
  description:
    "The terms that govern use of CustomerSignal AI, including accounts, acceptable data sources, AI outputs, subscriptions, intellectual property and liability.",
  path: "/terms",
})

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement",
    body: (
      <p>
        These Terms of Service (“Terms”) govern access to and use of {SITE.name} (the “Service”). By creating an account or
        using the Service, you agree to these Terms on behalf of yourself and the organization you represent. If you have a
        separate signed agreement with us, that agreement prevails where it conflicts with these Terms.
      </p>
    ),
  },
  {
    id: "accounts",
    title: "Accounts and workspaces",
    body: (
      <ul>
        <li>You must provide accurate information and keep your credentials secure.</li>
        <li>Workspace owners control membership, roles and data within their workspace.</li>
        <li>You are responsible for activity under your account and must notify us promptly of unauthorized use.</li>
        <li>You must be at least 18 and authorized to bind your organization.</li>
      </ul>
    ),
  },
  {
    id: "data-sources",
    title: "Your data and acceptable sources",
    body: (
      <>
        <p>
          You retain all rights to the content you upload or connect (“Customer Data”). You grant us a limited licence to
          host, process and analyze Customer Data solely to provide the Service to you.
        </p>
        <p>You represent that you have all rights and permissions needed to provide Customer Data. You must not:</p>
        <ul>
          <li>upload data obtained by scraping or other means that breach a third party&apos;s terms or applicable law;</li>
          <li>circumvent rate limits, authentication or other technical controls of any platform;</li>
          <li>upload special-category data (such as health records) or data you are not permitted to process.</li>
        </ul>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to use the Service to:</p>
        <ul>
          <li>identify, contact, harass or retaliate against individual reviewers;</li>
          <li>create, buy, sell or solicit fake, incentivized or manipulated reviews;</li>
          <li>send unsolicited commercial messages in breach of applicable marketing laws;</li>
          <li>misrepresent an affiliation with any business or review platform;</li>
          <li>reverse engineer, overload or attempt to gain unauthorized access to the Service;</li>
          <li>violate any applicable law, including data protection, consumer protection and anti-spam laws.</li>
        </ul>
        <p>We may suspend accounts that breach this section, with notice where reasonably practicable.</p>
      </>
    ),
  },
  {
    id: "ai-outputs",
    title: "AI outputs",
    body: (
      <p>
        The Service uses machine learning models to generate analyses, summaries and recommendations. Outputs may be
        incomplete or inaccurate and are provided to support — not replace — your judgment. You are responsible for
        reviewing outputs before relying on them, including any outreach you send based on them.
      </p>
    ),
  },
  {
    id: "subscriptions",
    title: "Plans, billing and trials",
    body: (
      <ul>
        <li>Paid plans are billed in advance on a recurring basis through our payment processor, Stripe.</li>
        <li>Free trials convert to paid plans unless cancelled before the trial ends.</li>
        <li>Usage limits (projects, reviews, reports, members) apply per plan as described on our <Link href="/pricing">pricing page</Link>.</li>
        <li>“Unlimited (fair use)” features are subject to reasonable use that does not degrade the Service for others.</li>
        <li>Fees are exclusive of taxes unless stated. Except where required by law, fees are non-refundable.</li>
        <li>You may cancel at any time; access continues until the end of the paid period.</li>
      </ul>
    ),
  },
  {
    id: "ip",
    title: "Intellectual property",
    body: (
      <p>
        We own the Service, including software, models we develop, designs and documentation. Reports you generate from
        your Customer Data are yours to use. Feedback you give us may be used to improve the Service without obligation.
      </p>
    ),
  },
  {
    id: "confidentiality",
    title: "Confidentiality and data protection",
    body: (
      <p>
        Each party will protect the other&apos;s confidential information with reasonable care. Our processing of personal
        data is described in our <Link href="/privacy">Privacy Policy</Link>; a data processing agreement is available on
        request.
      </p>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party services",
    body: (
      <p>
        Integrations with third-party platforms (such as HubSpot, Google Business Profile or Trustpilot) are subject to those
        providers&apos; terms. Some integrations require approval from the platform and may change or become unavailable
        if the provider changes its policies.
      </p>
    ),
  },
  {
    id: "warranties",
    title: "Warranties and disclaimers",
    body: (
      <p>
        We will provide the Service with reasonable skill and care. Except as expressly stated, the Service is provided “as
        is” and we disclaim implied warranties to the maximum extent permitted by law.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the maximum extent permitted by law, neither party is liable for indirect, incidental or consequential damages or
        loss of profits, and each party&apos;s aggregate liability is limited to the fees paid by you in the 12 months
        before the claim. These limits do not apply to liability that cannot be limited by law.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Term and termination",
    body: (
      <p>
        These Terms apply while you use the Service. Either party may terminate for material breach not cured within 30
        days of notice. On termination you may export Customer Data for 30 days, after which it is deleted as described in
        our Privacy Policy.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These Terms are governed by the laws of the United Arab Emirates as applied in the Emirate of Dubai. Disputes are
        subject to the exclusive jurisdiction of the competent courts of Dubai, unless otherwise agreed in writing.
        (Counsel should confirm the appropriate forum, for example onshore Dubai courts or DIFC Courts.)
      </p>
    ),
  },
  {
    id: "contact",
    title: "Changes and contact",
    body: (
      <p>
        We may update these Terms and will notify customers of material changes in advance. Questions? Email{" "}
        <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of service"
      intro={<p>Plain-language terms for using CustomerSignal AI responsibly.</p>}
      sections={sections}
    />
  )
}
