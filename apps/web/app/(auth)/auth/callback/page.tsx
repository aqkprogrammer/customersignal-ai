"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef } from "react"
import { api, setActiveWorkspaceId } from "@/lib/api"
import type { Session } from "@/types/api"

/** Landing page after the backend completes Google OAuth (session cookies are already set). */
function Callback() {
  const params = useSearchParams()
  const router = useRouter()
  const qc = useQueryClient()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const error = params.get("error")
    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`)
      return
    }
    const raw = params.get("next") || "/app"
    const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app"
    api<Session>("/auth/me", { noWorkspace: true })
      .then((s) => {
        qc.setQueryData(["session"], s)
        if (s.user.default_workspace_id) setActiveWorkspaceId(s.user.default_workspace_id)
        router.replace(s.user.onboarding_completed ? next : "/onboarding")
      })
      .catch(() => router.replace("/login?error=invalid_state"))
  }, [params, qc, router])

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin" /> Signing you in…
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  )
}
