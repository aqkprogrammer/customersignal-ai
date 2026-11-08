import type { Metadata } from "next"
import { SITE } from "@/lib/site"

/** Builds page metadata with canonical URL and a complete OpenGraph block (OG objects don't deep-merge). */
export function pageMetadata({
  title,
  description,
  path,
  ogType = "website",
}: {
  title: string
  description: string
  path: string
  ogType?: "website" | "article"
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: ogType,
      siteName: SITE.name,
      title: `${title} · ${SITE.name}`,
      description,
      url: path,
    },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE.name}`, description },
  }
}

export function absoluteUrl(path: string) {
  return new URL(path, SITE.url).toString()
}

/** Renders schema.org JSON-LD. `<` is escaped to prevent script injection. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  )
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  }
}
