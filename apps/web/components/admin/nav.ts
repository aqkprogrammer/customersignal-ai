import {
  Activity,
  Bell,
  BotMessageSquare,
  CreditCard,
  FileBarChart,
  Flag,
  FolderKanban,
  Gauge,
  LifeBuoy,
  Mail,
  Megaphone,
  Package,
  PieChart,
  Plug,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react"

export type NavItem = { label: string; href: string; icon: LucideIcon; permission: string }
export type NavSection = { title: string; items: NavItem[] }

export const ADMIN_NAV: NavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Overview", href: "/admin/dashboard", icon: Gauge, permission: "dashboard.read" }],
  },
  {
    title: "Customers",
    items: [
      { label: "Users", href: "/admin/users", icon: Users, permission: "users.read" },
      { label: "Workspaces", href: "/admin/workspaces", icon: Package, permission: "workspaces.read" },
    ],
  },
  {
    title: "Billing",
    items: [
      { label: "Subscriptions", href: "/admin/subscriptions", icon: Receipt, permission: "subscriptions.read" },
      { label: "Payments", href: "/admin/payments", icon: CreditCard, permission: "payments.read" },
      { label: "Plans & Pricing", href: "/admin/plans", icon: PieChart, permission: "plans.read" },
      { label: "Revenue", href: "/admin/revenue", icon: TrendingUp, permission: "revenue.read" },
    ],
  },
  {
    title: "Product",
    items: [
      { label: "AI Usage", href: "/admin/ai-usage", icon: BotMessageSquare, permission: "ai_usage.read" },
      { label: "Review Analytics", href: "/admin/review-analytics", icon: Star, permission: "analytics.read" },
      { label: "Projects", href: "/admin/projects", icon: FolderKanban, permission: "projects.read" },
      { label: "Reports", href: "/admin/reports", icon: FileBarChart, permission: "reports.read" },
      { label: "Integrations", href: "/admin/integrations", icon: Plug, permission: "integrations.read" },
      { label: "Background Jobs", href: "/admin/jobs", icon: Workflow, permission: "jobs.read" },
    ],
  },
  {
    title: "Engagement",
    items: [
      { label: "Support Tickets", href: "/admin/support", icon: LifeBuoy, permission: "support.read" },
      { label: "Announcements", href: "/admin/announcements", icon: Megaphone, permission: "dashboard.read" },
      { label: "Email Templates", href: "/admin/email-templates", icon: Mail, permission: "email_templates.read" },
      { label: "Notifications", href: "/admin/notifications", icon: Bell, permission: "notifications.manage" },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText, permission: "audit.read" },
      { label: "Feature Flags", href: "/admin/feature-flags", icon: Flag, permission: "flags.read" },
      { label: "System Settings", href: "/admin/settings", icon: Settings, permission: "settings.read" },
      { label: "Admins", href: "/admin/admins", icon: ShieldCheck, permission: "admins.manage" },
    ],
  },
]

export const SECURITY_ITEM: NavItem = { label: "My security", href: "/admin/admins#security", icon: Activity, permission: "" }
