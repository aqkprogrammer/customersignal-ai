import {
  Building2,
  HeartPulse,
  Hotel,
  Megaphone,
  Scissors,
  ShoppingBag,
  Store,
  Utensils,
  type LucideIcon,
} from "lucide-react"

export type SolutionSummary = {
  slug: "restaurants" | "beauty-wellness" | "healthcare" | "ecommerce" | "agencies"
  name: string
  short: string
  icon: LucideIcon
}

export const SOLUTIONS: SolutionSummary[] = [
  {
    slug: "restaurants",
    name: "Restaurants & cafés",
    short: "Fix wait times, service gaps and menu misses across every branch.",
    icon: Utensils,
  },
  {
    slug: "beauty-wellness",
    name: "Beauty & wellness",
    short: "Spot booking friction and stylist-level patterns before clients churn.",
    icon: Scissors,
  },
  {
    slug: "healthcare",
    name: "Clinics & healthcare",
    short: "Understand patient experience without touching clinical records.",
    icon: HeartPulse,
  },
  {
    slug: "ecommerce",
    name: "Ecommerce brands",
    short: "Turn product reviews into roadmap, sizing and delivery fixes.",
    icon: ShoppingBag,
  },
  {
    slug: "agencies",
    name: "Marketing agencies",
    short: "Win clients with evidence-backed audits and white-label reports.",
    icon: Megaphone,
  },
]

/** Industries shown in the "Built for" strip. Text + icons only — never customer logos. */
export const BUILT_FOR: { label: string; icon: LucideIcon }[] = [
  { label: "Restaurants", icon: Utensils },
  { label: "Beauty & wellness", icon: Scissors },
  { label: "Clinics", icon: HeartPulse },
  { label: "Ecommerce", icon: ShoppingBag },
  { label: "Hotels & hospitality", icon: Hotel },
  { label: "Retail", icon: Store },
  { label: "Real estate", icon: Building2 },
  { label: "Agencies", icon: Megaphone },
]

export const PRIMARY_NAV = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
] as const

export const FOOTER_COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/security", label: "Security" },
      { href: "/contact?topic=demo", label: "Book a demo" },
      { href: "/signup", label: "Start free" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { href: "/solutions", label: "All solutions" },
      ...SOLUTIONS.map((s) => ({ href: `/solutions/${s.slug}`, label: s.name })),
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/contact", label: "Contact" },
      { href: "/contact?topic=partnership", label: "Partnerships" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/security", label: "Security" },
    ],
  },
]

/** Static date for legal pages and sitemap (avoid `new Date()` during prerender). */
export const LAST_UPDATED = "2026-11-08"
export const LAST_UPDATED_LABEL = "8 November 2026"
export const COPYRIGHT_YEAR = 2026
