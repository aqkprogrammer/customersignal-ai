"use client"

import { useQuery } from "@tanstack/react-query"
import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

export function Field({
  id,
  label,
  error,
  children,
  hint,
  className,
}: {
  id: string
  label: React.ReactNode
  error?: string
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-[13px]">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className={cn("h-10 pr-10", props.className)} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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

export function GoogleButton({ next, label = "Continue with Google" }: { next?: string; label?: string }) {
  const { data } = useQuery({
    queryKey: ["auth-providers"],
    queryFn: () => api<{ google: boolean }>("/auth/providers", { noWorkspace: true }),
    staleTime: 300_000,
  })
  const enabled = data?.google ?? false
  const href = `/api/v1/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ""}`
  const btn = (
    <Button variant="outline" className="h-10 w-full gap-2" asChild={enabled} disabled={!enabled}>
      {enabled ? (
        <a href={href}>
          <GoogleIcon /> {label}
        </a>
      ) : (
        <span>
          <GoogleIcon /> {label}
        </span>
      )}
    </Button>
  )
  if (enabled) return btn
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>{btn}</div>
      </TooltipTrigger>
      <TooltipContent>Google sign-in isn&apos;t configured on this server yet (set GOOGLE_CLIENT_ID / SECRET).</TooltipContent>
    </Tooltip>
  )
}

export function Divider({ label = "or" }: { label?: string }) {
  return (
    <div className="relative my-5 text-center text-xs text-muted-foreground">
      <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <span className="relative bg-card px-2 uppercase">{label}</span>
    </div>
  )
}
