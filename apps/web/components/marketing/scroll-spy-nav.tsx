"use client"

import { motion } from "motion/react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/** Sticky contents list that highlights the section currently in view. */
export function ScrollSpyNav({ items, title = "Contents" }: { items: { id: string; title: string }[]; title?: string }) {
  const [active, setActive] = useState(items[0]?.id)
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e)
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-20% 0px -65% 0px" },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [items])

  return (
    <nav aria-label={title} className="rounded-2xl border border-border bg-white p-3 shadow-[var(--shadow-card)]">
      <p className="px-3 pt-1 pb-2 text-[12px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">{title}</p>
      <ol className="space-y-0.5">
        {items.map((s, i) => {
          const on = s.id === active
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={on ? "location" : undefined}
                className={cn(
                  "relative flex gap-3 rounded-xl px-3 py-2 text-[14.5px] leading-snug transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                  on ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {on && <motion.span layoutId="spy-active" aria-hidden className="absolute inset-0 rounded-xl bg-[#eef2ff]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                <span className={cn("relative w-5 shrink-0 font-mono text-[12px] tabular-nums", on ? "text-[#4169F5]" : "text-subtle-foreground")}>{String(i + 1).padStart(2, "0")}</span>
                <span className="relative">{s.title}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
