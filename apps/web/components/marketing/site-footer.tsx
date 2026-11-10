import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { SITE } from "@/lib/site"
import { Container } from "./section"
import { COPYRIGHT_YEAR, FOOTER_COLUMNS } from "./site-data"

export function SiteFooter() {
  return (
    <footer className="dark relative overflow-hidden bg-background text-muted-foreground" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-dots absolute inset-0 [mask-image:linear-gradient(to_bottom,#000,transparent_70%)]" />
        <div className="absolute -top-40 right-[-10%] size-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(65_105_245/0.28),transparent)]" />
        <div className="absolute -bottom-48 left-[-8%] size-[440px] rounded-full bg-[radial-gradient(closest-side,rgb(255_135_87/0.16),transparent)]" />
      </div>
      <Container className="relative py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm">
            <Logo inverted />
            <p className="mt-5 text-[15px] leading-relaxed">
              Customer intelligence for teams that decide from evidence — review analysis, competitor insight and product
              opportunities. Built in the UAE for the GCC and beyond.
            </p>
            <div className="mt-6 space-y-1.5 text-[15px]">
              <p>
                Sales:{" "}
                <a className="text-white underline-offset-4 hover:underline" href={`mailto:${SITE.salesEmail}`}>
                  {SITE.salesEmail}
                </a>
              </p>
              <p>
                Support:{" "}
                <a className="text-white underline-offset-4 hover:underline" href={`mailto:${SITE.supportEmail}`}>
                  {SITE.supportEmail}
                </a>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_COLUMNS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h3 className="text-[13px] font-semibold text-white">{col.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-[14.5px] transition-colors hover:text-white focus-visible:text-white focus-visible:underline focus-visible:outline-none">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-border pt-6 text-[13px] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {COPYRIGHT_YEAR} {SITE.name}. All rights reserved.
          </p>
          <p>We analyze reviews from uploads, official APIs and authorized providers only — never unauthorized scraping.</p>
        </div>
      </Container>
    </footer>
  )
}
