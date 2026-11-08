import { Clock, Handshake, LifeBuoy, Mail, MapPin } from "lucide-react"
import { Suspense } from "react"
import { ContactForm, ContactFormSkeleton } from "@/components/marketing/contact-form"
import { Reveal } from "@/components/marketing/motion"
import { Container, Eyebrow } from "@/components/marketing/section"
import { pageMetadata } from "@/components/marketing/seo"
import { SITE } from "@/lib/site"

export const metadata = pageMetadata({
  title: "Contact us",
  description:
    "Talk to the CustomerSignal AI team about pricing, a product demo, Enterprise plans, partnerships or support. We reply within one business day.",
  path: "/contact",
})

export default function ContactPage() {
  return (
    <section aria-labelledby="contact-heading" className="relative overflow-hidden">
      <div aria-hidden className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black_10%,transparent_60%)]" />
      <Container className="relative grid gap-12 py-20 sm:py-28 lg:grid-cols-[1fr_1.35fr] lg:gap-16">
        <Reveal>
          <Eyebrow>Contact</Eyebrow>
          <h1 id="contact-heading" className="mt-5 text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            Let&apos;s talk about what your customers are saying.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Book a demo, ask about Enterprise, or tell us what you&apos;re trying to solve. A real person will reply within one
            business day.
          </p>
          <ul className="mt-10 space-y-5 text-[15px]">
            <li className="flex gap-3">
              <Mail aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">Sales</span>
                <a className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={`mailto:${SITE.salesEmail}`}>
                  {SITE.salesEmail}
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <LifeBuoy aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">Support</span>
                <a className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={`mailto:${SITE.supportEmail}`}>
                  {SITE.supportEmail}
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <Handshake aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">Agencies & partners</span>
                <span className="text-muted-foreground">Choose “Partnerships & agencies” in the form.</span>
              </span>
            </li>
            <li className="flex gap-3">
              <Clock aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">Hours</span>
                <span className="text-muted-foreground">Monday–Friday, 9:00–18:00 Gulf Standard Time (GST)</span>
              </span>
            </li>
            <li className="flex gap-3">
              <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">Based in</span>
                <span className="text-muted-foreground">United Arab Emirates · serving the GCC and beyond</span>
              </span>
            </li>
          </ul>
        </Reveal>
        <Reveal delay={0.08}>
          <Suspense fallback={<ContactFormSkeleton />}>
            <ContactForm />
          </Suspense>
        </Reveal>
      </Container>
    </section>
  )
}
