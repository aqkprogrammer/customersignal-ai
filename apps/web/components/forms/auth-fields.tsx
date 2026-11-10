"use client"

import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowUpRight, Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * Terminal field: a hairline rail on the left lights up in cyan while any control inside has focus
 * (CSS only), and validation messages slide in/out rather than popping.
 */
export function Field({
  id,
  label,
  error,
  children,
  hint,
  className,
  action,
  rail = false,
}: {
  id: string
  label: React.ReactNode
  error?: string
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
  /** Terminal rail (auth screens). */
  rail?: boolean
}) {
  const reduce = useReducedMotion()
  return (
    <div
      className={cn(
        "group/field relative space-y-1.5",
        rail && [
          "pl-4 before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-foreground/[0.07]",
          "after:absolute after:inset-y-1 after:left-0 after:w-[3px] after:origin-top after:scale-y-0 after:rounded-full after:bg-[#4169F5] after:transition-transform after:duration-300 focus-within:after:scale-y-100",
          error && "before:bg-destructive/70",
        ],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-[14px] font-medium text-foreground/90 transition-colors group-focus-within/field:text-foreground">
          {label}
        </Label>
        {action}
      </div>
      {children}
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={`${id}-error`}
            role="alert"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -3 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden text-[13px] font-medium text-destructive"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[13px] text-muted-foreground">
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/** Elevated form card with a status strip. */
export function TerminalPanel({ label, status, children, className }: { label: React.ReactNode; status?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative rounded-3xl border border-border bg-card shadow-[0_2px_4px_rgb(23_32_51/0.03),0_30px_60px_-36px_rgb(23_32_51/0.35)]", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3 text-[13px] text-muted-foreground">
        <span className="truncate font-medium">{label}</span>
        {status}
      </div>
      <div className="p-6 sm:p-7">{children}</div>
    </div>
  )
}

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className={cn("h-10 pr-11", props.className)} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-1 right-1 flex w-9 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span key={show ? "off" : "on"} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.14 }}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  )
}

const googleCls =
  "group relative flex h-12 w-full items-center gap-3 rounded-full border border-border-strong bg-white pr-4 pl-1.5 text-[15px] font-medium text-foreground shadow-[0_1px_2px_rgb(23_32_51/0.05)] transition-[background-color,border-color,box-shadow] duration-200 hover:border-[#4169F5]/40 hover:shadow-[0_8px_20px_-12px_rgb(65_105_245/0.5)] focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none active:scale-[0.99]"

export function GoogleButton({ next, label = "Continue with Google" }: { next?: string; label?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["auth-providers"],
    queryFn: () => api<{ google: boolean }>("/auth/providers", { noWorkspace: true }),
    staleTime: 300_000,
  })
  const enabled = data?.google ?? false
  const href = `/api/v1/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ""}`
  const content = (
    <>
      <span className="flex size-9 items-center justify-center rounded-full bg-[#F7F6F2]">
        <GoogleIcon />
      </span>
      <span className="flex-1 text-center">{label}</span>
      <ArrowUpRight aria-hidden className="size-4 text-subtle-foreground transition-[color,transform] group-hover:translate-x-px group-hover:-translate-y-px group-hover:text-[#4169F5]" />
    </>
  )
  if (enabled) {
    return (
      <a href={href} className={googleCls}>
        {content}
      </a>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} role="button" aria-disabled="true" className={cn(googleCls, "cursor-not-allowed opacity-55 hover:border-border-strong hover:shadow-none", isLoading && "animate-pulse")}>
          {content}
        </span>
      </TooltipTrigger>
      <TooltipContent>Google sign-in isn&apos;t configured on this server yet (set GOOGLE_CLIENT_ID / SECRET).</TooltipContent>
    </Tooltip>
  )
}

export function Divider({ label = "or" }: { label?: string }) {
  return (
    <div className="relative my-6 flex items-center gap-3 text-[13px] text-subtle-foreground">
      <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,var(--border-strong))]" />
      {label}
      <span className="h-px flex-1 bg-[linear-gradient(90deg,var(--border-strong),transparent)]" />
    </div>
  )
}

/** Auth page heading. */
export function AuthHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#eef2ff] px-3 py-1 text-[13px] font-semibold text-[#2f52dd]">
        <span aria-hidden className="size-1.5 rounded-full bg-[#FF8757]" />
        {eyebrow}
      </p>
      <h1 className="text-[2.3rem] leading-[1.05] font-semibold tracking-[-0.045em] text-balance">{title}</h1>
      {description && <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  )
}
