import {
  ArrowRight,
  Bot,
  CreditCard,
  Database,
  Eye,
  FileClock,
  GitBranch,
  KeyRound,
  Layers,
  LifeBuoy,
  Lock,
  Mail,
  Server,
  ShieldCheck,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { Reveal } from "@/components/marketing/motion"
import { ScrollSpyNav } from "@/components/marketing/scroll-spy-nav"
import { Container } from "@/components/marketing/section"
import { pageMetadata } from "@/components/marketing/seo"
import { LAST_UPDATED, LAST_UPDATED_LABEL } from "@/components/marketing/site-data"
import { Button } from "@/components/ui/button"
import { SITE } from "@/lib/site"

export const metadata = pageMetadata({
  title: "Security",
  description:
    "How CustomerSignal AI protects your data: encryption, tenant isolation, role-based access, audit logs, MFA for administrators, secure AI processing and responsible disclosure.",
  path: "/security",
})

const HIGHLIGHTS: { icon: LucideIcon; title: string; body: string; tone: string }[] = [
  { icon: Lock, title: "Encryption", body: "TLS in transit; encryption at rest for databases, files and stored secrets.", tone: "#4169F5" },
  { icon: Layers, title: "Tenant isolation", body: "Every query is scoped to a workspace; cross-tenant access is blocked by design.", tone: "#2E7FD0" },
  { icon: Users, title: "Role-based access", body: "Owner, admin, analyst and viewer roles with least-privilege defaults.", tone: "#5E9E1F" },
  { icon: FileClock, title: "Audit logs", body: "Administrative and security-relevant actions are recorded with actor, time and context.", tone: "#FF8757" },
  { icon: KeyRound, title: "MFA for admins", body: "Platform administrator accounts are protected with TOTP multi-factor authentication.", tone: "#4169F5" },
]

/** How a review travels through the platform, and what protects it at each step. */
const FLOW: { icon: LucideIcon; step: string; guard: string; tone: string }[] = [
  { icon: Database, step: "Your sources", guard: "Uploads, Reviews API, official platform APIs", tone: "#2E7FD0" },
  { icon: Lock, step: "In transit", guard: "TLS, first-party origin, httpOnly secure cookies", tone: "#4169F5" },
  { icon: Layers, step: "Your workspace", guard: "Workspace-scoped queries, encrypted at rest", tone: "#5E9E1F" },
  { icon: Bot, step: "AI analysis", guard: "Only what you request; providers can’t train on it", tone: "#FF8757" },
  { icon: Users, step: "Your team", guard: "Role-based access, audit-logged actions", tone: "#101B35" },
]

type Section = { id: string; title: string; icon: LucideIcon; body: React.ReactNode }

const SECTIONS: Section[] = [
  {
    id: "infrastructure",
    title: "Infrastructure",
    icon: Server,
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
    icon: Lock,
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
    icon: Layers,
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
    icon: KeyRound,
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
    icon: FileClock,
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
    icon: Bot,
    body: (
      <>
        <p>
          Review text is sent to AI providers only to perform the analysis you request, over encrypted connections. Our
          agreements with AI providers prohibit training their models on your data. We minimize the data sent and avoid
          sending account credentials or billing details.
        </p>
        <p>
          We never scrape review platforms against their terms. Data enters through uploads, our Reviews API, official
          platform APIs and authorized providers.
        </p>
      </>
    ),
  },
  {
    id: "payments",
    title: "Payments",
    icon: CreditCard,
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
    icon: GitBranch,
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
    icon: LifeBuoy,
    body: (
      <p>
        Data is backed up regularly and restores are tested. We maintain an incident response process and will notify
        affected customers without undue delay, and within the time required by applicable law, if a personal data breach
        affects their data.
      </p>
    ),
  },
  {
    id: "hosting",
    title: "Sub-processors",
    icon: Server,
    body: (
      <p>
        We rely on vetted providers for hosting, AI processing, payments and email. See the{" "}
        <Link href="/privacy#sub-processors">sub-processor section of our Privacy Policy</Link>.
      </p>
    ),
  },
]

const reportHref = `mailto:${SITE.supportEmail}?subject=Security%20report`

export default function SecurityPage() {
  const toc = [{ id: "overview", title: "At a glance" }, ...SECTIONS.map((s) => ({ id: s.id, title: s.title })), { id: "disclosure", title: "Responsible disclosure" }]
  return (
    <article aria-labelledby="security-title">
      {/* ---------------------------------------------------------------- hero */}
      <header className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="bg-dots absolute inset-0 [mask-image:radial-gradient(ellipse_70%_70%_at_75%_40%,#000_30%,transparent_80%)]" />
          <div className="absolute -top-40 right-[-10%] size-[640px] rounded-full bg-[radial-gradient(closest-side,rgb(146_201_255/0.45),transparent)]" />
          <div className="absolute top-1/3 left-[-12%] size-[480px] rounded-full bg-[radial-gradient(closest-side,rgb(255_213_190/0.6),transparent)]" />
        </div>
        <Container className="relative grid items-center gap-14 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[#eef2ff] px-3 py-1 text-[13px] font-semibold text-[#2f52dd]">
              <ShieldCheck aria-hidden className="size-4" /> Trust &amp; security
            </p>
            <h1 id="security-title" className="mt-6 text-[2.8rem] leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-[4rem]">
              Your customers’ words, <span className="text-[#4169F5]">protected</span> at every step.
            </h1>
            <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-muted-foreground">
              Reviews are sensitive business data. Here is how CustomerSignal AI keeps them encrypted, isolated to your workspace
              and visible only to the people you choose.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="signal" className="h-12 rounded-full px-6 text-[15.5px]">
                <Link href="/contact?topic=enterprise">
                  Request a security review <ArrowRight data-arrow aria-hidden className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full px-6 text-[15.5px]">
                <a href={reportHref}>
                  <Mail aria-hidden className="size-4" /> Report a vulnerability
                </a>
              </Button>
            </div>
            <p className="mt-6 text-[14px] text-muted-foreground">
              Last updated <time dateTime={LAST_UPDATED}>{LAST_UPDATED_LABEL}</time>
            </p>
          </div>

          {/* data protection flow */}
          <Reveal>
            <div className="relative rounded-[28px] border border-border bg-white p-6 shadow-[0_40px_80px_-40px_rgb(23_32_51/0.35)] sm:p-8">
              <p className="text-[13px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">How a review is protected</p>
              <ol className="relative mt-6 space-y-3">
                <span aria-hidden className="absolute top-6 bottom-6 left-[23px] w-px bg-[linear-gradient(to_bottom,#2E7FD0,#4169F5,#5E9E1F,#FF8757,#101B35)] opacity-40" />
                {FLOW.map((f, i) => (
                  <li key={f.step} className="relative flex items-center gap-4">
                    <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: f.tone }}>
                      <f.icon aria-hidden className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1 rounded-2xl border border-border bg-[#F7F6F2] px-4 py-3">
                      <p className="flex items-baseline justify-between gap-3">
                        <span className="text-[15.5px] font-semibold">{f.step}</span>
                        <span className="font-mono text-[12px] text-subtle-foreground">{String(i + 1).padStart(2, "0")}</span>
                      </p>
                      <p className="mt-0.5 text-[14px] leading-snug text-muted-foreground">{f.guard}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </Container>
      </header>

      {/* ---------------------------------------------------------------- at a glance */}
      <section id="overview" aria-labelledby="overview-h" className="scroll-mt-28 bg-white py-20 sm:py-24">
        <Container>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <h2 id="overview-h" className="max-w-2xl text-[2.2rem] leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-[3rem]">
              Security at a glance.
            </h2>
            <p className="max-w-md text-[17px] leading-relaxed text-muted-foreground">The controls that matter most, built into the product rather than bolted on.</p>
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHTS.map((h, i) => (
              <Reveal key={h.title} delay={i * 0.04} className="h-full">
                <li className="flex h-full flex-col rounded-3xl border border-border bg-[#F7F6F2] p-6 transition-shadow hover:shadow-[0_18px_40px_-24px_rgb(23_32_51/0.35)]">
                  <span className="flex size-11 items-center justify-center rounded-2xl" style={{ background: `${h.tone}1a`, color: h.tone }}>
                    <h.icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.02em]">{h.title}</h3>
                  <p className="mt-2 text-[15.5px] leading-relaxed text-muted-foreground">{h.body}</p>
                </li>
              </Reveal>
            ))}
            <Reveal delay={0.2} className="h-full">
              <li className="dark relative flex h-full flex-col overflow-hidden rounded-3xl bg-background p-6 text-foreground">
                <span aria-hidden className="absolute -top-16 -right-16 size-48 rounded-full bg-[radial-gradient(closest-side,rgb(255_135_87/0.45),transparent)]" />
                <span className="relative flex size-11 items-center justify-center rounded-2xl bg-[#FF8757] text-[#2a1206]">
                  <Eye aria-hidden className="size-5" />
                </span>
                <h3 className="relative mt-5 text-[19px] font-semibold tracking-[-0.02em] text-white">No scraping, ever</h3>
                <p className="relative mt-2 text-[15.5px] leading-relaxed text-muted-foreground">
                  Data comes from your uploads, our Reviews API, official platform APIs and authorized providers only.
                </p>
              </li>
            </Reveal>
          </ul>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- details */}
      <section aria-label="Security details" className="py-20 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[17rem_1fr] lg:gap-14">
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <ScrollSpyNav items={toc} />
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            {SECTIONS.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                aria-labelledby={`${s.id}-h`}
                className="scroll-mt-28 rounded-3xl border border-border bg-white p-6 shadow-[var(--shadow-card)] sm:p-8"
              >
                <div className="flex items-center gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4169F5]">
                    <s.icon aria-hidden className="size-5" />
                  </span>
                  <div>
                    <p className="font-mono text-[12px] text-subtle-foreground tabular-nums">{String(i + 2).padStart(2, "0")}</p>
                    <h2 id={`${s.id}-h`} className="text-[1.45rem] leading-tight font-semibold tracking-[-0.03em]">
                      {s.title}
                    </h2>
                  </div>
                </div>
                <div className="mt-5 space-y-4 text-[16.5px] leading-relaxed text-foreground/80 [&_a]:font-semibold [&_a]:text-[#2f52dd] [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:relative [&_li]:pl-6 [&_li]:before:absolute [&_li]:before:top-[0.7em] [&_li]:before:left-1 [&_li]:before:size-2 [&_li]:before:rounded-full [&_li]:before:bg-[#4169F5] [&_ul]:space-y-3">
                  {s.body}
                </div>
              </section>
            ))}

            {/* responsible disclosure */}
            <section id="disclosure" aria-labelledby="disclosure-h" className="dark relative scroll-mt-28 overflow-hidden rounded-3xl bg-background p-7 text-foreground sm:p-10">
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="bg-dots absolute inset-0 opacity-60" />
                <div className="absolute -top-24 -right-16 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(65_105_245/0.5),transparent)]" />
              </div>
              <div className="relative">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-[#4169F5] text-white">
                  <ShieldCheck aria-hidden className="size-5" />
                </span>
                <h2 id="disclosure-h" className="mt-5 text-[1.8rem] leading-tight font-semibold tracking-[-0.035em] text-white">
                  Found a vulnerability? Tell us.
                </h2>
                <p className="mt-3 max-w-2xl text-[16.5px] leading-relaxed text-muted-foreground">
                  Email {SITE.supportEmail} with “Security report” in the subject. Please don’t access other customers’ data or
                  degrade the service while testing. We acknowledge reports promptly and keep you informed.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Button asChild variant="signal" className="h-12 rounded-full px-6 text-[15.5px]">
                    <a href={reportHref}>
                      <Mail aria-hidden className="size-4" /> Email a security report
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="h-12 rounded-full border-white/25 bg-transparent px-6 text-[15.5px] text-white hover:bg-white/10">
                    <Link href="/contact?topic=enterprise">Questionnaires &amp; DPA</Link>
                  </Button>
                </div>
              </div>
            </section>

            <p className="flex items-start gap-2.5 rounded-2xl border border-[#FF8757]/30 bg-[#FFF1E8] px-5 py-4 text-[14px] leading-relaxed text-[#7a3412]">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              This page is provided for transparency and must be reviewed by qualified legal counsel before it is relied on. It
              does not constitute legal advice.
            </p>
          </div>
        </Container>
      </section>
    </article>
  )
}
