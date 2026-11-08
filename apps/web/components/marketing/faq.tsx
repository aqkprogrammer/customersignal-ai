import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export type FaqItem = { q: string; a: string }

export const HOME_FAQ: FaqItem[] = [
  {
    q: "Where does CustomerSignal AI get review data from?",
    a: "Only from sources you are entitled to use: files you upload (CSV or Excel exports), data you push through our Reviews API, official platform APIs that you authorize, and licensed, authorized data providers. We do not scrape websites in violation of their terms, and we never bypass logins, rate limits or bot protection.",
  },
  {
    q: "Do you scrape Google, Trustpilot or other review sites?",
    a: "No. Platform integrations such as Google Business Profile, Trustpilot and Amazon Selling Partner use each platform's official API and are only enabled once access is approved for your account. Where a platform has no official route, we recommend exporting your reviews and uploading them.",
  },
  {
    q: "Does it understand Arabic reviews?",
    a: "Yes. Reviews are language-detected automatically and Arabic reviews are analyzed and translated so that themes and trends are comparable across languages.",
  },
  {
    q: "Is the 1-Star Review Cold Pitch ethical?",
    a: "It is designed to be. Opportunity Finder helps agencies approach a business — never the individual reviewer — with an aggregated, evidence-based view of a fixable problem. We do not expose reviewer identities in outreach, and the generated briefs avoid shaming or pressure tactics.",
  },
  {
    q: "Who owns the data I upload?",
    a: "You do. You can export or delete your workspace data at any time. We do not use your reviews to train third-party foundation models, and AI providers we use are contractually restricted from doing so.",
  },
  {
    q: "Can I try it before paying?",
    a: "Yes. The Free plan lets you analyze up to 100 reviews a month with no card required, and paid plans include a 14-day trial.",
  },
]

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <Accordion type="single" collapsible className="divide-y rounded-2xl border bg-card">
      {items.map((item, i) => (
        <AccordionItem key={item.q} value={`faq-${i}`} className="border-0 px-5 sm:px-6">
          <AccordionTrigger className="py-5 text-[15px] font-semibold hover:no-underline sm:text-base">{item.q}</AccordionTrigger>
          <AccordionContent className="pb-5 text-[15px] leading-relaxed text-muted-foreground">
            <p>{item.a}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
