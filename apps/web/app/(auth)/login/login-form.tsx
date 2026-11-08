"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Divider, Field, GoogleButton, PasswordInput } from "@/components/forms/auth-fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { api, ApiError, setActiveWorkspaceId } from "@/lib/api"
import type { Session } from "@/types/api"

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean(),
})
type Values = z.infer<typeof loginSchema>

const OAUTH_ERRORS: Record<string, string> = {
  access_denied: "Google sign-in was cancelled.",
  invalid_state: "Your sign-in session expired. Please try again.",
  google_email_unverified: "Your Google account email isn't verified.",
  registration_closed: "New registrations are currently closed.",
  token_exchange_failed: "Google sign-in failed. Please try again.",
}

function safeNext(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/app"
}

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const qc = useQueryClient()
  const next = safeNext(params.get("next"))
  const [unverified, setUnverified] = useState<string | null>(null)
  const oauthError = params.get("error")
  const form = useForm<Values>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "", remember: true } })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    setUnverified(null)
    try {
      const res = await api<Session & { status: string }>("/auth/login", { method: "POST", body: values, noWorkspace: true })
      qc.setQueryData(["session"], { user: res.user, workspaces: res.workspaces })
      if (res.user.default_workspace_id) setActiveWorkspaceId(res.user.default_workspace_id)
      router.replace(res.user.onboarding_completed ? next : "/onboarding")
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_not_verified") {
        setUnverified(values.email)
        return
      }
      form.setError("root", { message: err instanceof ApiError ? err.message : "Could not sign in. Try again." })
    }
  }

  async function resend() {
    if (!unverified) return
    await api("/auth/resend-verification", { method: "POST", body: { email: unverified }, noWorkspace: true }).catch(() => null)
    toast.success("Verification email sent. Check your inbox.")
  }

  const banner = errors.root?.message || (oauthError ? OAUTH_ERRORS[oauthError] || "Sign-in failed. Please try again." : null)

  return (
    <div>
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to continue to CustomerSignal AI.</p>
      <div className="mt-7">
        <GoogleButton next={next} />
      </div>
      <Divider />
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {banner && (
          <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {banner}
          </div>
        )}
        {unverified && (
          <div role="status" className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            Please verify your email first.{" "}
            <button type="button" onClick={resend} className="font-medium underline">
              Resend verification link
            </button>
          </div>
        )}
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" className="h-10" placeholder="you@company.com"
            aria-invalid={!!errors.email} {...form.register("email")} />
        </Field>
        <Field id="password" label="Password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...form.register("password")} />
        </Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={form.watch("remember")} onCheckedChange={(v) => form.setValue("remember", v === true)} />
            Remember me
          </label>
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />} Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href={`/signup${params.get("plan") ? `?plan=${params.get("plan")}` : ""}`} className="font-medium text-primary hover:underline">
          Start free
        </Link>
      </p>
    </div>
  )
}
