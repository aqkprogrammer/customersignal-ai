import Link from "next/link"
import { cn } from "@/lib/utils"

/** Mark: three customer signals (cobalt, orange, lime) converging into one connected insight. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="9" fill="#101B35" />
      <path d="M9 10.5 L17.5 16 M9 21.5 L17.5 16 M17.5 16 L24 16" stroke="#F7F6F2" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9" cy="10.5" r="3" fill="#4169F5" />
      <circle cx="9" cy="21.5" r="3" fill="#FF8757" />
      <circle cx="17.5" cy="16" r="2.4" fill="#F7F6F2" />
      <circle cx="24" cy="16" r="3.4" fill="#B7E66B" />
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
      <span className={cn("text-[16px] tracking-[-0.02em]", inverted ? "text-white" : "text-foreground")}>
        CustomerSignal<span className={cn("ml-1 font-medium", inverted ? "text-[#92C9FF]" : "text-[#4169F5]")}>AI</span>
      </span>
    </Link>
  )
}
