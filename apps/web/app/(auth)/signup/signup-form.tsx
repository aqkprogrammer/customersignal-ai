"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowLeft, ArrowRight, Check, Loader2, MailCheck, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { AuthHeading, Divider, Field, GoogleButton, PasswordInput, TerminalPanel } from "@/components/forms/auth-fields"
import { StatusDot } from "@/components/aurora"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { api, ApiError, setActiveWorkspaceId } from "@/lib/api"
import { cn } from "@/lib/utils"
import { signupSchema, type SignupValues } from "@/lib/validation"
import type { Session } from "@/types/api"

const SECTIONS = [
  { code: "01", short: "Identity", title: "Account identity", fields: ["full_name", "email", "password", "confirm_password"] as const },
  { code: "02", short: "Business", title: "Business profile", fields: ["company_name"] as const },
  { code: "03", short: "Workspace", title: "Workspace configuration", fields: ["accept_terms"] as const },
]

function strength(pw: string) {
  if (!pw) return -1
  let s = 0
  if (pw.length >= 10) s++
  if (pw.length >= 14) s++
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) s++
  return Math.min(s, 4) - (pw.length < 10 ? 1 : 0)
}
const STRENGTH = [
  { label: "Too short", tone: "bg-destructive", text: "text-destructive" },
  { label: "Weak", tone: "bg-destructive", text: "text-destructive" },
  { label: "Fair", tone: "bg-ember", text: "text-ember" },
  { label: "Good", tone: "bg-ice", text: "text-ice" },
  { label: "Strong", tone: "bg-mint", text: "text-mint" },
]

function StrengthMeter({ value }: { value: string }) {
  const score = strength(value)
  const s = STRENGTH[Math.max(0, score)]
  return (
    <div className="flex items-center gap-3 pt-1" aria-live="polite">
      <span className="font-mono text-[9.5px] tracking-[0.14em] text-subtle-foreground uppercase">Strength</span>
      <div className="flex flex-1 gap-[3px]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-[3px] flex-1 rounded-[1px] bg-border-strong transition-colors duration-300", score > i && s.tone)} />
        ))}
      </div>
      <span className={cn("w-16 text-right font-mono text-[10px] tracking-[0.1em] uppercase", score >= 0 ? s.text : "text-subtle-foreground")}>{score >= 0 ? s.label : ""}</span>
    </div>
  )
}

function Progress({ current, onJump }: { current: number; onJump: (i: number) => void }) {
  const reduce = useReducedMotion()
  return (
    <nav aria-label="Sign-up progress" className="mb-7">
      <ol className="grid grid-cols-3 gap-2">
        {SECTIONS.map((sec, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={sec.code}>
              <button
                type="button"
                disabled={!done}
                onClick={() => onJump(i)}
                aria-current={active ? "step" : undefined}
                aria-label={`${sec.code} ${sec.title}${done ? " — completed, go back" : ""}`}
                className={cn("group w-full rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none", done && "cursor-pointer")}
              >
                <span className="relative block h-[3px] overflow-hidden rounded-[1px] bg-border-strong">
                  <motion.span
                    className="absolute inset-0 origin-left bg-signal shadow-[0_0_8px_var(--signal)]"
                    initial={false}
                    animate={{ scaleX: done || active ? 1 : 0, opacity: done ? 0.55 : 1 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
                <span
                  className={cn(
                    "mt-2.5 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors",
                    active ? "text-signal" : done ? "text-foreground/80 group-hover:text-signal" : "text-subtle-foreground",
                  )}
                >
                  {done ? <Check className="size-3" strokeWidth={3} /> : <span className="tabular">{sec.code}</span>}
                  <span className="truncate">{sec.short}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const qc = useQueryClient()
  const reduce = useReducedMotion()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [section, setSection] = useState(0)
  const [dir, setDir] = useState(1)
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: "onTouched",
    defaultValues: { full_name: "", email: "", password: "", confirm_password: "", company_name: "", accept_terms: false },
  })
  const { errors, isSubmitting } = form.formState
  const plan = params.get("plan")

  const go = (i: number) => {
    setDir(i > section ? 1 : -1)
    setSection(i)
  }
  const advance = async () => {
    const ok = await form.trigger([...SECTIONS[section].fields], { shouldFocus: true })
    if (ok) go(Math.min(section + 1, SECTIONS.length - 1))
  }

  useEffect(() => {
    const first = SECTIONS[section].fields[0]
    if (first === "accept_terms") return
    const t = setTimeout(() => form.setFocus(first), 260)
    return () => clearTimeout(t)
  }, [section, form])

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
      if (err instanceof ApiError && err.code === "email_taken") {
        form.setError("email", { message: err.message })
        go(0)
      } else if (err instanceof ApiError && err.code === "validation_error" && Array.isArray(err.details)) {
        let mapped = false
        let jump = -1
        for (const d of err.details as { field: string; message: string }[]) {
          if (d.field in form.getValues()) {
            form.setError(d.field as keyof SignupValues, { message: d.message.replace(/^value is not a valid email address: /, "") })
            mapped = true
            const idx = SECTIONS.findIndex((s) => (s.fields as readonly string[]).includes(d.field))
            if (idx >= 0 && (jump < 0 || idx < jump)) jump = idx
          }
        }
        if (jump >= 0) go(jump)
        if (!mapped) form.setError("root", { message: err.message })
      } else form.setError("root", { message: err instanceof ApiError ? err.message : "Could not create your account." })
    }
  }

  // Final validation found an error in an earlier section → jump back to it.
  const onInvalid = (errs: Partial<Record<keyof SignupValues, unknown>>) => {
    const idx = SECTIONS.findIndex((s) => s.fields.some((f) => f in errs))
    if (idx >= 0 && idx !== section) go(idx)
  }
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    if (section < SECTIONS.length - 1) {
      e.preventDefault()
      void advance()
      return
    }
    void form.handleSubmit(onSubmit, onInvalid)(e)
  }

  if (sentTo) {
    return (
      <div>
        <AuthHeading eyebrow="Workspace created" title="Check your inbox" />
        <TerminalPanel
          label="Verification"
          status={
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone="orange" pulse /> Awaiting confirmation
            </span>
          }
        >
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-signal/40 text-signal">
              <MailCheck className="size-5" />
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We sent a verification link to <span className="font-medium text-foreground">{sentTo}</span>. Click it to activate your account.
            </p>
          </div>
          <Button
            variant="outline"
            className="mt-6 h-10 w-full"
            onClick={async () => {
              await api("/auth/resend-verification", { method: "POST", body: { email: sentTo }, noWorkspace: true }).catch(() => null)
              toast.success("We've sent another link.")
            }}
          >
            Resend email
          </Button>
        </TerminalPanel>
        <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          Already verified?{" "}
          <Link href="/login" className="font-medium text-signal underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    )
  }

  const workspaceName = form.watch("company_name")?.trim() || (form.watch("full_name")?.trim() ? `${form.watch("full_name").trim().split(" ")[0]}’s workspace` : "Your workspace")
  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 18 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -18 }),
  }

  return (
    <div>
      <AuthHeading
        eyebrow="New workspace · free plan"
        title="Create your account"
        description={<>Start free — no credit card required.{plan && plan !== "free" ? ` You can upgrade to ${plan} from Billing after signup.` : ""}</>}
      />
      <AnimatePresence initial={false}>
        {section === 0 && (
          <motion.div key="google" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <GoogleButton label="Sign up with Google" next="/onboarding" />
            <Divider label="or with email" />
          </motion.div>
        )}
      </AnimatePresence>

      <Progress current={section} onJump={go} />

      <form onSubmit={submit} noValidate>
        {errors.root && (
          <p role="alert" className="mb-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" /> {errors.root.message}
          </p>
        )}

        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.fieldset
            key={section}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            <legend className="mb-5 flex w-full items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] text-subtle-foreground uppercase">
              <span className="text-signal">{SECTIONS[section].code}</span> — {SECTIONS[section].title}
              <span className="h-px flex-1 bg-border" />
            </legend>

            {section === 0 && (
              <>
                <Field rail id="full_name" label="Full name" error={errors.full_name?.message}>
                  <Input id="full_name" autoComplete="name" className="h-10" placeholder="Layla Haddad" aria-invalid={!!errors.full_name} {...form.register("full_name")} />
                </Field>
                <Field rail id="email" label="Work email" error={errors.email?.message}>
                  <Input id="email" type="email" autoComplete="email" className="h-10" placeholder="you@company.com" aria-invalid={!!errors.email} {...form.register("email")} />
                </Field>
                <Field rail id="password" label="Password" error={errors.password?.message} hint="At least 10 characters, with letters and numbers.">
                  <PasswordInput id="password" autoComplete="new-password" placeholder="Create a password" aria-invalid={!!errors.password} {...form.register("password")} />
                  <StrengthMeter value={form.watch("password")} />
                </Field>
                <Field rail id="confirm_password" label="Confirm password" error={errors.confirm_password?.message}>
                  <PasswordInput id="confirm_password" autoComplete="new-password" placeholder="Repeat your password" aria-invalid={!!errors.confirm_password} {...form.register("confirm_password")} />
                </Field>
              </>
            )}

            {section === 1 && (
              <>
                <Field
                  rail
                  id="company_name"
                  label={
                    <>
                      Company <span className="font-normal text-muted-foreground">(optional)</span>
                    </>
                  }
                  error={errors.company_name?.message}
                  hint="Used to name your workspace. You’ll add your industry, locations and competitors during onboarding."
                >
                  <Input id="company_name" autoComplete="organization" className="h-10" placeholder="Marina Kitchen Group" {...form.register("company_name")} />
                </Field>
                <div className="rounded-md border border-border bg-background-subtle/60 px-4 py-3">
                  <p className="micro-label">Workspace preview</p>
                  <p className="mt-1.5 flex items-center gap-2 text-[15px] font-medium">
                    <span className="flex size-6 items-center justify-center rounded-[5px] border border-signal/40 font-mono text-[11px] text-signal">{workspaceName.charAt(0).toUpperCase()}</span>
                    {workspaceName}
                  </p>
                </div>
              </>
            )}

            {section === 2 && (
              <>
                <dl className="overflow-hidden rounded-md border border-border bg-background-subtle/60">
                  {[
                    { k: "Account", v: form.watch("email") || "—" },
                    { k: "Workspace", v: workspaceName },
                    { k: "Plan", v: plan && plan !== "free" ? `Free now · upgrade to ${plan} in Billing` : "Free plan", accent: true },
                    { k: "Data", v: "Uploads and official APIs only" },
                  ].map((r, i) => (
                    <div key={r.k} className={cn("grid grid-cols-[92px_1fr] items-baseline gap-3 px-4 py-2.5", i > 0 && "border-t border-border")}>
                      <dt className="micro-label">{r.k}</dt>
                      <dd className={cn("truncate font-mono text-[12px]", r.accent ? "text-signal" : "text-foreground/85")}>{r.v}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed">
                    <Checkbox
                      className="mt-0.5"
                      checked={form.watch("accept_terms")}
                      aria-invalid={!!errors.accept_terms}
                      onCheckedChange={(v) => form.setValue("accept_terms", v === true, { shouldValidate: true })}
                    />
                    <span className="text-muted-foreground">
                      I agree to the{" "}
                      <Link href="/terms" target="_blank" className="text-signal hover:underline">
                        Terms
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" target="_blank" className="text-signal hover:underline">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                  <AnimatePresence>
                    {errors.accept_terms && (
                      <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-1.5 overflow-hidden text-xs font-medium text-destructive">
                        {errors.accept_terms.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </motion.fieldset>
        </AnimatePresence>

        <div className="mt-7 flex items-center gap-3">
          {section > 0 && (
            <Button type="button" variant="ghost" className="h-12 rounded-full px-5" onClick={() => go(section - 1)}>
              <ArrowLeft /> Back
            </Button>
          )}
          {section < SECTIONS.length - 1 ? (
            <Button type="submit" className="h-12 flex-1 rounded-full text-[15.5px]">
              Continue <ArrowRight data-arrow />
            </Button>
          ) : (
            <Button type="submit" variant="signal" className="h-12 flex-1 rounded-full text-[15.5px]" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" /> Creating workspace
                </>
              ) : (
                <>
                  Create account <ArrowRight data-arrow />
                </>
              )}
            </Button>
          )}
        </div>
      </form>
      <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-signal underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
