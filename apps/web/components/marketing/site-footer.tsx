import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { SITE } from "@/lib/site"
import { Container } from "./section"
import { COPYRIGHT_YEAR, FOOTER_COLUMNS } from "./site-data"

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-navy text-indigo-100/70" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
      <Container className="relative py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm">
            <Logo inverted />
            <p className="mt-5 text-sm leading-relaxed">
              AI-powered review analysis, competitor intelligence and product opportunity discovery — built in the UAE for
              businesses across the GCC and beyond.
            </p>
            <div className="mt-6 space-y-1.5 text-sm">
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
                <h3 className="font-mono text-[11px] font-medium tracking-[0.16em] text-indigo-200/50 uppercase">{col.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-sm text-indigo-100/75 transition-colors hover:text-white focus-visible:text-white focus-visible:underline focus-visible:outline-none"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-indigo-200/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {COPYRIGHT_YEAR} {SITE.name}. All rights reserved.
          </p>
          <p>We analyze reviews from uploads, official APIs and authorized providers only — never unauthorized scraping.</p>
        </div>
      </Container>
    </footer>
  )
}
