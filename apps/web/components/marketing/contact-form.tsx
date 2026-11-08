"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CircleCheck, LoaderCircle, Send } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api, errorMessage } from "@/lib/api"

export const CONTACT_TOPICS = [
  { value: "sales", label: "Sales & pricing" },
  { value: "demo", label: "Book a demo" },
  { value: "enterprise", label: "Enterprise plan" },
  { value: "support", label: "Product support" },
  { value: "partnership", label: "Partnerships & agencies" },
] as const

type Topic = (typeof CONTACT_TOPICS)[number]["value"]
const TOPIC_VALUES = CONTACT_TOPICS.map((t) => t.value) as [Topic, ...Topic[]]

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(200, "Name is too long."),
  email: z.string().trim().min(1, "Please enter your email.").email("Please enter a valid email address.").max(254),
  company: z.string().trim().max(200, "Company name is too long.").optional(),
  topic: z.enum(TOPIC_VALUES, { message: "Please choose a topic." }),
  message: z
    .string()
    .trim()
    .min(10, "Please write at least 10 characters so we can help.")
    .max(5000, "Message is too long (5,000 characters max)."),
})

type FormValues = z.infer<typeof schema>

function isTopic(v: string | null): v is Topic {
  return !!v && (TOPIC_VALUES as string[]).includes(v)
}

/** Must be rendered inside <Suspense> (uses useSearchParams). */
export function ContactForm() {
  const params = useSearchParams()
  const initialTopic = params.get("topic")
  const [success, setSuccess] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", company: "", topic: isTopic(initialTopic) ? initialTopic : "sales", message: "" },
  })

  async function onSubmit(values: FormValues) {
    try {
      const res = await api<{ message: string }>("/public/contact", {
        method: "POST",
        noWorkspace: true,
        noRefresh: true,
        body: { ...values, company: values.company ? values.company : undefined },
      })
      setSuccess(res?.message || "Thanks — we'll be in touch shortly.")
      reset()
    } catch (err) {
      toast.error("Couldn't send your message", { description: errorMessage(err) })
    }
  }

  if (success) {
    return (
      <div role="status" className="flex flex-col items-center rounded-2xl border bg-card px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
          <CircleCheck aria-hidden className="size-6" />
        </span>
        <h2 className="mt-5 text-xl font-semibold">Message sent</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{success}</p>
        <Button variant="outline" className="mt-6 h-10 rounded-lg px-4" onClick={() => setSuccess(null)}>
          Send another message
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8" aria-label="Contact form">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="contact-name" label="Full name" error={errors.name?.message}>
          <Input id="contact-name" autoComplete="name" className="h-10" aria-invalid={!!errors.name} aria-describedby={errors.name ? "contact-name-error" : undefined} {...register("name")} />
        </Field>
        <Field id="contact-email" label="Work email" error={errors.email?.message}>
          <Input id="contact-email" type="email" autoComplete="email" className="h-10" aria-invalid={!!errors.email} aria-describedby={errors.email ? "contact-email-error" : undefined} {...register("email")} />
        </Field>
        <Field id="contact-company" label="Company" optional error={errors.company?.message}>
          <Input id="contact-company" autoComplete="organization" className="h-10" aria-invalid={!!errors.company} aria-describedby={errors.company ? "contact-company-error" : undefined} {...register("company")} />
        </Field>
        <Field id="contact-topic" label="Topic" error={errors.topic?.message}>
          <Controller
            control={control}
            name="topic"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="contact-topic" className="h-10 w-full" aria-invalid={!!errors.topic} onBlur={field.onBlur}>
                  <SelectValue placeholder="Choose a topic" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TOPICS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field id="contact-message" label="How can we help?" error={errors.message?.message}>
            <Textarea
              id="contact-message"
              rows={6}
              placeholder="Tell us about your business, review volume and what you'd like to achieve."
              aria-invalid={!!errors.message}
              aria-describedby={errors.message ? "contact-message-error" : undefined}
              {...register("message")}
            />
          </Field>
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          By sending this form you agree to our{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
          . We reply within one business day.
        </p>
        <Button type="submit" disabled={isSubmitting} className="h-11 rounded-xl px-6">
          {isSubmitting ? (
            <>
              <LoaderCircle aria-hidden className="size-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              Send message <Send aria-hidden className="size-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  optional,
  error,
  children,
}: {
  id: string
  label: string
  optional?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function ContactFormSkeleton() {
  return <div aria-hidden className="h-[34rem] animate-pulse rounded-2xl border bg-card" />
}
