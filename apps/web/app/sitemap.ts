import type { MetadataRoute } from "next"
import { POSTS } from "@/lib/blog"
import { SITE } from "@/lib/site"

// Fixed date: `new Date()` without arguments is not allowed during prerender with cacheComponents.
const SITE_UPDATED = "2026-11-08"

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/features", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/solutions", priority: 0.8, changeFrequency: "monthly" },
  { path: "/solutions/restaurants", priority: 0.8, changeFrequency: "monthly" },
  { path: "/solutions/beauty-wellness", priority: 0.8, changeFrequency: "monthly" },
  { path: "/solutions/healthcare", priority: 0.8, changeFrequency: "monthly" },
  { path: "/solutions/ecommerce", priority: 0.8, changeFrequency: "monthly" },
  { path: "/solutions/agencies", priority: 0.8, changeFrequency: "monthly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "yearly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/security", priority: 0.5, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, "")
  return [
    ...STATIC_ROUTES.map((r) => ({
      url: `${base}${r.path === "/" ? "" : r.path}`,
      lastModified: SITE_UPDATED,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })),
    ...POSTS.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.date,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ]
}
