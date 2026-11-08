export const SITE = {
  name: "CustomerSignal AI",
  tagline: "Turn Customer Feedback Into Your Next Business Opportunity.",
  description:
    "AI-powered customer intelligence: analyze reviews, uncover recurring complaints, monitor competitors and turn feedback into actionable opportunities.",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  supportEmail: "support@customersignal.ai",
  salesEmail: "sales@customersignal.ai",
}

export const INDUSTRIES = [
  "Restaurants",
  "Beauty & wellness",
  "Healthcare",
  "Ecommerce",
  "Hotels & hospitality",
  "Marketing agency",
  "Retail",
  "Automotive",
  "Real estate",
  "Education",
  "Other",
]

export const COUNTRIES = [
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "United Kingdom",
  "United States",
  "India",
  "Pakistan",
  "Egypt",
  "Germany",
  "Other",
]

export const CATEGORY_LABELS: Record<string, string> = {
  pricing: "Pricing",
  customer_service: "Customer service",
  waiting_time: "Waiting time",
  product_quality: "Product quality",
  delivery: "Delivery",
  appointment_management: "Appointments",
  staff_behavior: "Staff behavior",
  usability: "Usability",
  communication: "Communication",
  reliability: "Reliability",
  cleanliness: "Cleanliness",
  other: "Other",
}

export const REPORT_TYPES: { value: string; label: string; description: string; needsProject?: boolean }[] = [
  { value: "customer_sentiment", label: "Customer sentiment", description: "Sentiment, ratings and emotion over time." },
  { value: "business_reputation", label: "Business reputation", description: "How customers see the business, with evidence." },
  { value: "competitor_intelligence", label: "Competitor intelligence", description: "Side-by-side comparison with competitors.", needsProject: true },
  { value: "product_opportunity", label: "Product opportunity", description: "Prioritized opportunities from feedback." },
  { value: "customer_complaint", label: "Customer complaint", description: "Recurring complaints, severity and trends." },
  { value: "market_research", label: "Market research", description: "Themes and gaps across the market." },
  { value: "executive_summary", label: "Executive summary", description: "A crisp one-glance summary for leadership." },
  { value: "outreach_intelligence", label: "Outreach intelligence", description: "Evidence-backed pitch for a prospect.", needsProject: true },
  { value: "gap_finder", label: "Product gap analysis", description: "3-star gap findings and roadmap.", needsProject: true },
]

export function categoryLabel(slug: string) {
  return CATEGORY_LABELS[slug] || slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
