import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { CtaSection } from "@/components/marketing/cta-section"
import { RevealItem } from "@/components/marketing/motion"
import { Container, PageHero } from "@/components/marketing/section"
import { absoluteUrl, JsonLd, pageMetadata } from "@/components/marketing/seo"
import { formatPostDate, getAllPosts } from "@/lib/blog"
import { SITE } from "@/lib/site"

export const metadata = pageMetadata({
  title: "Blog",
  description:
    "Practical guides on customer review analysis, 3-star gap analysis, ethical review-based outreach and competitor monitoring for UAE and GCC businesses.",
  path: "/blog",
})

export default function BlogIndexPage() {
  const posts = getAllPosts()
  const [featured, ...rest] = posts
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: `${SITE.name} Blog`,
          url: absoluteUrl("/blog"),
          blogPost: posts.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: absoluteUrl(`/blog/${p.slug}`),
            datePublished: p.date,
          })),
        }}
      />
      <PageHero
        eyebrow="Blog"
        title="Field notes on customer intelligence."
        description="Practical, no-fluff guides for owners, operators, product teams and agencies who want to turn customer feedback into decisions."
      />
      <Container className="py-14 sm:py-20">
        <Link
          href={`/blog/${featured.slug}`}
          className="group surface grid overflow-hidden transition-colors hover:border-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:grid-cols-[1.1fr_1fr]"
        >
          <div aria-hidden className="relative min-h-48 bg-navy">
            <div className="bg-grid absolute inset-0 opacity-40" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(146,201,255,0.5),transparent_60%)]" />
            <p className="absolute bottom-5 left-6 font-mono text-[11px] tracking-[0.18em] text-signal-200/80 uppercase">Latest · {featured.category}</p>
          </div>
          <div className="p-6 sm:p-10">
            <p className="text-xs text-muted-foreground">
              <time dateTime={featured.date}>{formatPostDate(featured.date)}</time> · {featured.readingMinutes} min read
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{featured.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{featured.description}</p>
            <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Read article <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {rest.map((p, i) => (
            <RevealItem key={p.slug} delay={(i % 2) * 0.06}>
              <Link
                href={`/blog/${p.slug}`}
                className="group surface flex h-full flex-col p-6 transition-colors hover:border-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-8"
              >
                <p className="font-mono text-[11px] tracking-[0.16em] text-primary uppercase">{p.category}</p>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-balance">{p.title}</h2>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-muted-foreground">{p.description}</p>
                <p className="mt-6 text-xs text-muted-foreground">
                  <time dateTime={p.date}>{formatPostDate(p.date)}</time> · {p.readingMinutes} min read
                </p>
              </Link>
            </RevealItem>
          ))}
        </ul>
      </Container>
      <CtaSection />
    </>
  )
}
