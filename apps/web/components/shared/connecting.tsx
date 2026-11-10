"use client"

import { RefreshCw } from "lucide-react"
import Link from "next/link"
import { LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/api"

/**
 * Shown while the signed-in session is being loaded. Instead of spinning forever it explains a slow start
 * (the API sleeps when idle on the free tier and needs up to a minute to wake), and offers retry / sign in
 * again once retries are exhausted.
 */
export function ConnectingScreen({
  error,
  attempts = 0,
  onRetry,
  loginHref = "/login",
}: {
  error?: unknown
  attempts?: number
  onRetry?: () => void
  loginHref?: string
}) {
  const waking = !error && attempts > 0
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center" role="status" aria-live="polite">
      <LogoMark className={error ? "size-9" : "size-9 animate-pulse"} />
      <div className="max-w-sm">
        <p className="font-mono text-[10.5px] tracking-[0.16em] text-signal uppercase">
          {error ? "Connection failed" : waking ? "Waking up the server" : "Connecting"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error
            ? `We couldn't reach CustomerSignal (${errorMessage(error)}). Your data is safe — try again in a moment.`
            : waking
              ? "The service was idle and is starting up. This can take up to a minute — we'll keep trying."
              : "Loading your workspace…"}
        </p>
      </div>
      {error ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <Button onClick={onRetry}>
              <RefreshCw /> Try again
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={loginHref}>Sign in again</Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
