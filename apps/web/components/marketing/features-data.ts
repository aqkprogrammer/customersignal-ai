import {
  BellRing,
  FileText,
  MessageSquareText,
  Plug,
  Radar,
  Star,
  Target,
  type LucideIcon,
} from "lucide-react"

export type Feature = {
  id: string
  name: string
  tagline: string
  description: string
  icon: LucideIcon
  points: string[]
}

export const FEATURES: Feature[] = [
  {
    id: "review-intelligence",
    name: "Review Intelligence",
    tagline: "Every review, understood.",
    description:
      "Sentiment, emotion, category and severity for every review — in English and Arabic — with recurring complaints clustered into themes you can act on.",
    icon: MessageSquareText,
    points: [
      "Sentiment and emotion per review, with confidence",
      "Automatic categories: waiting time, pricing, staff, quality and more",
      "Complaint clusters with share-of-voice and trend",
      "Arabic detection and translation for GCC audiences",
    ],
  },
  {
    id: "opportunity-finder",
    name: "1-Star Review Cold Pitch",
    tagline: "Opportunity Finder for agencies and consultants.",
    description:
      "Find businesses whose public 1-star reviews reveal a fixable problem, then pitch the business — never the reviewer — with an evidence-backed audit.",
    icon: Target,
    points: [
      "Surface recurring, fixable complaint patterns",
      "Generate a respectful, evidence-based outreach brief",
      "Lead pipeline with statuses and HubSpot sync",
      "Built-in guardrails: no contacting reviewers, no shaming",
    ],
  },
  {
    id: "gap-finder",
    name: "3-Star Gap Finder",
    tagline: "What stops good from becoming great.",
    description:
      "Three-star reviews are the most honest feedback you get. We isolate what mixed reviewers liked, what let them down, and the smallest change that would earn the fifth star.",
    icon: Star,
    points: [
      "Liked vs. missing analysis on mixed reviews",
      "Prioritized gaps by frequency and impact",
      "Roadmap-ready product and service recommendations",
      "Quotes attached as evidence for every gap",
    ],
  },
  {
    id: "competitor-intelligence",
    name: "Competitor Intelligence",
    tagline: "See where rivals win — theme by theme.",
    description:
      "Compare your reputation with competitors on the same themes, spot where they are gaining, and find the positioning gaps nobody in your area owns yet.",
    icon: Radar,
    points: [
      "Side-by-side theme scores and ratings",
      "Strengths and weaknesses per competitor",
      "Market gaps and differentiation opportunities",
      "Built for local markets like Dubai, Abu Dhabi and Riyadh",
    ],
  },
  {
    id: "ai-reports",
    name: "AI Reports with PDF",
    tagline: "Board-ready in minutes.",
    description:
      "Executive summaries, complaint analysis, competitor intelligence and product opportunity reports — grounded in quotes, exportable as branded PDFs and shareable by secure link.",
    icon: FileText,
    points: [
      "Nine report types from executive to gap analysis",
      "PDF export with custom branding on Business",
      "Expiring, revocable share links",
      "Every claim backed by review evidence",
    ],
  },
  {
    id: "monitoring",
    name: "Monitoring & Alerts",
    tagline: "Catch problems while they are small.",
    description:
      "Set rules on ratings, sentiment or specific complaint themes. When something starts rising, your team hears about it first — not your customers.",
    icon: BellRing,
    points: [
      "Threshold and trend-based rules",
      "Email notifications to the right teammates",
      "Signed webhooks for your own systems",
      "Alert history with the reviews that triggered it",
    ],
  },
  {
    id: "integrations",
    name: "Integrations",
    tagline: "Official access methods only.",
    description:
      "Start with CSV or Excel exports today, push data through the Reviews API, and sync leads to your CRM. Platform integrations use official APIs that require approval.",
    icon: Plug,
    points: [
      "CSV and Excel upload with auto column mapping",
      "Reviews API and signed webhooks",
      "HubSpot CRM sync for Opportunity Finder leads",
      "Google Business Profile, Trustpilot and Amazon SP-API via official, approved access",
    ],
  },
]
