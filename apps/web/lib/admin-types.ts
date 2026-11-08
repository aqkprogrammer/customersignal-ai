/** Response shapes for /api/v1/admin/* — mirrors apps/api/app/api/v1/admin/{auth,routes}.py. */

export type Paged<T> = { items: T[]; total: number; page: number; page_size: number }

export type AdminRole = "super_admin" | "support_admin" | "billing_admin" | "read_only"
export const ADMIN_ROLES: AdminRole[] = ["super_admin", "support_admin", "billing_admin", "read_only"]

export type AdminMe = {
  id: string
  email: string
  full_name: string
  role: AdminRole
  mfa_enabled: boolean
  is_active: boolean
  last_login_at: string | null
  permissions: string[]
}

export type LoginResponse = { status: "mfa_required" } | { status: "authenticated"; admin: AdminMe }

// ---------------------------------------------------------------------------------------------- dashboard
export type DashboardMetrics = {
  total_users: number
  active_users: number
  new_registrations: number
  total_workspaces: number
  active_subscriptions: number
  mrr_cents: number
  arr_cents: number
  churn_rate: number
  trial_conversion_rate: number
  ai_tokens_30d: number
  ai_cost_30d: number
  reviews_processed: number
  failed_jobs_7d: number
}

export type DashboardData = {
  metrics: DashboardMetrics
  charts: {
    user_growth: { month: string; signups: number; total: number }[]
    revenue: { month: string; revenue_cents: number }[]
    subscription_status: { status: string; count: number }[]
    plan_distribution: { plan: string; count: number }[]
    ai_usage: { date: string; tokens: number; cost_usd: number; requests: number }[]
    review_volume: { date: string; reviews: number }[]
    churn: { month: string; cancellations: number }[]
    signup_conversion: { month: string; signups: number; onboarded: number }[]
  }
  recent_admin_activity: { action: string; admin_email: string | null; target_type: string | null; target_id: string | null; created_at: string }[]
  recent_signups: { id: string; email: string; full_name: string | null; created_at: string }[]
}

// -------------------------------------------------------------------------------------------------- users
export type AdminUserRow = {
  id: string
  email: string
  full_name: string
  company_name: string | null
  status: string
  email_verified: boolean
  google: boolean
  plan: string
  last_active_at: string | null
  last_login_at: string | null
  created_at: string
}

export type WorkspaceBase = {
  id: string
  name: string
  slug: string
  role: string | null
  is_demo: boolean
  business_type: string | null
  industry: string | null
  country: string | null
  city: string | null
  website: string | null
  company_size: string | null
  status: string
  data_retention_days: number | null
  created_at: string
}

export type AdminUserDetail = {
  id: string
  email: string
  status: string
  status_reason: string | null
  full_name: string
  company_name: string | null
  email_verified: boolean
  google_linked: boolean
  onboarding_completed: boolean
  created_at: string
  last_login_at: string | null
  last_active_at: string | null
  deleted_at: string | null
  workspaces: (WorkspaceBase & { plan: string; reviews_this_month: number })[]
  usage: { ai_tokens: number; ai_cost_usd: number }
  activity: { action: string; summary: string | null; created_at: string }[]
  sessions: { ip_address: string | null; user_agent: string | null; created_at: string; revoked: boolean }[]
}

// ------------------------------------------------------------------------------------------- workspaces
export type AdminWorkspaceRow = WorkspaceBase & {
  owner_email: string
  plan: string
  subscription_status: string | null
  projects: number
  members: number
  reviews: number
}

export type Limits = {
  max_workspaces: number | null
  max_projects: number | null
  max_reviews_per_month: number | null
  max_reports_per_month: number | null
  max_members: number | null
}
export const LIMIT_FIELDS: (keyof Limits)[] = [
  "max_workspaces",
  "max_projects",
  "max_reviews_per_month",
  "max_reports_per_month",
  "max_members",
]

export type ProjectOut = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  industry: string | null
  country: string | null
  city: string | null
  website: string | null
  business_name: string | null
  data_source: string | null
  kind: string | null
  status: string
  is_demo: boolean
  archived_at: string | null
  last_analyzed_at: string | null
  created_at: string
  updated_at: string | null
  stats: { total?: number } | null
}

export type AdminWorkspaceDetail = WorkspaceBase & {
  owner: { id: string; email: string } | null
  entitlements: { plan_code: string; plan_name: string; status: string; features: string[]; limits: Limits }
  subscription: {
    status: string
    stripe_customer_id: string | null
    current_period_end: string | null
    limit_overrides: Partial<Limits> | null
    cancel_at_period_end: boolean
    trial_ends_at: string | null
  } | null
  usage: { reviews_analyzed: number; reports_generated: number; ai_tokens: number }
  projects: ProjectOut[]
  members: { email: string; role: string }[]
}

// ---------------------------------------------------------------------------------------------- billing
export type AdminSubscriptionRow = {
  id: string
  workspace_id: string
  workspace_name: string
  plan: string
  plan_name: string
  status: string
  mrr_cents: number
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  trial_ends_at: string | null
  stripe_subscription_id: string | null
  limit_overrides: Partial<Limits> | null
  manual: boolean
}

export type AdminPayment = {
  id: string
  workspace_name: string
  amount_cents: number
  refunded_cents: number
  currency: string
  status: string
  failure_reason: string | null
  plan_code: string | null
  created_at: string
}

export type AdminInvoice = {
  id: string
  workspace_name: string
  number: string | null
  amount_paid_cents: number
  amount_due_cents: number
  status: string
  plan_code: string | null
  hosted_invoice_url: string | null
  created_at: string
}

export type RevenueData = {
  mrr_cents: number
  arr_cents: number
  gross_revenue_cents: number
  refunds_cents: number
  net_revenue_cents: number
  failed_payments: number
  failed_amount_cents: number
  revenue_by_plan: { plan: string | null; revenue_cents: number }[]
  mrr_by_plan: { plan: string; subscribers: number; mrr_cents: number }[]
  trend: { month: string; gross_cents: number; refunds_cents: number; net_cents: number }[]
  stripe_enabled: boolean
}

export type AdminPlan = {
  id: string
  code: string
  name: string
  description: string | null
  price_monthly_cents: number | null
  currency: string
  features: string[]
  marketing_features: string[]
  limits: Limits
  trial_days: number
  highlighted: boolean
  stripe_price_id_monthly: string | null
  is_active: boolean
  is_public: boolean
  subscribers: number
}
export type PlansResponse = { plans: AdminPlan[]; features: Record<string, string> }

// --------------------------------------------------------------------------------------------- AI usage
export type AIUsageRow = {
  id: string
  provider: string
  model: string
  operation: string | null
  workspace: string | null
  user: string | null
  input_tokens: number
  output_tokens: number
  cost_usd: number
  duration_ms: number | null
  status: string
  error: string | null
  prompt_version: string | null
  created_at: string
}

export type AISettings = {
  ai_provider: "auto" | "anthropic" | "openai" | "heuristic"
  ai_model_anthropic: string
  ai_model_openai: string
  ai_monthly_token_limit_per_workspace: number
}

export type AIUsageResponse = Paged<AIUsageRow> & {
  aggregates_30d: {
    provider: string
    model: string
    requests: number
    input_tokens: number
    output_tokens: number
    cost_usd: number
    errors: number
    avg_duration_ms: number
  }[]
  top_workspaces_30d: { workspace: string; tokens: number; cost_usd: number }[]
  providers: {
    anthropic: { configured: boolean; model: string }
    openai: { configured: boolean; model: string; embedding_model?: string }
    default: string
  }
  settings: AISettings
  pricing: Record<string, { input_per_mtok: number; output_per_mtok: number }>
}

// ------------------------------------------------------------------------------------------- analytics
export type ReviewAnalytics = {
  total_reviews: number
  demo_reviews: number
  sentiment: Record<string, number>
  by_provider: Record<string, number>
  ingested_30d: { date: string; reviews: number }[]
  by_platform: { platform: string; count: number }[]
  by_language: { language: string; count: number }[]
}

export type AdminProjectRow = ProjectOut & { workspace_name: string }

export type AdminReportRow = {
  id: string
  project_id: string | null
  report_type: string
  title: string
  status: string
  date_from: string | null
  date_to: string | null
  file_size: number | null
  provider: string | null
  error: string | null
  generated_at: string | null
  download_count: number
  is_demo: boolean
  created_at: string
  has_pdf: boolean
  workspace_name: string
}

// --------------------------------------------------------------------------------------- integrations
export type IntegrationLog = {
  provider: string
  workspace: string
  action: string
  status: string
  message: string | null
  created_at: string
}

export type IntegrationsResponse = {
  providers: {
    provider: string
    name: string
    category: string
    availability: string
    enabled: boolean
    connected: number
    errored: number
  }[]
  credentials: Record<string, boolean>
  errors: IntegrationLog[]
  activity: IntegrationLog[]
}

// ---------------------------------------------------------------------------------------------- jobs
export type AdminJob = {
  id: string
  job_type: string
  status: string
  progress: number | null
  stage: string | null
  project_id: string | null
  total_items: number | null
  processed_items: number | null
  result_summary: unknown
  error: string | null
  attempts: number
  max_attempts: number
  params: unknown
  dead_lettered: boolean
  created_at: string
  started_at: string | null
  completed_at: string | null
  workspace_name: string | null
}
export type JobsResponse = Paged<AdminJob> & { counts_7d: Record<string, number> }

// ------------------------------------------------------------------------------------------- support
export type TicketRow = {
  id: string
  subject: string
  email: string
  status: string
  priority: string
  category: string
  source: string
  assigned_to: string | null
  created_at: string
  updated_at: string | null
}
export type TicketsResponse = Paged<TicketRow> & {
  avg_resolution_hours: number | null
  avg_first_response_hours: number | null
  counts: Record<string, number>
}
export type TicketDetail = {
  id: string
  subject: string
  email: string
  status: string
  priority: string
  category: string
  source: string
  workspace_id: string | null
  user_id: string | null
  assigned_admin_id: string | null
  created_at: string
  first_response_at: string | null
  resolved_at: string | null
  messages: { id: string; author_type: string; admin_email: string | null; body: string; internal: boolean; created_at: string }[]
  admins: { id: string; email: string }[]
}
export const TICKET_STATUSES = ["open", "in_progress", "waiting_on_customer", "resolved", "closed"] as const
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const

// ------------------------------------------------------------------------------------- communications
export type Announcement = {
  id: string
  title: string
  body: string
  level: "info" | "success" | "warning" | "critical"
  audience: "all" | "free" | "paid"
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  send_email: boolean
  created_at: string
}

export type EmailLogRow = {
  id: string
  to: string
  template: string | null
  subject: string
  status: string
  error: string | null
  created_at: string
}

export type EmailTemplate = {
  id: string
  key: string
  name: string
  subject: string
  html_body: string
  text_body: string
  variables: string[]
  updated_at: string | null
}

// ------------------------------------------------------------------------------------------ governance
export type AuditLogRow = {
  id: string
  admin_id: string | null
  admin_email: string | null
  action: string
  target_type: string | null
  target_id: string | null
  ip_address: string | null
  user_agent: string | null
  metadata: unknown
  created_at: string
}

export type FeatureFlag = {
  id: string
  key: string
  description: string
  enabled: boolean
  plan_codes: string[]
  workspace_ids: string[]
  updated_at: string | null
}

export type PlatformSettings = {
  platform_name: string
  branding: { logo_url: string | null; primary_color: string }
  default_currency: string
  supported_countries: string[]
  default_timezone: string
  registration_enabled: boolean
  email_verification_required: boolean
  support_email: string
  ai_provider: string
  ai_model_anthropic: string
  ai_model_openai: string
  ai_monthly_token_limit_per_workspace: number
  maintenance_mode: boolean
  maintenance_message: string
  max_upload_mb: number
  max_rows_per_upload: number
  trial_days: number
  disabled_integrations: string[]
}
export type SettingsResponse = {
  settings: PlatformSettings
  environment: { environment: string; storage: string; email: string; jobs: string }
}

export type AdminsResponse = { admins: AdminMe[]; roles: Record<string, string[]> }
