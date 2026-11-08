import { Database, Eye, FileClock, KeyRound, Layers, Lock, Server, ShieldCheck, Users } from "lucide-react"
import Link from "next/link"
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page"
import { pageMetadata } from "@/components/marketing/seo"
import { SITE } from "@/lib/site"

export const metadata = pageMetadata({
  title: "Security",
  description:
    "How CustomerSignal AI protects your data: encryption, tenant isolation, role-based access, audit logs, MFA for administrators, secure AI processing and responsible disclosure.",
  path: "/security",
})

const HIGHLIGHTS = [
  { icon: Lock, title: "Encryption", body: "TLS in transit; encryption at rest for databases, files and stored secrets." },
  { icon: Layers, title: "Tenant isolation", body: "Every query is scoped to a workspace; cross-tenant access is blocked by design." },
  { icon: Users, title: "Role-based access", body: "Owner, admin, analyst and viewer roles with least-privilege defaults." },
  { icon: FileClock, title: "Audit logs", body: "Administrative and security-relevant actions are recorded with actor, time and context." },
  { icon: KeyRound, title: "MFA for admins", body: "Platform administrator accounts are protected with TOTP multi-factor authentication." },
  { icon: Eye, title: "No scraping", body: "Uploads, official APIs and authorized providers only." },
]

const sections: LegalSection[] = [
  {
    id: "overview",
    title: "Overview",
    body: (
      <>
        <ul className="!list-none !pl-0 grid gap-3 sm:grid-cols-2">
          {HIGHLIGHTS.map((h) => (
            <li key={h.title} className="!pl-0 rounded-xl border bg-card p-4">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <h.icon aria-hidden className="size-4 text-primary" /> {h.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{h.body}</p>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: "infrastructure",
    title: "Infrastructure",
    body: (
      <p>
        The platform runs on managed cloud infrastructure with network segmentation, private databases that are not exposed
        to the public internet, automated backups and infrastructure defined as code. Production access is restricted to a
        small number of authorized engineers.
      </p>
    ),
  },
  {
    id: "encryption",
    title: "Encryption",
    body: (
      <ul>
        <li>All traffic is encrypted with TLS. Browsers talk to a single first-party origin, and session cookies are httpOnly and secure.</li>
        <li>Databases, object storage and backups are encrypted at rest.</li>
        <li>Integration credentials and API secrets are encrypted at the application layer before storage; API keys are stored as hashes and shown only once.</li>
      </ul>
    ),
  },
  {
    id: "isolation",
    title: "Tenant isolation",
    body: (
      <p>
        Each customer&apos;s data lives in a workspace. Every API request is authorized against the caller&apos;s workspace
        membership and role, and data access is scoped to that workspace. Shared report links use unguessable, hashed
        tokens that can expire and be revoked.
      </p>
    ),
  },
  {
    id: "access",
    title: "Authentication and access control",
    body: (
      <ul>
        <li>Passwords are hashed with a modern adaptive algorithm; sign-in with Google is supported.</li>
        <li>Short-lived access tokens with refresh rotation, CSRF protection on state-changing requests and rate limiting on sensitive endpoints.</li>
        <li>Role-based access control within workspaces (owner, admin, analyst, viewer).</li>
        <li>Platform administration uses a separate, isolated sign-in with TOTP multi-factor authentication, lockout and audit logging.</li>
      </ul>
    ),
  },
  {
    id: "audit",
    title: "Logging and monitoring",
    body: (
      <p>
        Security-relevant events — sign-ins, role changes, integration changes, exports and administrative actions — are
        recorded in audit logs. We monitor for errors, abuse and anomalous activity and alert on-call engineers.
      </p>
    ),
  },
  {
    id: "ai",
    title: "AI and data handling",
    body: (
      <>
        <p>
          Review text is sent to AI providers only to perform the analysis you request, over encrypted connections. Our
          agreements with AI providers prohibit training their models on your data. We minimize the data sent and avoid
          sending account credentials or billing details.
        </p>
        <p>
          <Database aria-hidden className="mr-1 inline size-4 align-[-2px] text-primary" />
          We never scrape review platforms against their terms. Data enters through uploads, our Reviews API, official
          platform APIs and authorized providers.
        </p>
      </>
    ),
  },
  {
    id: "payments",
    title: "Payments",
    body: (
      <p>
        Payments are processed by Stripe, a PCI DSS Level 1 certified provider. Card data never touches our servers. Billing
        webhooks are signature-verified and processed idempotently.
      </p>
    ),
  },
  {
    id: "development",
    title: "Secure development",
    body: (
      <ul>
        <li>Code review for every change, automated tests and dependency vulnerability scanning.</li>
        <li>Security headers (including frame and content-type protections) on every response.</li>
        <li>Secrets are managed outside source control and rotated when personnel or risk changes.</li>
      </ul>
    ),
  },
  {
    id: "resilience",
    title: "Backups and incident response",
    body: (
      <p>
        Data is backed up regularly and restores are tested. We maintain an incident response process and will notify
        affected customers without undue delay, and within the time required by applicable law, if a personal data breach
        affects their data.
      </p>
    ),
  },
  {
    id: "disclosure",
    title: "Responsible disclosure",
    body: (
      <p>
        <ShieldCheck aria-hidden className="mr-1 inline size-4 align-[-2px] text-primary" />
        Found a vulnerability? Please email <a href={`mailto:${SITE.supportEmail}?subject=Security%20report`}>{SITE.supportEmail}</a>{" "}
        with “Security report” in the subject. Please do not access other customers&apos; data or degrade the service while
        testing. We will acknowledge reports promptly and keep you informed. For enterprise security reviews, questionnaires
        or a DPA, <Link href="/contact?topic=enterprise">contact our team</Link>.
      </p>
    ),
  },
  {
    id: "hosting",
    title: "Sub-processors",
    body: (
      <p>
        <Server aria-hidden className="mr-1 inline size-4 align-[-2px] text-primary" />
        We rely on vetted providers for hosting, AI processing, payments and email. See the{" "}
        <Link href="/privacy#sub-processors">sub-processor section of our Privacy Policy</Link>.
      </p>
    ),
  },
]

export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Trust"
      title="Security at CustomerSignal AI"
      intro={<p>Your customers&apos; words are sensitive business data. Here is how we protect them.</p>}
      sections={sections}
    />
  )
}
