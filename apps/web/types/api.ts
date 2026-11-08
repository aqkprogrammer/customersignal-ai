// Shapes returned by the FastAPI backend (see apps/api/app/api/v1/serializers.py).

export type Role = "owner" | "admin" | "analyst" | "viewer"
export type Sentiment = "positive" | "neutral" | "negative"

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface User {
  id: string
  email: string
  email_verified: boolean
  has_password: boolean
  google_linked: boolean
  full_name: string
  avatar_url: string | null
  company_name: string | null
  job_title: string | null
  timezone: string
  onboarding_step: number
  onboarding_completed: boolean
  onboarding_data: Record<string, unknown>
  notification_preferences: Record<string, { in_app: boolean; email: boolean }>
  default_workspace_id: string | null
  created_at: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  role: Role | null
  is_demo: boolean
  business_type: string | null
  industry: string | null
  country: string | null
  city: string | null
  website: string | null
  company_size: string | null
  goals: string[]
  preferred_sources: string[]
  branding: { logo_url?: string | null; primary_color?: string | null }
  status: string
  data_retention_days: number | null
  created_at: string
  entitlements?: Entitlements
}

export interface Entitlements {
  plan_code: string
  plan_name: string
  status: string
  features: string[]
  limits: Record<string, number | null>
}

export interface Session {
  user: User
  workspaces: Workspace[]
}

export interface ProjectStats {
  total: number
  analyzed?: number
  avg_rating?: number | null
  positive_pct?: number
  neutral_pct?: number
  negative_pct?: number
}

export interface Project {
  id: string
  workspace_id: string
  name: string
  description: string | null
  industry: string | null
  country: string | null
  city: string | null
  website: string | null
  business_name: string | null
  data_source: string
  kind: "standard" | "opportunity_finder" | "gap_finder"
  status: "active" | "analyzing" | "archived"
  is_demo: boolean
  archived_at: string | null
  last_analyzed_at: string | null
  created_at: string
  updated_at: string
  stats: ProjectStats | null
  businesses?: BusinessRef[]
}

export interface BusinessRef {
  id: string
  name: string
  is_primary: boolean
  entity_type?: string
}

export interface Review {
  id: string
  project_id: string
  business_id: string | null
  business_name?: string | null
  platform: string | null
  product_name: string | null
  reviewer_name: string | null
  rating: number | null
  title: string | null
  text: string
  review_date: string | null
  location: string | null
  verified: boolean | null
  language: string | null
  translated_text: string | null
  analysis_status: string
  is_demo: boolean
  created_at: string
  sentiment: Sentiment | null
  sentiment_score: number | null
  emotion: string | null
  categories: string[]
  similarity?: number
  analysis?: {
    explanation: string | null
    confidence: number | null
    provider: string | null
    model: string | null
    prompt_version: string | null
  } | null
  signals?: { kind: string; category: string; label: string; excerpt: string | null; severity: number; cluster_id: string | null }[]
  source?: { name: string; source_type: string } | null
}

export interface Cluster {
  id: string
  project_id: string
  business_id: string | null
  kind: "complaint" | "praise" | "feature_request"
  category: string
  label: string
  summary: string | null
  review_count: number
  avg_rating: number | null
  severity_score: number
  trend: "rising" | "stable" | "declining" | "new"
  recent_count: number
  previous_count: number
  first_seen: string | null
  last_seen: string | null
  is_demo: boolean
}

export interface Evidence {
  review_id: string
  excerpt: string
  rating: number | null
  date: string | null
  platform: string | null
  reviewer?: string | null
  is_demo?: boolean
  translated?: string | null
  ref?: string
  competitor?: boolean
}

export interface Job {
  id: string
  job_type: string
  status: "pending" | "processing" | "completed" | "failed" | "cancelled"
  progress: number
  stage: string | null
  project_id: string | null
  total_items: number
  processed_items: number
  result_summary: Record<string, unknown>
  error: string | null
  attempts: number
  max_attempts: number
  params: Record<string, unknown>
  dead_lettered: boolean
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface Kpis {
  total_reviews: number
  analyzed_reviews: number
  positive_pct: number
  neutral_pct: number
  negative_pct: number
  positive: number
  neutral: number
  negative: number
  avg_sentiment: number | null
  avg_rating: number | null
}

export interface TimePoint {
  period: string
  total: number
  positive: number
  neutral: number
  negative: number
  unanalyzed: number
  avg_rating: number | null
  unit: string
}

export interface CompetitorRow {
  business_id: string
  name: string
  is_primary: boolean
  review_count: number
  avg_rating: number | null
  positive_pct: number
  negative_pct: number
  neutral_pct: number
  avg_sentiment: number | null
  complaint_categories: Record<string, number>
  praise_categories: Record<string, number>
  top_complaints: string[]
  top_praise: string[]
}

export interface Opportunity {
  id: string
  project_id: string
  title: string
  description: string
  recommendation: string | null
  opportunity_type: string
  score: number
  impact: "low" | "medium" | "high"
  effort: "low" | "medium" | "high"
  status: string
  source: string
  provider: string | null
  cluster_id: string | null
  evidence_count: number
  is_demo: boolean
  created_at: string
  evidence?: Evidence[]
}

export interface UsageSummary {
  plan: Entitlements
  reviews_analyzed: { used: number; limit: number | null }
  reports_generated: { used: number; limit: number | null }
  projects: { used: number; limit: number | null }
  ai_tokens: { used: number; limit: number | null }
}

export interface Dashboard {
  kpis: Kpis
  sentiment_over_time: TimePoint[]
  rating_distribution: { rating: number; count: number }[]
  complaint_categories: { category: string; count: number }[]
  top_keywords: { keyword: string; count: number; negative_share: number }[]
  top_complaints: Cluster[]
  trending_issues: Cluster[]
  competitor_comparison: CompetitorRow[]
  opportunities: Pick<Opportunity, "id" | "title" | "description" | "score" | "impact" | "opportunity_type" | "is_demo" | "created_at">[]
  recent_reports: { id: string; title: string; report_type: string; status: string; created_at: string; is_demo: boolean }[]
  activity: { id: string; job_type: string; status: string; progress: number; stage: string | null; created_at: string; completed_at: string | null }[]
  usage: UsageSummary
  ai_provider: { name: string; label: string; is_llm: boolean }
}

export interface Report {
  id: string
  project_id: string | null
  report_type: string
  title: string
  status: "pending" | "generating" | "ready" | "failed"
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
  content?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  shares?: { id: string; token_prefix: string; expires_at: string | null; revoked: boolean; view_count: number; created_at: string }[]
  job_id?: string | null
}

export interface LeadIssue {
  key: string
  cluster_id: string
  label: string
  title: string
  category: string
  count: number
  avg_rating: number | null
  severity: number
  trend: string
  why_it_matters: string
  evidence: Evidence[]
}

export interface Lead {
  id: string
  project_id: string | null
  business_name: string
  website: string | null
  country: string | null
  city: string | null
  industry: string | null
  status: "new" | "researched" | "contacted" | "replied" | "meeting_booked" | "converted" | "not_interested"
  pitch_status: "none" | "generating" | "ready" | "failed"
  contact_name: string | null
  contact_email: string | null
  contact_linkedin: string | null
  competitor_names: string[]
  issue_count: number
  top_issue: string | null
  last_contacted_at: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
  report_id: string | null
  executive_summary?: string | null
  cold_email_subject?: string | null
  cold_email?: string | null
  linkedin_message?: string | null
  follow_up_email?: string | null
  issues?: LeadIssue[]
  opportunities?: { title: string; description: string; kind?: string }[]
  notes?: string | null
  review_count?: number
  businesses?: BusinessRef[]
  activities?: { id: string; type: string; message: string; from_status: string | null; to_status: string | null; actor: string | null; created_at: string }[]
}

export interface Plan {
  code: string
  name: string
  description: string
  price_monthly_cents: number | null
  currency: string
  features: string[]
  marketing_features: string[]
  limits: Record<string, number | null>
  trial_days: number
  highlighted: boolean
}

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  workspace_id: string | null
  created_at: string
}
