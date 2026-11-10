"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Loader2, LockKeyhole, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ME_KEY } from "@/hooks/use-admin"
import { ApiError } from "@/lib/api"
import { adminApi, adminErrorMessage } from "@/lib/admin-api"
import type { LoginResponse } from "@/lib/admin-types"

export function AdminLogin() {
  const router = useRouter()
  const qc = useQueryClient()
  const [step, setStep] = useState<"credentials" | "mfa">("credentials")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (mfaCode?: string) => {
    setPending(true)
    setError(null)
    try {
      const res = await adminApi<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email: email.trim(), password, ...(mfaCode ? { mfa_code: mfaCode } : {}) },
      })
      if (res.status === "mfa_required") {
        setStep("mfa")
        setCode("")
        return
      }
      qc.setQueryData(ME_KEY, res.admin)
      toast.success(`Welcome back${res.admin.full_name ? `, ${res.admin.full_name.split(" ")[0]}` : ""}`)
      router.replace("/admin/dashboard")
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "invalid_mfa") {
          setError("That code didn't work. Check your authenticator app and try again.")
          setCode("")
        } else if (err.code === "invalid_credentials") {
          setError("Incorrect email or password.")
          setStep("credentials")
        } else if (err.code === "admin_locked") {
          setError("This account is temporarily locked after too many failed attempts. Try again in 15 minutes.")
          setStep("credentials")
        } else if (err.status === 429) {
          setError("Too many sign-in attempts. Please wait a few minutes and try again.")
        } else {
          setError(adminErrorMessage(err))
        }
      } else {
        setError(adminErrorMessage(err))
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(69,229,234,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(69,229,234,0.05)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="size-10" />
          <p className="mt-5 font-mono text-[10.5px] tracking-[0.16em] text-signal uppercase">Command centre · restricted</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Admin console</h1>
          <p className="mt-1 text-sm text-muted-foreground">All access is audit-logged.</p>
        </div>
        <div className="hud-corners rounded-lg border border-border-strong bg-card/70 p-6 surface-lit">
          {step === "credentials" ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!email.trim() || !password) {
                  setError("Enter your email and password.")
                  return
                }
                void submit()
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Email</Label>
                <Input id="admin-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" variant="signal" className="h-10 w-full" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
                Sign in
              </Button>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!/^\d{6}$/.test(code)) {
                  setError("Enter the 6-digit code from your authenticator app.")
                  return
                }
                void submit(code)
              }}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-signal/40 text-signal">
                  <ShieldCheck className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">Two-factor authentication</h2>
                  <p className="text-xs text-muted-foreground">Enter the 6-digit code for {email.trim()}.</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-mfa">Authentication code</Label>
                <Input
                  id="admin-mfa"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-11 text-center font-mono text-lg tracking-[0.5em]"
                  autoFocus
                />
              </div>
              {error && (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="h-9 w-full" disabled={pending || code.length !== 6}>
                {pending && <Loader2 className="animate-spin" />}
                Verify and sign in
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setStep("credentials")
                  setCode("")
                  setError(null)
                }}
              >
                <ArrowLeft /> Use a different account
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
