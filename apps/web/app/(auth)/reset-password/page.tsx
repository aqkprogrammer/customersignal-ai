"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Loader2 } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { Field, PasswordInput } from "@/components/forms/auth-fields"
import { Button } from "@/components/ui/button"
import { api, errorMessage } from "@/lib/api"
import { resetSchema } from "@/lib/validation"

function ResetForm() {
  const token = useSearchParams().get("token")
  const [done, setDone] = useState(false)
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } })
  const { errors, isSubmitting } = form.formState

  if (!token)
    return (
      <div>
        <h1 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.04em]">Invalid link</h1>
        <p className="mt-2 text-sm text-muted-foreground">This reset link is missing its token.</p>
        <Button asChild className="mt-6"><Link href="/forgot-password">Request a new link</Link></Button>
      </div>
    )
  if (done)
    return (
      <div>
        <CheckCircle2 className="size-8 text-emerald-600" />
        <h1 className="mt-4 text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.04em]">Password updated</h1>
        <p className="mt-2 text-sm text-muted-foreground">All other sessions were signed out for your security.</p>
        <Button asChild className="mt-6"><Link href="/login">Sign in</Link></Button>
      </div>
    )
  return (
    <div>
      <h1 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.04em]">Choose a new password</h1>
      <form
        className="mt-6 space-y-4"
        noValidate
        onSubmit={form.handleSubmit(async (v) => {
          try {
            await api("/auth/reset-password", { method: "POST", body: { token, password: v.password }, noWorkspace: true })
            setDone(true)
          } catch (err) {
            form.setError("root", { message: errorMessage(err) })
          }
        })}
      >
        {errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message} <Link href="/forgot-password" className="underline">Request a new link</Link>
          </p>
        )}
        <Field rail id="password" label="New password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" {...form.register("password")} />
        </Field>
        <Field rail id="confirm" label="Confirm password" error={errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" {...form.register("confirm")} />
        </Field>
        <Button type="submit" variant="signal" className="h-11 w-full rounded-lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />} Update password
        </Button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  )
}
