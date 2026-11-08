"use client"

import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { api, errorMessage, setActiveWorkspaceId } from "@/lib/api"
import type { Session } from "@/types/api"

function Verify() {
  const token = useSearchParams().get("token")
  const router = useRouter()
  const qc = useQueryClient()
  const started = useRef(false)
  const [state, setState] = useState<{ status: "loading" | "ok" | "error"; message?: string }>({ status: "loading" })

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!token) return
    api<Session>("/auth/verify-email", { method: "POST", body: { token }, noWorkspace: true })
      .then((res) => {
        qc.setQueryData(["session"], { user: res.user, workspaces: res.workspaces })
        if (res.user.default_workspace_id) setActiveWorkspaceId(res.user.default_workspace_id)
        setState({ status: "ok" })
        setTimeout(() => router.replace(res.user.onboarding_completed ? "/app" : "/onboarding"), 1200)
      })
      .catch((err) => setState({ status: "error", message: errorMessage(err) }))
  }, [token, qc, router])

  if (!token) return <VerifyError message="This verification link is missing its token." />
  if (state.status === "loading")
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Verifying your email…
      </div>
    )
  if (state.status === "ok")
    return (
      <div>
        <CheckCircle2 className="size-8 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-semibold">Email verified</h1>
        <p className="mt-2 text-sm text-muted-foreground">Taking you to your workspace…</p>
      </div>
    )
  return <VerifyError message={state.message} />
}

function VerifyError({ message }: { message?: string }) {
  return (
    <div>
      <XCircle className="size-8 text-destructive" />
      <h1 className="mt-4 text-2xl font-semibold">We couldn&apos;t verify your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button asChild className="mt-6"><Link href="/login">Back to sign in</Link></Button>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  )
}
