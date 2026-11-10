/**
 * Illustrative sample dataset for the marketing visualizations. Every surface that renders it labels it
 * "sample data" — none of these numbers describe a real business.
 */

export type Tone = "cobalt" | "orange" | "lime" | "sky"

export const TONE_HEX: Record<Tone, string> = {
  cobalt: "#4169F5",
  orange: "#FF8757",
  lime: "#9BD24A",
  sky: "#6FB4F5",
}
/** Readable text colour for each tone on light surfaces. */
export const TONE_TEXT: Record<Tone, string> = {
  cobalt: "text-[#2f52dd]",
  orange: "text-[#d9561f]",
  lime: "text-[#4f8a12]",
  sky: "text-[#2e7fd0]",
}

export type SourceNode = { id: string; label: string; detail: string; x: number; y: number }
export type ClusterNode = {
  id: string
  name: string
  share: number
  reviews: number
  trend: "Rising" | "Stable" | "New" | "Easing"
  tone: Tone
  /** positive / neutral / negative mix inside the cluster */
  mix: [number, number, number]
  x: number
  y: number
  r: number
  quote: string
  sources: string[]
}
export type OpportunityNode = { id: string; title: string; kind: string; score: number; from: string; x: number; y: number; tone: Tone }

export const SOURCES: SourceNode[] = [
  { id: "google", label: "Google", detail: "Business Profile", x: 68, y: 104 },
  { id: "trustpilot", label: "Trustpilot", detail: "Approved access", x: 68, y: 214 },
  { id: "csv", label: "CSV import", detail: "2,481 rows", x: 68, y: 324 },
  { id: "api", label: "Reviews API", detail: "Signed requests", x: 68, y: 434 },
]

export const CLUSTERS: ClusterNode[] = [
  { id: "staff", name: "Friendly, attentive staff", share: 31, reviews: 540, trend: "Stable", tone: "lime", mix: [86, 10, 4], x: 372, y: 140, r: 66, quote: "The team remembered our order from last time.", sources: ["google", "api"] },
  { id: "wait", name: "Long waiting times", share: 23, reviews: 412, trend: "Rising", tone: "orange", mix: [14, 22, 64], x: 300, y: 326, r: 58, quote: "Waited 40 minutes for a table on Friday.", sources: ["google", "csv", "trustpilot"] },
  { id: "delivery", name: "Late delivery", share: 14, reviews: 188, trend: "Rising", tone: "orange", mix: [21, 25, 54], x: 498, y: 298, r: 44, quote: "Late twice this month — packaging was excellent.", sources: ["trustpilot", "api"] },
  { id: "value", name: "Value for money", share: 11, reviews: 151, trend: "Easing", tone: "sky", mix: [38, 34, 28], x: 532, y: 124, r: 38, quote: "Portions are better than last year.", sources: ["csv"] },
  { id: "booking", name: "Booking confirmation", share: 9, reviews: 96, trend: "New", tone: "cobalt", mix: [12, 30, 58], x: 428, y: 452, r: 34, quote: "Never got a confirmation after booking in the app.", sources: ["csv", "api"] },
]

export const OPPORTUNITIES: OpportunityNode[] = [
  { id: "o-wait", title: "Add a weekend host", kind: "Operational fix", score: 82, from: "wait", x: 664, y: 372, tone: "orange" },
  { id: "o-delivery", title: "Delivery-time promise", kind: "3-star gap", score: 74, from: "delivery", x: 664, y: 262, tone: "orange" },
  { id: "o-staff", title: "Feature staff praise", kind: "Strength", score: 68, from: "staff", x: 664, y: 104, tone: "lime" },
  { id: "o-booking", title: "Confirm by SMS + email", kind: "Product fix", score: 61, from: "booking", x: 664, y: 478, tone: "cobalt" },
]

export const COMPETITORS = [
  { name: "You", rating: 4.1, positive: 60, complaint: 23, you: true },
  { name: "Rival A", rating: 4.3, positive: 66, complaint: 11 },
  { name: "Rival B", rating: 3.9, positive: 52, complaint: 27 },
]
