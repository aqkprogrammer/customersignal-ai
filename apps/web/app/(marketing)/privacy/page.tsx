import Link from "next/link"
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page"
import { pageMetadata } from "@/components/marketing/seo"
import { SITE } from "@/lib/site"

export const metadata = pageMetadata({
  title: "Privacy policy",
  description:
    "How CustomerSignal AI collects, uses, stores and protects personal data, including review data, AI processing, sub-processors, retention and your rights under UAE PDPL and GDPR.",
  path: "/privacy",
})

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          {SITE.name} (“we”, “us”) provides a software-as-a-service platform that analyzes customer reviews and feedback to
          produce business insights. We are based in the United Arab Emirates and serve customers in the GCC and
          internationally.
        </p>
        <p>
          For personal data in our customers&apos; workspaces (such as uploaded reviews), our customer is the controller and
          we act as a <strong>processor</strong> on their instructions. For account, billing, website and marketing data, we
          act as the <strong>controller</strong>.
        </p>
      </>
    ),
  },
  {
    id: "data-we-collect",
    title: "Data we collect",
    body: (
      <ul>
        <li>
          <strong>Account data:</strong> name, email, password hash or Google sign-in identifier, and workspace and role
          information.
        </li>
        <li>
          <strong>Customer content:</strong> reviews and feedback you upload or connect, which may include reviewer display
          names, review text, ratings, dates and platform identifiers, together with the analyses, reports and leads you
          generate.
        </li>
        <li>
          <strong>Billing data:</strong> plan, invoices and payment status. Card details are collected and stored by our
          payment processor (Stripe); we do not store full card numbers.
        </li>
        <li>
          <strong>Usage and device data:</strong> log data, IP address, browser type, pages visited and actions taken in the
          product, used for security, troubleshooting and improving the service.
        </li>
        <li>
          <strong>Communications:</strong> messages you send through our contact form, support tickets and emails.
        </li>
      </ul>
    ),
  },
  {
    id: "sources",
    title: "How review data is sourced",
    body: (
      <>
        <p>
          Review data enters the platform only through methods our customers are entitled to use: file uploads (CSV or
          Excel), our Reviews API, official platform APIs that the customer authorizes, and licensed, authorized data
          providers. We do not scrape websites in breach of their terms and we do not circumvent technical access controls.
        </p>
        <p>
          Customers are responsible for ensuring they have the right to upload and process the data they bring to the
          platform. Our features analyze reviews in aggregate and are not designed to profile or contact individual
          reviewers.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use data",
    body: (
      <ul>
        <li>To provide, maintain and secure the service, including AI analysis of customer content.</li>
        <li>To process payments, manage subscriptions and prevent fraud.</li>
        <li>To respond to support requests and send service-related communications.</li>
        <li>To send product updates and marketing where permitted; you can opt out at any time.</li>
        <li>To comply with legal obligations and enforce our terms.</li>
      </ul>
    ),
  },
  {
    id: "ai-processing",
    title: "AI processing",
    body: (
      <>
        <p>
          Review text is sent to third-party AI model providers to generate sentiment, categories, summaries and
          recommendations. We send only the data needed for the task, over encrypted connections, under agreements that
          prohibit providers from using customer content to train their models.
        </p>
        <p>
          AI outputs can be inaccurate. Insights are presented with supporting evidence so that you can verify them before
          acting.
        </p>
      </>
    ),
  },
  {
    id: "legal-bases",
    title: "Legal bases",
    body: (
      <p>
        Depending on the context and applicable law — including the UAE Personal Data Protection Law (Federal Decree-Law No.
        45 of 2021), the Saudi PDPL and, where applicable, the EU/UK GDPR — we rely on performance of a contract, our
        legitimate interests in operating and securing the service, compliance with legal obligations, and consent where
        required (for example, for certain marketing communications or cookies).
      </p>
    ),
  },
  {
    id: "sub-processors",
    title: "Sub-processors",
    body: (
      <>
        <p>We use carefully selected service providers to operate the platform, in the following categories:</p>
        <ul>
          <li>
            <strong>Cloud hosting and storage</strong> — application servers, databases, file storage and backups.
          </li>
          <li>
            <strong>AI model providers</strong> (such as OpenAI and Anthropic) — analysis and report generation.
          </li>
          <li>
            <strong>Payments</strong> (Stripe) — subscription billing and payment processing.
          </li>
          <li>
            <strong>Email delivery</strong> — transactional emails such as verification, alerts and invoices.
          </li>
          <li>
            <strong>Integrations you enable</strong> — for example, HubSpot when you connect it to sync leads.
          </li>
        </ul>
        <p>
          A current list of sub-processors and their locations is available on request from{" "}
          <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. We will notify customers of material changes.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <p>
        Some sub-processors may process data outside the UAE. Where we transfer personal data internationally, we rely on
        the transfer mechanisms permitted by applicable law, such as adequacy, contractual safeguards or other approved
        mechanisms, and we assess the protection offered in the destination country.
      </p>
    ),
  },
  {
    id: "retention",
    title: "Data retention",
    body: (
      <ul>
        <li>
          <strong>Customer content</strong> is retained while your workspace is active. You can delete reviews, projects,
          reports or your entire workspace at any time.
        </li>
        <li>
          After workspace deletion or account closure, customer content is removed from active systems within 30 days and
          from backups within 90 days, unless a longer period is required by law.
        </li>
        <li>
          <strong>Billing records</strong> are kept for the period required by tax and accounting law.
        </li>
        <li>
          <strong>Security and audit logs</strong> are retained for up to 12 months to investigate incidents and abuse.
        </li>
        <li>
          <strong>Shared report links</strong> expire on the date you set and can be revoked at any time.
        </li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        We protect data with encryption in transit and at rest, tenant isolation, role-based access control, audit logging
        and multi-factor authentication for administrative access. Read more on our{" "}
        <Link href="/security">Security page</Link>.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>
          Subject to applicable law, you may have the right to access, correct, delete or export your personal data, to
          object to or restrict certain processing, and to withdraw consent. If your data appears in a customer&apos;s
          workspace (for example, as a reviewer), please contact that business directly; we will assist them in responding.
        </p>
        <p>
          To exercise your rights, email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. You may also lodge
          a complaint with the competent data protection authority, including the UAE Data Office.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>
        We use strictly necessary cookies for authentication, security (including CSRF protection) and remembering your
        workspace. We do not use advertising cookies in the product. Where we use optional analytics on our website, we will
        ask for consent where required.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>The service is intended for businesses and is not directed to anyone under 18.</p>,
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <p>
        We may update this policy and will post the new version here with an updated date, notifying customers of material
        changes. Questions? Contact <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> or use our{" "}
        <Link href="/contact?topic=support">contact form</Link>.
      </p>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy policy"
      intro={<p>This policy explains what personal data we process, why, how long we keep it and the choices you have.</p>}
      sections={sections}
    />
  )
}
