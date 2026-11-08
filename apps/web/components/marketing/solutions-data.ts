import type { SolutionSummary } from "./site-data"

export type SolutionContent = {
  slug: SolutionSummary["slug"]
  metaTitle: string
  metaDescription: string
  eyebrow: string
  headline: string
  intro: string
  pains: { title: string; body: string }[]
  themes: string[]
  plays: { title: string; body: string }[]
  sampleInsight: { label: string; stat: string; action: string }
  faqs: { q: string; a: string }[]
}

export const SOLUTION_CONTENT: Record<SolutionSummary["slug"], SolutionContent> = {
  restaurants: {
    slug: "restaurants",
    metaTitle: "Review analysis for restaurants & cafés",
    metaDescription:
      "Find out why diners leave 3 and 1-star reviews. Cluster complaints about wait times, service and food quality across every branch, and benchmark against nearby competitors.",
    eyebrow: "Restaurants & cafés",
    headline: "Know exactly why tables don't come back.",
    intro:
      "From a single café in Jumeirah to a 20-branch group across the GCC, CustomerSignal reads every review so you can see which dishes, shifts and branches are winning — and which are quietly costing you stars.",
    pains: [
      { title: "Branch blind spots", body: "Averages hide the branch where Friday service collapses. Compare branches theme by theme." },
      { title: "Peak-hour pain", body: "Wait-time and order-accuracy complaints cluster around specific days and hours. See when, not just what." },
      { title: "Menu guesswork", body: "Learn which dishes are praised by name, which are “just OK”, and what diners wish you served." },
    ],
    themes: ["Waiting time", "Food quality", "Staff behavior", "Value for money", "Cleanliness", "Delivery accuracy"],
    plays: [
      { title: "Fix the weekend queue", body: "Spot rising wait-time complaints early and adjust staffing before ratings slip." },
      { title: "Benchmark the street", body: "Compare your theme scores with nearby competitors to find the positioning gap nobody owns." },
      { title: "Brief the kitchen", body: "Share a monthly PDF with dish-level praise and complaints, quotes included." },
    ],
    sampleInsight: {
      label: "Long waiting times",
      stat: "23% of reviews, rising",
      action: "Add a Saturday 12–3pm shift at the Marina branch and show live wait times on bookings.",
    },
    faqs: [
      { q: "Can I compare multiple branches?", a: "Yes. Create a project per branch or tag reviews by location to compare themes, ratings and trends side by side." },
      { q: "Do you support delivery app reviews?", a: "Yes, if you can export them. Upload CSV or Excel exports from your delivery partner dashboards; we never scrape platforms." },
    ],
  },
  "beauty-wellness": {
    slug: "beauty-wellness",
    metaTitle: "Review analysis for salons, spas & wellness",
    metaDescription:
      "Understand what clients love and what drives them away — booking friction, punctuality, pricing clarity and therapist-level patterns — with AI review analysis.",
    eyebrow: "Beauty & wellness",
    headline: "Turn every client review into a better appointment.",
    intro:
      "Salons, spas, clinics and fitness studios live on rebooking. CustomerSignal surfaces the moments that make clients loyal — and the small frictions that quietly send them elsewhere.",
    pains: [
      { title: "Booking friction", body: "Double bookings, late starts and confusing confirmations show up long before churn does." },
      { title: "Price surprises", body: "“Charged more than quoted” is a top reason for 1-star reviews. Find where expectations break." },
      { title: "Consistency across staff", body: "See which services earn praise by name, and where experience varies between team members." },
    ],
    themes: ["Appointment management", "Punctuality", "Pricing transparency", "Hygiene", "Staff expertise", "Atmosphere"],
    plays: [
      { title: "Repair the booking flow", body: "Quantify appointment complaints and track whether changes actually reduce them." },
      { title: "Clarify the menu", body: "Use pricing complaints to rewrite service descriptions and add-on disclosures." },
      { title: "Celebrate what works", body: "Share positive, quote-backed feedback with your team every month." },
    ],
    sampleInsight: {
      label: "Appointment delays",
      stat: "17% of reviews, rising",
      action: "Add 10-minute buffers between colour services and send a running-late SMS automatically.",
    },
    faqs: [
      { q: "Can I analyze reviews per therapist or stylist?", a: "Yes, when staff names appear in reviews or are included as a column in your upload. Use this for coaching, not public ranking." },
      { q: "Do you handle Arabic reviews?", a: "Yes. Arabic reviews are detected automatically, analyzed and translated so themes are comparable across languages." },
    ],
  },
  healthcare: {
    slug: "healthcare",
    metaTitle: "Patient experience analysis for clinics & healthcare",
    metaDescription:
      "Understand patient experience from public reviews — waiting times, communication, front-desk service and billing clarity — without processing clinical records.",
    eyebrow: "Clinics & healthcare",
    headline: "Hear what patients say after they leave.",
    intro:
      "CustomerSignal helps dental, dermatology, physiotherapy and multi-specialty clinics understand the non-clinical patient experience: access, waiting, communication and billing. We analyze review text — not medical records.",
    pains: [
      { title: "Waiting-room frustration", body: "Long waits despite appointments are the most common driver of negative clinic reviews." },
      { title: "Communication gaps", body: "Patients remember how clearly a treatment and its cost were explained. Find where it breaks." },
      { title: "Front-desk experience", body: "Reception, phone and follow-up experiences shape ratings as much as care itself." },
    ],
    themes: ["Waiting time", "Communication", "Front desk", "Billing & insurance", "Cleanliness", "Follow-up"],
    plays: [
      { title: "Shorten real waits", body: "Track waiting-time complaints by location and weekday to target scheduling fixes." },
      { title: "Explain costs upfront", body: "Use billing-related reviews to improve estimates and insurance communication." },
      { title: "Respond with care", body: "Prioritize responses to reviews that mention unresolved issues — without disclosing patient information." },
    ],
    sampleInsight: {
      label: "Insurance & billing confusion",
      stat: "11% of reviews, new",
      action: "Send a pre-visit cost estimate and insurance checklist with every confirmation.",
    },
    faqs: [
      { q: "Do you process medical or health records?", a: "No. CustomerSignal is designed for review and feedback text. Do not upload clinical records or patient identifiers beyond what appears in public reviews." },
      { q: "Is it suitable for regulated providers?", a: "CustomerSignal is intended for patient-experience insight only. Review the Security and Privacy pages and speak to us about a data processing agreement for your compliance needs." },
    ],
  },
  ecommerce: {
    slug: "ecommerce",
    metaTitle: "Product review analysis for ecommerce brands",
    metaDescription:
      "Turn product reviews into roadmap decisions: sizing, quality, packaging and delivery issues clustered by SKU, plus 3-star gap analysis and competitor comparison.",
    eyebrow: "Ecommerce brands",
    headline: "Your product roadmap is hiding in your reviews.",
    intro:
      "Whether you sell on your own store, Amazon or Noon, product reviews tell you what to fix, what to bundle and what to build next. CustomerSignal turns them into a prioritized, evidence-backed list.",
    pains: [
      { title: "Returns you can't explain", body: "Sizing, colour accuracy and quality complaints hide inside thousands of reviews across SKUs." },
      { title: "Delivery drag", body: "Late or damaged deliveries pull down product ratings that have nothing to do with the product." },
      { title: "Feature requests lost", body: "Customers literally tell you what they wish the product did. Most brands never collect it." },
    ],
    themes: ["Product quality", "Sizing & fit", "Delivery", "Packaging", "Value for money", "Customer service"],
    plays: [
      { title: "Fix the top return reason", body: "Cluster sizing and quality complaints by product and update size guides or suppliers." },
      { title: "Mine the 3-star gap", body: "Find the one missing feature that keeps a good product from 5 stars." },
      { title: "Separate product from logistics", body: "Isolate delivery issues so product teams and ops teams each see their own signal." },
    ],
    sampleInsight: {
      label: "Runs small (sizing)",
      stat: "19% of reviews on 3 SKUs",
      action: "Update the size guide and add a “runs small — size up” note on affected product pages.",
    },
    faqs: [
      { q: "Can I import Amazon or Shopify reviews?", a: "Yes, through exports from your reviews app or seller tools, or via the Amazon Selling Partner API once access is approved for your account. We do not scrape marketplaces." },
      { q: "Can I analyze by product or SKU?", a: "Yes. Include a product or SKU column in your upload and every insight can be filtered by product." },
    ],
  },
  agencies: {
    slug: "agencies",
    metaTitle: "Review intelligence for marketing agencies",
    metaDescription:
      "Win and retain clients with evidence-backed reputation audits, competitor reports, white-label PDFs and the ethical 1-Star Review Opportunity Finder.",
    eyebrow: "Marketing agencies",
    headline: "Open every pitch with evidence, not promises.",
    intro:
      "With CustomerSignal, agencies can audit a prospect's reputation in minutes, prove impact for existing clients, and deliver branded reports — all in one multi-project workspace.",
    pains: [
      { title: "Generic pitches", body: "Prospects ignore “we can grow your business”. They respond to “here are the three things your customers keep complaining about”." },
      { title: "Hard-to-prove impact", body: "Show clients how sentiment and complaint share moved after your campaign or CX work." },
      { title: "Report production time", body: "Stop building decks by hand. Generate branded, quote-backed PDFs in minutes." },
    ],
    themes: ["Reputation audit", "Competitor benchmark", "Complaint trends", "Opportunity briefs", "Client reporting", "Lead pipeline"],
    plays: [
      { title: "Ethical 1-star outreach", body: "Find businesses with recurring, fixable complaints and pitch the owner with an aggregated audit — never contact reviewers." },
      { title: "Quarterly client reviews", body: "Send a branded executive summary showing what changed and what to do next." },
      { title: "Sync leads to HubSpot", body: "Move Opportunity Finder leads into your CRM with one click." },
    ],
    sampleInsight: {
      label: "Prospect: recurring delivery complaints",
      stat: "31% of 1-star reviews",
      action: "Pitch a delivery-experience audit with three anonymized, aggregated review themes as evidence.",
    },
    faqs: [
      { q: "Can I white-label reports?", a: "Custom report branding is included on the Business plan, and Enterprise supports fully tailored agency arrangements." },
      { q: "Is cold outreach based on reviews allowed?", a: "Our Opportunity Finder is built around ethical outreach: contact the business through its public business channels, use aggregated insights, never identify or contact reviewers, and follow local marketing laws." },
    ],
  },
}
