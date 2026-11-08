"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, MailCheck } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Divider, Field, GoogleButton, PasswordInput } from "@/components/forms/auth-fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { api, ApiError, setActiveWorkspaceId } from "@/lib/api"
import { signupSchema, type SignupValues } from "@/lib/validation"
import type { Session } from "@/types/api"

export function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const qc = useQueryClient()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { full_name: "", email: "", password: "", confirm_password: "", company_name: "", accept_terms: false },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(v: SignupValues) {
    try {
      const res = await api<{ status: string; email?: string } & Partial<Session>>("/auth/signup", {
        method: "POST",
        noWorkspace: true,
        body: { full_name: v.full_name, email: v.email, password: v.password, company_name: v.company_name || null, accept_terms: v.accept_terms },
      })
      if (res.status === "verification_required") {
        setSentTo(res.email || v.email)
        return
      }
      if (res.user && res.workspaces) {
        qc.setQueryData(["session"], { user: res.user, workspaces: res.workspaces })
        if (res.user.default_workspace_id) setActiveWorkspaceId(res.user.default_workspace_id)
      }
      router.replace("/onboarding")
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_taken") form.setError("email", { message: err.message })
      else if (err instanceof ApiError && err.code === "validation_error" && Array.isArray(err.details)) {
        let mapped = false
        for (const d of err.details as { field: string; message: string }[]) {
          if (d.field in form.getValues()) {
            form.setError(d.field as keyof SignupValues, { message: d.message.replace(/^value is not a valid email address: /, "") })
            mapped = true
          }
        }
        if (!mapped) form.setError("root", { message: err.message })
      } else form.setError("root", { message: err instanceof ApiError ? err.message : "Could not create your account." })
    }
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
          <MailCheck className="size-6" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a verification link to <span className="font-medium text-foreground">{sentTo}</span>. Click it to activate your account.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={async () => {
            await api("/auth/resend-verification", { method: "POST", body: { email: sentTo }, noWorkspace: true }).catch(() => null)
            toast.success("We've sent another link.")
          }}
        >
          Resend email
        </Button>
        <p className="mt-6 text-sm text-muted-foreground">
          Already verified?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    )
  }

  const plan = params.get("plan")
  return (
    <div>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Start free — no credit card required.{plan && plan !== "free" ? ` You can upgrade to ${plan} from Billing after signup.` : ""}
      </p>
      <div className="mt-6">
        <GoogleButton label="Sign up with Google" next="/onboarding" />
      </div>
      <Divider />
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
        {errors.root && (
          <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errors.root.message}
          </div>
        )}
        <Field id="full_name" label="Full name" error={errors.full_name?.message}>
          <Input id="full_name" autoComplete="name" className="h-10" aria-invalid={!!errors.full_name} {...form.register("full_name")} />
        </Field>
        <Field id="email" label="Work email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" className="h-10" placeholder="you@company.com" aria-invalid={!!errors.email} {...form.register("email")} />
        </Field>
        <Field id="company_name" label={<>Company <span className="text-muted-foreground">(optional)</span></>} error={errors.company_name?.message}>
          <Input id="company_name" autoComplete="organization" className="h-10" {...form.register("company_name")} />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field id="password" label="Password" error={errors.password?.message}>
            <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
          </Field>
          <Field id="confirm_password" label="Confirm password" error={errors.confirm_password?.message}>
            <PasswordInput id="confirm_password" autoComplete="new-password" aria-invalid={!!errors.confirm_password} {...form.register("confirm_password")} />
          </Field>
        </div>
        <div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={form.watch("accept_terms")}
              onCheckedChange={(v) => form.setValue("accept_terms", v === true, { shouldValidate: true })} />
            <span className="text-muted-foreground">
              I agree to the <Link href="/terms" className="text-primary hover:underline">Terms</Link> and{" "}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </span>
          </label>
          {errors.accept_terms && <p role="alert" className="mt-1 text-xs text-destructive">{errors.accept_terms.message}</p>}
        </div>
        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />} Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </div>
  )
}
