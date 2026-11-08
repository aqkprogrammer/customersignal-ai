"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Loader2, MailCheck } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Field } from "@/components/forms/auth-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, errorMessage } from "@/lib/api"

const schema = z.object({ email: z.string().trim().email("Enter a valid email address") })

export default function ForgotPasswordPage() {
  const [done, setDone] = useState<string | null>(null)
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "" } })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(v: z.infer<typeof schema>) {
    try {
      const res = await api<{ message: string }>("/auth/forgot-password", { method: "POST", body: v, noWorkspace: true })
      setDone(res.message)
    } catch (err) {
      form.setError("root", { message: errorMessage(err) })
    }
  }

  return (
    <div>
      <Link href="/login" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
      {done ? (
        <div>
          <MailCheck className="size-8 text-primary" />
          <h1 className="mt-4 text-2xl font-semibold">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">{done} The link expires in 1 hour.</p>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Reset your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your account email and we&apos;ll send you a reset link.</p>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            {errors.root && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
            <Field id="email" label="Email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" className="h-10" {...form.register("email")} />
            </Field>
            <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />} Send reset link
            </Button>
          </form>
        </>
      )}
    </div>
  )
}
