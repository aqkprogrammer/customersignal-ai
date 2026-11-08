/** Marketing blog content. Typed blocks keep posts renderable without MDX tooling. */

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "callout"; title: string; text: string }

export type BlogPost = {
  slug: string
  title: string
  description: string
  category: "Review analysis" | "Outreach" | "Product" | "Competitive intelligence"
  date: string // ISO yyyy-mm-dd
  readingMinutes: number
  author: { name: string; role: string }
  tags: string[]
  body: BlogBlock[]
}

const TEAM = { name: "CustomerSignal AI Team", role: "Research & Product" }

export const POSTS: BlogPost[] = [
  {
    slug: "how-to-analyze-customer-reviews",
    title: "How to Analyze Customer Reviews: A Practical Framework for Busy Teams",
    description:
      "A step-by-step framework for turning hundreds or thousands of customer reviews into prioritized, evidence-backed decisions — without drowning in spreadsheets.",
    category: "Review analysis",
    date: "2026-10-20",
    readingMinutes: 8,
    author: TEAM,
    tags: ["review analysis", "sentiment analysis", "customer feedback"],
    body: [
      {
        type: "p",
        text: "Most businesses read reviews one at a time: a manager skims the latest 1-star, replies, and moves on. That is customer service, not analysis. Analysis means looking across all of your reviews at once to answer three questions: what do customers talk about, how do they feel about each topic, and what is changing over time.",
      },
      { type: "h2", id: "collect", text: "1. Collect reviews the right way" },
      {
        type: "p",
        text: "Start with every source you are entitled to use: exports from your review management tool, delivery-app dashboards, marketplace seller centers, post-visit surveys and support tickets. Where a platform offers an official API for your own listings, use it. Avoid scraping platforms against their terms — it creates legal risk and the data is often incomplete or broken by layout changes.",
      },
      {
        type: "ul",
        items: [
          "Keep at minimum: review text, rating, date and source platform.",
          "Add location or branch, product or SKU, and language if you have them — they unlock the most useful comparisons.",
          "De-duplicate. The same review often appears in more than one export.",
        ],
      },
      { type: "h2", id: "categorize", text: "2. Categorize before you count" },
      {
        type: "p",
        text: "A star rating tells you how someone felt, not why. The most important step is assigning each review to one or more themes — waiting time, staff behavior, pricing, product quality, delivery, cleanliness and so on. Use a fixed, industry-appropriate list so you can compare month to month. A single review can and should carry multiple themes: “great food but we waited 40 minutes” is positive on food and negative on waiting time.",
      },
      {
        type: "callout",
        title: "Tip: sentiment per theme, not per review",
        text: "Overall sentiment hides the story. Score sentiment for each theme a review mentions. A 3-star review is rarely “neutral” — it is usually positive about some things and negative about one specific thing.",
      },
      { type: "h2", id: "measure", text: "3. Measure share of voice and trend" },
      {
        type: "p",
        text: "For each theme, track two numbers: share of voice (the percentage of reviews mentioning it) and net sentiment (positive mentions minus negative mentions). Then look at the trend over the last 4–12 weeks. A complaint that represents 8% of reviews but has doubled in a month is usually more urgent than a stable 15% complaint you already know about.",
      },
      {
        type: "ol",
        items: [
          "Rank themes by negative share of voice.",
          "Flag any theme whose share has risen meaningfully versus the previous period.",
          "Split the top themes by branch, product or weekday to find where the problem concentrates.",
        ],
      },
      { type: "h2", id: "evidence", text: "4. Attach evidence to every finding" },
      {
        type: "p",
        text: "Teams act on stories, not percentages. For each finding, pull three to five representative quotes. “Weekend wait times are rising” lands differently when it is followed by a customer explaining they left before ordering. Evidence also keeps analysis honest: if you cannot find quotes that support a conclusion, the conclusion is probably wrong.",
      },
      { type: "h2", id: "act", text: "5. Turn findings into owners and actions" },
      {
        type: "p",
        text: "Each top finding should end with a recommended action, an owner and a way to measure success — usually the theme's share of voice or net sentiment over the next month. Re-run the analysis on a fixed cadence so you can see whether changes actually worked.",
      },
      { type: "h2", id: "pitfalls", text: "Common pitfalls" },
      {
        type: "ul",
        items: [
          "Chasing the loudest review instead of the most frequent theme.",
          "Mixing languages without translating — Arabic and English reviews about the same issue should land in the same theme.",
          "Changing your category list every month, which makes trends meaningless.",
          "Reporting averages across branches that behave completely differently.",
        ],
      },
      {
        type: "p",
        text: "Done manually, this framework takes days per cycle. Tools like CustomerSignal AI automate the categorization, sentiment, clustering and evidence steps so your team can spend its time on the last one: deciding what to do.",
      },
    ],
  },
  {
    slug: "ethical-1-star-review-outreach",
    title: "The Ethics of 1-Star Review Outreach: How Agencies Can Pitch Without Crossing the Line",
    description:
      "Using public negative reviews to find prospects can be genuinely helpful — or deeply off-putting. Here is a practical code of conduct for agencies and consultants.",
    category: "Outreach",
    date: "2026-10-27",
    readingMinutes: 7,
    author: TEAM,
    tags: ["agencies", "cold outreach", "ethics", "lead generation"],
    body: [
      {
        type: "p",
        text: "A business with a cluster of recent 1-star reviews about slow delivery has a real, fixable problem. An agency that specializes in operations or customer experience could genuinely help. The question is not whether to use that public signal, but how to use it without being invasive, misleading or cruel.",
      },
      { type: "h2", id: "principles", text: "Five principles for ethical review-based outreach" },
      { type: "h3", text: "1. Contact the business, never the reviewer" },
      {
        type: "p",
        text: "Reviewers wrote for other customers and for the business — not to become part of your sales funnel. Never message, tag or identify individual reviewers. Your outreach goes to the business, through its published business channels.",
      },
      { type: "h3", text: "2. Aggregate, don't expose" },
      {
        type: "p",
        text: "Describe patterns, not people. “Around a third of your 1-star reviews in the last 90 days mention delivery delays” is useful. Pasting a named customer's angry review into a cold email is not. If you quote, paraphrase briefly and omit names.",
      },
      { type: "h3", text: "3. Lead with help, not shame" },
      {
        type: "p",
        text: "Owners are often painfully aware of their bad reviews. An email that implies incompetence will be deleted, and it reflects badly on you. Frame your message around what is going well, the one or two fixable themes, and a concrete idea for addressing them.",
      },
      { type: "h3", text: "4. Be accurate and transparent" },
      {
        type: "p",
        text: "Say where the insight came from (public reviews), the time period and the approximate sample size. Don't exaggerate trends to create urgency. If your analysis is automated, say so.",
      },
      { type: "h3", text: "5. Respect the rules of the channel" },
      {
        type: "p",
        text: "Follow the marketing and data protection rules that apply where you and the prospect operate, including consent requirements for commercial messages and easy opt-outs. In the UAE, that includes the Personal Data Protection Law (Federal Decree-Law No. 45 of 2021) and telecom regulator guidance on marketing messages; in Saudi Arabia, the PDPL. When in doubt, take legal advice.",
      },
      {
        type: "callout",
        title: "A quick test",
        text: "Would you be comfortable if the business owner forwarded your email to the reviewer, or posted it publicly? If not, rewrite it.",
      },
      { type: "h2", id: "template", text: "What a good first message looks like" },
      {
        type: "ul",
        items: [
          "One sentence on who you are and why you are writing to them specifically.",
          "One genuine strength customers mention — it shows you read beyond the negatives.",
          "One aggregated, fixable theme with a time frame (“in the last three months…”).",
          "One concrete suggestion they could try even without hiring you.",
          "A low-pressure call to action and a clear way to opt out.",
        ],
      },
      { type: "h2", id: "dont", text: "Red lines" },
      {
        type: "ul",
        items: [
          "Offering to remove, bury or “fix” reviews, or to post fake positive ones.",
          "Threatening to publicize a business's negative reviews.",
          "Scraping review platforms in breach of their terms to build lead lists.",
          "Implying an affiliation with a review platform that you don't have.",
        ],
      },
      {
        type: "p",
        text: "CustomerSignal AI's Opportunity Finder is built around these principles: it works from aggregated themes, does not surface reviewer identities in outreach briefs, and generates messages that lead with evidence and help. Ethics aside, it also simply converts better — owners respond to people who clearly understand their business.",
      },
    ],
  },
  {
    slug: "3-star-review-gap-analysis",
    title: "Why 3-Star Reviews Are Your Most Valuable Feedback (and How to Run a Gap Analysis)",
    description:
      "Mixed reviews tell you exactly what stands between “good” and “great”. Here is how to run a 3-star gap analysis that produces a prioritized improvement roadmap.",
    category: "Product",
    date: "2026-11-03",
    readingMinutes: 7,
    author: TEAM,
    tags: ["3-star reviews", "gap analysis", "product roadmap"],
    body: [
      {
        type: "p",
        text: "Five-star reviews tell you what to protect. One-star reviews often describe a single bad incident. Three-star reviews are different: they come from customers who were willing to like you, and who tell you — usually very specifically — what held them back. That makes them the best source of improvement ideas most businesses own.",
      },
      { type: "h2", id: "why", text: "Why mixed reviews are so useful" },
      {
        type: "ul",
        items: [
          "They are balanced: most contain both praise and criticism, so you learn what to keep and what to change.",
          "They are specific: “lovely room, but the Wi-Fi kept dropping” is more actionable than “worst stay ever”.",
          "They describe recoverable customers — people one fix away from becoming promoters.",
        ],
      },
      { type: "h2", id: "method", text: "Running a 3-star gap analysis" },
      { type: "h3", text: "Step 1: Isolate the mixed reviews" },
      {
        type: "p",
        text: "Filter to 3-star reviews (and, on 10-point scales, the 5–7 range) from the last 6–12 months. Include mixed-sentiment 4-star reviews too if your volume is low.",
      },
      { type: "h3", text: "Step 2: Split “liked” from “missing”" },
      {
        type: "p",
        text: "For each review, extract two lists: what the customer liked, and what disappointed them or was missing. Map both to your standard themes. You will usually see the same strengths appear again and again — and a small number of gaps that account for most of the lost stars.",
      },
      { type: "h3", text: "Step 3: Score each gap" },
      {
        type: "p",
        text: "Prioritize using frequency (how many mixed reviews mention it), severity (how strongly it is expressed) and effort (how hard it is to fix). A simple frequency × severity ÷ effort score is enough to rank a first roadmap.",
      },
      {
        type: "callout",
        title: "Look for the “but”",
        text: "The word “but” (or “لكن” in Arabic) is the hinge of most mixed reviews. What comes after it is the gap.",
      },
      { type: "h3", text: "Step 4: Write the smallest fix" },
      {
        type: "p",
        text: "For each top gap, describe the smallest change that would plausibly turn a 3-star experience into a 5-star one. “Add a Saturday lunch shift” beats “improve service”. Attach three quotes so the owner understands the customer's perspective.",
      },
      { type: "h3", text: "Step 5: Measure the gap closing" },
      {
        type: "p",
        text: "After shipping a fix, track the share of mixed reviews that mention that gap. If it falls and your share of 4- and 5-star reviews rises, the fix worked. If not, the real gap may be somewhere else.",
      },
      { type: "h2", id: "examples", text: "Examples by industry" },
      {
        type: "ul",
        items: [
          "Restaurants: food praised, wait times criticized → staffing and booking changes at peak hours.",
          "Salons and spas: results praised, punctuality criticized → schedule buffers and running-late notifications.",
          "Ecommerce: product praised, sizing criticized → better size guides and fit notes on product pages.",
          "Clinics: doctors praised, billing criticized → upfront cost estimates and insurance checklists.",
        ],
      },
      {
        type: "p",
        text: "CustomerSignal AI's 3-Star Gap Finder automates the extraction, theming and scoring steps and produces a roadmap with the supporting quotes attached — so you can spend your time on the fixes themselves.",
      },
    ],
  },
  {
    slug: "competitor-review-monitoring-uae",
    title: "Competitor Review Monitoring for UAE Businesses: A Practical Guide",
    description:
      "How restaurants, clinics, salons and retailers in Dubai, Abu Dhabi and across the UAE can benchmark competitors' reviews ethically and turn the findings into positioning.",
    category: "Competitive intelligence",
    date: "2026-11-06",
    readingMinutes: 8,
    author: TEAM,
    tags: ["competitor analysis", "UAE", "Dubai", "local SEO", "reputation"],
    body: [
      {
        type: "p",
        text: "In dense UAE markets — a JBR restaurant strip, a Jumeirah salon row, a cluster of clinics in Al Barsha — customers compare you with the business next door before they ever visit. Your competitors' reviews are a free, public, continuously updated map of what customers in your neighborhood value and what disappoints them.",
      },
      { type: "h2", id: "choose", text: "1. Choose the right competitors" },
      {
        type: "p",
        text: "Pick three to five businesses your customers would genuinely consider instead of you: same category, similar price point, similar catchment. In the UAE, catchment is often defined by drive time and parking more than distance. For multi-branch businesses, benchmark each branch against its own local set.",
      },
      { type: "h2", id: "data", text: "2. Gather data responsibly" },
      {
        type: "p",
        text: "Use legitimate access routes: platform features and official APIs where they permit competitor or market data, licensed data providers, and manual research for small samples. Avoid automated scraping that breaches platform terms. Keep your analysis to aggregated themes rather than collecting personal data about individual reviewers — this is both more useful and more consistent with the UAE's Personal Data Protection Law.",
      },
      { type: "h2", id: "compare", text: "3. Compare on the same themes" },
      {
        type: "p",
        text: "Star averages are too blunt to act on. Instead, compare net sentiment per theme — waiting time, value for money, staff, cleanliness, parking, delivery — across you and each competitor. This reveals where you lead, where you lag, and where everyone is weak.",
      },
      {
        type: "callout",
        title: "The opportunity is often where everyone is weak",
        text: "If every clinic in your area gets complaints about waiting times, being the one that runs on time is a positioning advantage you can advertise.",
      },
      { type: "h2", id: "local", text: "4. Account for local context" },
      {
        type: "ul",
        items: [
          "Language: many UAE reviews are in Arabic, English or a mix. Translate before theming so nothing is lost.",
          "Seasonality: Ramadan, summer and the winter tourist season shift both volume and expectations. Compare like-for-like periods.",
          "Tourists vs. residents: visitors and residents complain about different things. Tag where you can.",
          "Delivery platforms: for F&B, delivery-app reviews can be a separate, equally important reputation.",
        ],
      },
      { type: "h2", id: "act", text: "5. Turn findings into positioning and operations" },
      {
        type: "ol",
        items: [
          "Fix the themes where you lag competitors and customers care most.",
          "Promote the themes where you clearly lead — in listings, ads and on-site copy.",
          "Claim the gaps where every competitor is weak, and make them part of your brand promise.",
          "Re-check monthly. Competitors respond, and local markets move quickly.",
        ],
      },
      { type: "h2", id: "monitor", text: "6. Monitor, don't just audit" },
      {
        type: "p",
        text: "A one-off audit goes stale in a quarter. Set up recurring monitoring with alerts for meaningful changes: a competitor's rating dropping, a new complaint theme appearing in your area, or your own share of a negative theme rising.",
      },
      {
        type: "p",
        text: "CustomerSignal AI's Competitor Intelligence module compares you with competitors theme by theme, highlights market gaps, and alerts you when something changes — using only uploads, official APIs and authorized providers.",
      },
    ],
  },
  {
    slug: "responding-to-negative-reviews-playbook",
    title: "From Complaint to Fix: A Playbook for Responding to Negative Reviews",
    description:
      "Responding to bad reviews protects your reputation; fixing the pattern behind them grows it. Here is a playbook that connects both.",
    category: "Review analysis",
    date: "2026-11-08",
    readingMinutes: 6,
    author: TEAM,
    tags: ["negative reviews", "review responses", "customer experience"],
    body: [
      {
        type: "p",
        text: "Every negative review has two audiences: the customer who wrote it and the hundreds of future customers who will read your reply. But the biggest win isn't the reply — it's noticing when ten different customers are describing the same problem, and fixing it.",
      },
      { type: "h2", id: "respond", text: "Responding well" },
      {
        type: "ol",
        items: [
          "Reply quickly — ideally within 24–48 hours.",
          "Thank them and acknowledge the specific issue, in their language where possible.",
          "Don't argue publicly or disclose personal or booking details.",
          "Offer a direct channel to resolve it, then follow through.",
          "Where you've fixed the underlying issue, say so briefly.",
        ],
      },
      {
        type: "callout",
        title: "Never incentivize or suppress reviews",
        text: "Offering refunds or gifts in exchange for removing or editing reviews violates most platforms' policies and can breach consumer protection rules.",
      },
      { type: "h2", id: "patterns", text: "From individual replies to patterns" },
      {
        type: "p",
        text: "Once a month, step back from individual reviews. Group negative reviews by theme and count them. Most businesses find that two or three themes explain the majority of negative feedback. These are your priorities.",
      },
      { type: "h2", id: "close-loop", text: "Closing the loop" },
      {
        type: "ul",
        items: [
          "Assign each top theme an owner and a concrete fix.",
          "Share representative quotes with the team that owns the fix.",
          "Track the theme's share of reviews over the following weeks.",
          "Celebrate when it falls — and tell customers what changed.",
        ],
      },
      {
        type: "p",
        text: "CustomerSignal AI helps by clustering negative reviews into themes, tracking each theme's trend and alerting you when one starts to rise, so replies and fixes reinforce each other.",
      },
    ],
  },
]

export function getAllPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug)
}

export function formatPostDate(iso: string) {
  // Parse as UTC to avoid timezone drift; no `new Date()` without arguments (prerender-safe).
  const [y, m, d] = iso.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  )
}
