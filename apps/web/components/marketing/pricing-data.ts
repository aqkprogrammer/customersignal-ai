export type PlanLimits = {
  max_workspaces: number | null
  max_projects: number | null
  max_reviews_per_month: number | null
  max_reports_per_month: number | null
  max_members: number | null
}

export type PublicPlan = {
  code: string
  name: string
  description: string | null
  price_monthly_cents: number | null
  currency: string
  marketing_features: string[]
  limits: Partial<PlanLimits>
  trial_days: number
  highlighted: boolean
}

/** Shown ONLY when GET /api/v1/public/plans fails. Mirrors the backend's default catalog. */
export const DEFAULT_PLANS: PublicPlan[] = [
  {
    code: "free",
    name: "Free",
    description: "Explore CustomerSignal AI with a small dataset.",
    price_monthly_cents: 0,
    currency: "usd",
    marketing_features: ["1 workspace", "2 projects", "100 reviews / month", "Basic sentiment analysis", "Limited AI reports"],
    limits: { max_workspaces: 1, max_projects: 2, max_reviews_per_month: 100, max_reports_per_month: 2, max_members: 1 },
    trial_days: 0,
    highlighted: false,
  },
  {
    code: "starter",
    name: "Starter",
    description: "For small businesses getting serious about customer feedback.",
    price_monthly_cents: 2900,
    currency: "usd",
    marketing_features: ["3 projects", "2,000 reviews / month", "Advanced analytics", "Competitor comparison", "10 AI reports / month"],
    limits: { max_workspaces: 1, max_projects: 3, max_reviews_per_month: 2000, max_reports_per_month: 10, max_members: 2 },
    trial_days: 14,
    highlighted: false,
  },
  {
    code: "pro",
    name: "Pro",
    description: "Full AI intelligence, monitoring and collaboration for growing teams.",
    price_monthly_cents: 9900,
    currency: "usd",
    marketing_features: [
      "10 projects",
      "15,000 reviews / month",
      "Advanced AI intelligence",
      "Unlimited report downloads (fair use)",
      "Monitoring & alerts",
      "Team collaboration",
    ],
    limits: { max_workspaces: 3, max_projects: 10, max_reviews_per_month: 15000, max_reports_per_month: 200, max_members: 5 },
    trial_days: 14,
    highlighted: true,
  },
  {
    code: "business",
    name: "Business",
    description: "Advanced competitor intelligence and priority processing at scale.",
    price_monthly_cents: 24900,
    currency: "usd",
    marketing_features: [
      "30 projects",
      "50,000 reviews / month",
      "Advanced competitor intelligence",
      "Priority processing",
      "10 team members",
      "Custom report branding",
    ],
    limits: { max_workspaces: 5, max_projects: 30, max_reviews_per_month: 50000, max_reports_per_month: 1000, max_members: 10 },
    trial_days: 14,
    highlighted: false,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    description: "Custom limits, dedicated support, API access and custom integrations.",
    price_monthly_cents: null,
    currency: "usd",
    marketing_features: ["Custom limits", "Dedicated support", "API access", "Advanced permissions", "Custom integrations"],
    limits: { max_workspaces: null, max_projects: null, max_reviews_per_month: null, max_reports_per_month: null, max_members: null },
    trial_days: 0,
    highlighted: false,
  },
]

export function planCta(plan: Pick<PublicPlan, "code" | "price_monthly_cents" | "trial_days">) {
  if (plan.code === "enterprise" || plan.price_monthly_cents === null) {
    return { href: "/contact?topic=enterprise", label: "Contact sales" }
  }
  if (plan.price_monthly_cents === 0) return { href: `/signup?plan=${plan.code}`, label: "Start free" }
  return {
    href: `/signup?plan=${plan.code}`,
    label: plan.trial_days > 0 ? `Start ${plan.trial_days}-day trial` : `Choose ${plan.code}`,
  }
}

type Cell = boolean | string

/** Feature comparison (static; mirrors plan entitlements). Column order: Free, Starter, Pro, Business, Enterprise. */
export const COMPARISON: { group: string; rows: { label: string; values: [Cell, Cell, Cell, Cell, Cell] }[] }[] = [
  {
    group: "Usage",
    rows: [
      { label: "Workspaces", values: ["1", "1", "3", "5", "Custom"] },
      { label: "Projects", values: ["2", "3", "10", "30", "Custom"] },
      { label: "Reviews analyzed / month", values: ["100", "2,000", "15,000", "50,000", "Custom"] },
      { label: "AI reports / month", values: ["Limited", "10", "Unlimited (fair use)", "Unlimited (fair use)", "Custom"] },
      { label: "Team members", values: ["1", "2", "5", "10", "Custom"] },
    ],
  },
  {
    group: "Intelligence",
    rows: [
      { label: "Sentiment & category analysis", values: [true, true, true, true, true] },
      { label: "Advanced analytics & trends", values: [false, true, true, true, true] },
      { label: "Competitor comparison", values: [false, true, true, true, true] },
      { label: "Opportunity Finder & 3-Star Gap Finder", values: [false, false, true, true, true] },
      { label: "Advanced competitor intelligence", values: [false, false, false, true, true] },
      { label: "Priority processing", values: [false, false, false, true, true] },
    ],
  },
  {
    group: "Workflow",
    rows: [
      { label: "PDF export & share links", values: [true, true, true, true, true] },
      { label: "Monitoring & alerts", values: [false, false, true, true, true] },
      { label: "Team collaboration", values: [false, false, true, true, true] },
      { label: "Custom report branding", values: [false, false, false, true, true] },
      { label: "API access & custom integrations", values: [false, false, false, false, true] },
      { label: "Advanced permissions", values: [false, false, false, false, true] },
      { label: "Dedicated support", values: [false, false, false, false, true] },
    ],
  },
]

export const PRICING_FAQ = [
  {
    q: "Which currency are prices in?",
    a: "Prices are listed in US dollars and billed monthly through Stripe, our payment processor. Any applicable taxes are calculated at checkout.",
  },
  {
    q: "What counts as a review analyzed?",
    a: "Each review processed by the AI analysis pipeline counts toward your monthly allowance. Duplicate reviews detected during import are skipped rather than analyzed again.",
  },
  {
    q: "What happens if I exceed my monthly limit?",
    a: "Nothing is deleted — your existing reviews, insights and reports stay available. New analysis pauses until your next billing cycle, or you can upgrade at any time to continue.",
  },
  {
    q: "What does “fair use” mean for unlimited report downloads?",
    a: "Normal business use — generating and downloading reports for your own teams and clients — is unlimited. We only reach out if automated or abusive volumes affect service quality for others.",
  },
  {
    q: "Can I change or cancel my plan?",
    a: "Yes, at any time from the Billing page in your workspace. Payments and plan changes are handled securely through Stripe.",
  },
  {
    q: "Do you offer annual billing or agency pricing?",
    a: "Annual billing and multi-client agency arrangements are available on Enterprise. Contact sales and we will tailor limits, branding and billing to how you work.",
  },
]
