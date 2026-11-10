import { cn } from "@/lib/utils"
import { Reveal } from "./motion"

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>{children}</div>
}

export function Section({
  id,
  className,
  children,
  labelledBy,
}: {
  id?: string
  className?: string
  children: React.ReactNode
  labelledBy?: string
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("relative py-20 sm:py-28", className)}>
      {children}
    </section>
  )
}

export function Eyebrow({ children, className, index }: { children: React.ReactNode; className?: string; index?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-2.5 font-mono text-[10.5px] font-medium tracking-[0.16em] text-signal uppercase", className)}>
      {index && <span className="text-subtle-foreground tabular">{index}</span>}
      <span aria-hidden className="h-px w-6 bg-current opacity-60" />
      {children}
    </p>
  )
}

/**
 * Editorial section header. Left-aligned by default: index + eyebrow, a tight headline, and (on wide
 * screens) the description set beside it on the baseline rather than stacked underneath.
 */
export function SectionHeader({
  id,
  eyebrow,
  index,
  title,
  description,
  align = "left",
  className,
  invert,
  split,
}: {
  id?: string
  eyebrow?: string
  index?: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: "left" | "center"
  className?: string
  invert?: boolean
  /** Set the description beside the title on large screens. */
  split?: boolean
}) {
  if (split) {
    return (
      <Reveal className={cn("grid gap-6 lg:grid-cols-12 lg:items-end", className)}>
        <div className="lg:col-span-7">
          {eyebrow && <Eyebrow index={index}>{eyebrow}</Eyebrow>}
          <h2 id={id} className="mt-5 text-[2rem] leading-[1.04] font-semibold tracking-[-0.04em] text-balance text-foreground sm:text-[2.75rem]">
            {title}
          </h2>
        </div>
        {description && <p className="text-[15.5px] leading-relaxed text-pretty text-muted-foreground lg:col-span-4 lg:col-start-9 lg:pb-1.5">{description}</p>}
      </Reveal>
    )
  }
  return (
    <Reveal className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <Eyebrow index={index} className={cn(invert && "text-signal")}>{eyebrow}</Eyebrow>}
      <h2 id={id} className={cn("mt-5 text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-[2.6rem] sm:leading-[1.06]", invert ? "text-white" : "text-foreground")}>
        {title}
      </h2>
      {description && <p className={cn("mt-4 text-base text-pretty sm:text-[17px]", invert ? "text-muted-foreground" : "text-muted-foreground")}>{description}</p>}
    </Reveal>
  )
}

/** Hero used on interior pages. */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div aria-hidden className="bg-tech-grid absolute inset-0 [mask-image:radial-gradient(ellipse_70%_80%_at_30%_0%,black_20%,transparent_75%)]" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_70%_at_80%_0%,color-mix(in_oklab,var(--signal)_10%,transparent),transparent_70%)]" />
      <div aria-hidden className="bg-noise absolute inset-0" />
      <Container className="relative pt-20 pb-16 sm:pt-28 sm:pb-20">
        <Reveal className="max-w-3xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-6xl sm:leading-[1.0]">
            {title}
          </h1>
          {description && <p className="mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">{description}</p>}
          {children && <div className="mt-8">{children}</div>}
        </Reveal>
      </Container>
    </section>
  )
}
