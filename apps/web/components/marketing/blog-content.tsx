import { Lightbulb } from "lucide-react"
import type { BlogBlock } from "@/lib/blog"

export function BlogContent({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="space-y-6 text-[17px] leading-[1.75] text-foreground/85">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "p":
            return <p key={i}>{b.text}</p>
          case "h2":
            return (
              <h2 key={i} id={b.id} className="scroll-mt-24 pt-6 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-[1.75rem]">
                {b.text}
              </h2>
            )
          case "h3":
            return (
              <h3 key={i} className="pt-2 text-lg font-semibold text-foreground">
                {b.text}
              </h3>
            )
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-2 pl-6 marker:text-primary">
                {b.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            )
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-2 pl-6 marker:font-semibold marker:text-primary">
                {b.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ol>
            )
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-primary pl-5 text-lg text-foreground italic">
                {b.text}
              </blockquote>
            )
          case "callout":
            return (
              <aside key={i} className="rounded-2xl border border-primary/20 bg-accent/50 p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Lightbulb aria-hidden className="size-4" /> {b.title}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed">{b.text}</p>
              </aside>
            )
        }
      })}
    </div>
  )
}
