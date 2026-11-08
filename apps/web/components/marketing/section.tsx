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

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.18em] text-primary uppercase",
        className,
      )}
    >
      <span aria-hidden className="h-px w-6 bg-current opacity-60" />
      {children}
    </p>
  )
}

export function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  className,
  invert,
}: {
  id?: string
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: "left" | "center"
  className?: string
  invert?: boolean
}) {
  return (
    <Reveal className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <Eyebrow className={cn(invert && "text-indigo-300")}>{eyebrow}</Eyebrow>}
      <h2
        id={id}
        className={cn(
          "mt-4 text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-[2.6rem] sm:leading-[1.08]",
          invert ? "text-white" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {description && (
        <p className={cn("mt-4 text-base text-pretty sm:text-lg", invert ? "text-indigo-100/70" : "text-muted-foreground")}>
          {description}
        </p>
      )}
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
      <div aria-hidden className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div
        aria-hidden
        className="absolute -top-40 left-1/2 h-80 w-[56rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.18),transparent)] blur-2xl"
      />
      <Container className="relative pt-20 pb-16 sm:pt-28 sm:pb-20">
        <Reveal className="max-w-3xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-6xl sm:leading-[1.02]">
            {title}
          </h1>
          {description && <p className="mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">{description}</p>}
          {children && <div className="mt-8">{children}</div>}
        </Reveal>
      </Container>
    </section>
  )
}
