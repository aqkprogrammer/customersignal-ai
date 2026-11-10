"use client"

import { AlertTriangle, Lock, Sparkles, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, errorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon = Sparkles,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-card/40 px-6 py-14 text-center", className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] text-primary shadow-[0_0_24px_-10px_var(--primary)]">
        <Icon className="size-5" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}

/** Renders the right state for an API error: plan restriction, permission denied, or a retryable error. */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  if (error instanceof ApiError && error.status === 402) {
    return (
      <EmptyState
        className={className}
        icon={Lock}
        title="Upgrade to unlock this"
        description={error.message}
        action={
          <Button asChild>
            <Link href="/app/billing">View plans</Link>
          </Button>
        }
      />
    )
  }
  if (error instanceof ApiError && error.status === 403) {
    return <EmptyState className={className} icon={Lock} title="You don't have access" description={error.message} />
  }
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-10 text-center", className)}>
      <AlertTriangle className="mb-3 size-6 text-destructive" />
      <p className="text-sm font-medium">Couldn&apos;t load this</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function CardSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("surface space-y-3 p-5", className)}>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="surface divide-y">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      title="Synthetic sample data — not real customer feedback"
      className={cn("inline-flex items-center rounded-[4px] border border-amber-600/30 bg-amber-100 px-1.5 py-0.5 font-mono text-[9.5px] font-medium tracking-[0.14em] text-amber-800 uppercase dark:border-[color-mix(in_oklab,var(--ember)_35%,transparent)] dark:bg-[color-mix(in_oklab,var(--ember)_10%,transparent)] dark:text-ember", className)}
    >
      Demo
    </span>
  )
}
