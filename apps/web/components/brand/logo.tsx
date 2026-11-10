import Link from "next/link"
import { cn } from "@/lib/utils"

/** Mark: the brand waveform passing through an orbit — a signal crossing the intelligence core. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="#0C131A" stroke="#45E5EA" strokeOpacity="0.35" />
      <ellipse cx="16" cy="16" rx="11" ry="4.2" fill="none" stroke="#80BDFF" strokeOpacity="0.45" strokeWidth="0.9" transform="rotate(-18 16 16)" />
      <path d="M6.5 17.5c2 0 2-5 4-5s2 8 4 8 2-11 4-11 2 8 3 8h3.5" fill="none" stroke="#45E5EA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25" cy="17.5" r="1.4" fill="#F4F7FA" />
    </svg>
  )
}

export function Logo({ href = "/", className, inverted }: { href?: string; className?: string; inverted?: boolean }) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2.5 rounded-md font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none", className)}
      aria-label="CustomerSignal AI home"
    >
      <LogoMark />
      <span className={cn("text-[15px]", inverted ? "text-white" : "text-foreground")}>
        CustomerSignal
        <span className="ml-1.5 rounded-[4px] border border-[color-mix(in_oklab,var(--signal)_35%,transparent)] px-1 py-px align-[2px] font-mono text-[9.5px] font-medium tracking-[0.12em] text-signal">AI</span>
      </span>
    </Link>
  )
}
