"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, Check, Loader2, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { AuthHeading, Divider, Field, GoogleButton, PasswordInput, TerminalPanel } from "@/components/forms/auth-fields"
import { StatusDot } from "@/components/signal"
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
  const [granted, setGranted] = useState(false)
  const oauthError = params.get("error")
  const form = useForm<Values>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "", remember: true } })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    setUnverified(null)
    try {
      const res = await api<Session & { status: string }>("/auth/login", { method: "POST", body: values, noWorkspace: true })
      qc.setQueryData(["session"], { user: res.user, workspaces: res.workspaces })
      if (res.user.default_workspace_id) setActiveWorkspaceId(res.user.default_workspace_id)
      setGranted(true)
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
  const status = granted ? "Access granted" : isSubmitting ? "Verifying" : banner ? "Access denied" : "Ready"
  const tone = granted ? "mint" : isSubmitting ? "signal" : banner ? "danger" : "signal"

  return (
    <div>
      <AuthHeading eyebrow="Sign in" title="Welcome back" description="Sign in to continue to your CustomerSignal workspace." />
      <TerminalPanel
        label="Workspace access"
        status={
          <span className="inline-flex items-center gap-1.5" aria-live="polite">
            <StatusDot tone={tone} pulse={isSubmitting} /> {status}
          </span>
        }
      >
        <GoogleButton next={next} />
        <Divider label="or with email" />
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <AnimatePresence initial={false}>
            {banner && (
              <motion.div
                key="banner"
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" /> {banner}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {unverified && (
            <div role="status" className="rounded-md border border-ember/35 bg-ember/10 px-3 py-2 text-sm text-ember">
              Please verify your email first.{" "}
              <button type="button" onClick={resend} className="font-medium underline">
                Resend verification link
              </button>
            </div>
          )}
          <Field rail id="email" label="Email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" className="h-10" placeholder="you@company.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...form.register("email")} />
          </Field>
          <Field
            rail
            id="password"
            label="Password"
            error={errors.password?.message}
            action={
              <Link href="/forgot-password" className="text-[12.5px] font-medium text-signal underline-offset-4 hover:underline">
                Forgot password?
              </Link>
            }
          >
            <PasswordInput id="password" autoComplete="current-password" placeholder="Your password" aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} {...form.register("password")} />
          </Field>
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-foreground/85">
            <Checkbox checked={form.watch("remember")} onCheckedChange={(v) => form.setValue("remember", v === true)} />
            Keep me signed in
          </label>
          <Button type="submit" variant="signal" className="h-11 w-full rounded-lg text-[15px]" disabled={isSubmitting || granted}>
            {granted ? (
              <>
                <Check /> Access granted
              </>
            ) : isSubmitting ? (
              <>
                <Loader2 className="animate-spin" /> Verifying
              </>
            ) : (
              <>
                Sign in <ArrowRight data-arrow />
              </>
            )}
          </Button>
        </form>
      </TerminalPanel>
      <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href={`/signup${params.get("plan") ? `?plan=${params.get("plan")}` : ""}`} className="font-medium text-signal underline-offset-4 hover:underline">
          Start free
        </Link>
      </p>
    </div>
  )
}
