import {
  Bell,
  CreditCard,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
  MessageSquareText,
  Plug,
  Radar,
  Settings,
  Swords,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  keywords?: string
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Analyze",
    items: [
      { href: "/app", label: "Overview", icon: LayoutDashboard, keywords: "dashboard home" },
      { href: "/app/projects", label: "Projects", icon: FolderKanban },
      { href: "/app/reviews", label: "Review Intelligence", icon: MessageSquareText, keywords: "reviews sentiment upload csv" },
      { href: "/app/competitors", label: "Competitor Analysis", icon: Swords },
    ],
  },
  {
    title: "Grow",
    items: [
      { href: "/app/opportunities", label: "Product Opportunities", icon: Lightbulb },
      { href: "/app/opportunity-finder", label: "1-Star Cold Pitch", icon: Target, keywords: "leads outreach opportunity finder" },
      { href: "/app/gap-finder", label: "3-Star Gap Finder", icon: Radar, keywords: "amazon product gap" },
      { href: "/app/reports", label: "AI Reports", icon: FileText, keywords: "pdf export" },
      { href: "/app/monitoring", label: "Monitoring", icon: Bell, keywords: "alerts rules" },
    ],
  },
  {
    title: "Workspace",
    items: [
      { href: "/app/integrations", label: "Integrations", icon: Plug },
      { href: "/app/team", label: "Team", icon: Users },
      { href: "/app/billing", label: "Billing", icon: CreditCard, keywords: "plan subscription upgrade" },
      { href: "/app/settings", label: "Settings", icon: Settings, keywords: "profile account" },
      { href: "/app/support", label: "Help & Support", icon: LifeBuoy },
    ],
  },
]

export const ALL_NAV = NAV_SECTIONS.flatMap((s) => s.items)

export function navLabel(pathname: string) {
  const exact = ALL_NAV.find((i) => i.href === pathname)
  if (exact) return exact.label
  const match = [...ALL_NAV].sort((a, b) => b.href.length - a.href.length).find((i) => i.href !== "/app" && pathname.startsWith(i.href))
  return match?.label
}
