"use client"

import { Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "../ui"

/** Seeded plan codes (apps/api/app/services/plans.py). Plans can be edited but not created, so codes are stable. */
export const PLAN_CODES = ["free", "starter", "pro", "business", "enterprise"] as const
export const PLAN_OPTIONS = PLAN_CODES.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))

export const SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due", "canceled"] as const

export type NotifyValues = { title: string; body: string; send_email: boolean }

/** Compose an in-app notification (+ optional email) for one user. */
export function NotifyDialog({
  open,
  onOpenChange,
  recipient,
  onSend,
  pending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  recipient: string
  onSend: (v: NotifyValues) => Promise<unknown>
  pending?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <NotifyForm recipient={recipient} pending={pending} onCancel={() => onOpenChange(false)} onSend={async (v) => {
          try {
            await onSend(v)
            onOpenChange(false)
          } catch {
            /* toast shown by mutation */
          }
        }} />}
      </DialogContent>
    </Dialog>
  )
}

function NotifyForm({ recipient, pending, onCancel, onSend }: { recipient: string; pending?: boolean; onCancel: () => void; onSend: (v: NotifyValues) => void }) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [email, setEmail] = useState(false)
  const ok = title.trim().length >= 2
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (ok) onSend({ title: title.trim(), body: body.trim(), send_email: email })
      }}
    >
      <DialogHeader>
        <DialogTitle>Send notification</DialogTitle>
        <DialogDescription>To {recipient}. Appears in their in-app notification center.</DialogDescription>
      </DialogHeader>
      <Field label="Title" htmlFor="n-title" hint="2–300 characters">
        <Input id="n-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} autoFocus />
      </Field>
      <Field label="Message" htmlFor="n-body">
        <Textarea id="n-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={5000} />
      </Field>
      <div className="flex items-center gap-2">
        <Checkbox id="n-email" checked={email} onCheckedChange={(v) => setEmail(v === true)} />
        <Label htmlFor="n-email" className="text-sm font-normal">Also send as email</Label>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={!ok || pending}>
          {pending && <Loader2 className="animate-spin" />}
          Send
        </Button>
      </DialogFooter>
    </form>
  )
}
