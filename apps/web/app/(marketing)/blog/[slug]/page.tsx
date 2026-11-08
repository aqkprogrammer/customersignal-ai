import { ArrowLeft, ArrowRight } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { BlogContent } from "@/components/marketing/blog-content"
import { CtaSection } from "@/components/marketing/cta-section"
import { Container } from "@/components/marketing/section"
import { absoluteUrl, JsonLd } from "@/components/marketing/seo"
import { formatPostDate, getAllPosts, getPost, POSTS } from "@/lib/blog"
import { SITE } from "@/lib/site"

type Params = { slug: string }

export function generateStaticParams(): Params[] {
  return POSTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return { title: "Article not found", robots: { index: false } }
  const path = `/blog/${post.slug}`
  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    authors: [{ name: post.author.name }],
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      siteName: SITE.name,
      title: post.title,
      description: post.description,
      url: path,
      publishedTime: post.date,
      authors: [post.author.name],
      tags: post.tags,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  }
}

export default function BlogPostPage({ params }: { params: Promise<Params> }) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <Article params={params} />
    </Suspense>
  )
}

async function Article({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const toc = post.body.filter((b): b is Extract<typeof b, { type: "h2" }> => b.type === "h2")
  const related = getAllPosts()
    .filter((p) => p.slug !== post.slug)
    .slice(0, 2)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    keywords: post.tags.join(", "),
    articleSection: post.category,
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(`/blog/${post.slug}`) },
    url: absoluteUrl(`/blog/${post.slug}`),
    author: { "@type": "Organization", name: post.author.name, url: absoluteUrl("/about") },
    publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: absoluteUrl("/icon.svg") } },
  }

  return (
    <>
      <JsonLd data={jsonLd} />
      <article aria-labelledby="post-title">
        <header className="relative overflow-hidden border-b border-border/60">
          <div aria-hidden className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
          <Container className="relative max-w-3xl pt-14 pb-12 sm:pt-20">
            <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <ArrowLeft aria-hidden className="size-4" /> All articles
            </Link>
            <p className="mt-8 font-mono text-[11px] tracking-[0.18em] text-primary uppercase">{post.category}</p>
            <h1 id="post-title" className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl sm:leading-[1.08]">
              {post.title}
            </h1>
            <p className="mt-5 text-lg text-pretty text-muted-foreground">{post.description}</p>
            <p className="mt-6 text-sm text-muted-foreground">
              {post.author.name} · <time dateTime={post.date}>{formatPostDate(post.date)}</time> · {post.readingMinutes} min read
            </p>
          </Container>
        </header>

        <Container className="grid max-w-5xl gap-12 py-12 sm:py-16 lg:grid-cols-[1fr_14rem]">
          <div className="min-w-0">
            <BlogContent blocks={post.body} />
          </div>
          {toc.length > 0 && (
            <nav aria-label="On this page" className="hidden lg:block">
              <div className="sticky top-24">
                <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">On this page</p>
                <ul className="mt-4 space-y-2.5 border-l text-sm">
                  {toc.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`} className="-ml-px block border-l border-transparent pl-4 text-muted-foreground hover:border-primary hover:text-foreground focus-visible:text-foreground focus-visible:outline-none">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          )}
        </Container>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="border-t border-border/60 bg-card/50 py-14">
          <Container className="max-w-5xl">
            <h2 id="related-heading" className="text-xl font-semibold tracking-tight">
              Keep reading
            </h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {related.map((p) => (
                <li key={p.slug}>
                  <Link href={`/blog/${p.slug}`} className="group surface flex h-full flex-col p-6 transition-colors hover:border-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                    <p className="font-mono text-[11px] tracking-[0.16em] text-primary uppercase">{p.category}</p>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight">{p.title}</h3>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Read <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}
      <CtaSection />
    </>
  )
}

function ArticleSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
      <span className="sr-only">Loading article…</span>
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-6 h-10 w-full animate-pulse rounded bg-muted" />
      <div className="mt-3 h-10 w-2/3 animate-pulse rounded bg-muted" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  )
}
