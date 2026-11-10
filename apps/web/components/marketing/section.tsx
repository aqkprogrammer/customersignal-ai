import { cn } from "@/lib/utils"
import { Reveal } from "./motion"

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1240px] px-5 sm:px-8", className)}>{children}</div>
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
    <section id={id} aria-labelledby={labelledBy} className={cn("relative py-20 sm:py-24", className)}>
      {children}
    </section>
  )
}

export function Eyebrow({ children, className, index }: { children: React.ReactNode; className?: string; index?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-2.5 text-[13px] font-semibold tracking-[0.08em] text-[#2f52dd] uppercase dark:text-[#92C9FF]", className)}>
      {index && (
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#4169F5] px-1.5 font-mono text-[11px] font-semibold tracking-normal text-white tabular-nums">
          {index}
        </span>
      )}
      {children}
    </p>
  )
}

/** Editorial section header: index + eyebrow, a large headline, and (split) the description beside it. */
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
  split?: boolean
}) {
  const h2 = "text-[2.3rem] leading-[1.04] font-semibold tracking-[-0.045em] text-balance sm:text-[3.25rem]"
  if (split) {
    return (
      <Reveal className={cn("grid gap-6 lg:grid-cols-12 lg:items-end", className)}>
        <div className="lg:col-span-7">
          {eyebrow && <Eyebrow index={index}>{eyebrow}</Eyebrow>}
          <h2 id={id} className={cn("mt-5 text-foreground", h2)}>
            {title}
          </h2>
        </div>
        {description && <p className="text-[17px] leading-relaxed text-pretty text-muted-foreground lg:col-span-4 lg:col-start-9 lg:pb-2">{description}</p>}
      </Reveal>
    )
  }
  return (
    <Reveal className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <Eyebrow index={index}>{eyebrow}</Eyebrow>}
      <h2 id={id} className={cn("mt-5", h2, invert ? "text-white" : "text-foreground")}>
        {title}
      </h2>
      {description && <p className="mt-5 text-[17px] leading-relaxed text-pretty text-muted-foreground sm:text-lg">{description}</p>}
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
      <div aria-hidden className="bg-dots absolute inset-0 [mask-image:radial-gradient(ellipse_70%_80%_at_30%_0%,black_20%,transparent_75%)]" />
      <div aria-hidden className="absolute -top-32 right-[-6%] size-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(255_213_190/0.75),transparent)]" />
      <div aria-hidden className="absolute top-10 left-[-10%] size-[420px] rounded-full bg-[radial-gradient(closest-side,rgb(146_201_255/0.35),transparent)]" />
      <Container className="relative pt-36 pb-16 sm:pt-44 sm:pb-20">
        <Reveal className="max-w-3xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-6 text-[2.8rem] leading-[1.02] font-semibold tracking-[-0.05em] text-balance sm:text-[4.4rem]">
            {title}
          </h1>
          {description && <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-pretty text-muted-foreground sm:text-[19px]">{description}</p>}
          {children && <div className="mt-8">{children}</div>}
        </Reveal>
      </Container>
    </section>
  )
}
