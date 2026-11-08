"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BookOpen, LifeBuoy, Loader2, Mail, Plus, Send } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { PageHeader, Panel } from "@/components/dashboard/primitives"
import { StatusBadge } from "@/components/shared/badges"
import { CardSkeleton, EmptyState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { api, errorMessage } from "@/lib/api"
import { SITE } from "@/lib/site"
import { cn, timeAgo, titleCase } from "@/lib/utils"

interface Ticket { id: string; subject: string; status: string; priority: string; category: string; created_at: string; updated_at: string }
interface TicketDetail { id: string; subject: string; status: string; messages: { id: string; author_type: string; body: string; created_at: string }[] }

const GUIDES = [
  ["Preparing a review CSV", "One row per review with a text column; rating, date and reviewer are optional. Download the sample template from the upload dialog."],
  ["How severity is scored", "Severity (0–100) blends how often a theme appears, how recent the mentions are and how low the related ratings are."],
  ["Built-in engine vs. AI provider", "Without an AI key, a transparent keyword engine runs. Configure Anthropic or OpenAI for multilingual, deeper analysis."],
  ["Data sources & compliance", "Use uploads, official APIs and authorized providers. CustomerSignal AI never scrapes platforms or bypasses access controls."],
]

export default function SupportPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ subject: "", category: "general", priority: "normal", message: "" })
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [reply, setReply] = useState("")
  const tickets = useQuery({ queryKey: ["tickets"], queryFn: () => api<Ticket[]>("/support/tickets", { noWorkspace: true }) })
  const detail = useQuery({ queryKey: ["ticket", ticketId], queryFn: () => api<TicketDetail>(`/support/tickets/${ticketId}`, { noWorkspace: true }), enabled: !!ticketId })

  const create = useMutation({
    mutationFn: () => api("/support/tickets", { method: "POST", body: form }),
    onSuccess: () => { toast.success("Ticket submitted — we'll reply by email."); setOpen(false); setForm({ subject: "", category: "general", priority: "normal", message: "" }); qc.invalidateQueries({ queryKey: ["tickets"] }) },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const send = useMutation({
    mutationFn: () => api(`/support/tickets/${ticketId}/reply`, { method: "POST", body: { message: reply }, noWorkspace: true }),
    onSuccess: () => { setReply(""); qc.invalidateQueries({ queryKey: ["ticket", ticketId] }); qc.invalidateQueries({ queryKey: ["tickets"] }) },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <>
      <PageHeader title="Help & Support" description="Guides, and a direct line to our team." actions={<Button onClick={() => setOpen(true)}><Plus /> New ticket</Button>} />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Your tickets">
          {!tickets.data ? <CardSkeleton rows={3} /> : !tickets.data.length ? (
            <EmptyState icon={LifeBuoy} title="No support tickets" description="Questions, bugs or feature ideas — we read every ticket." action={<Button onClick={() => setOpen(true)}>Contact support</Button>} />
          ) : (
            <ul className="divide-y">
              {tickets.data.map((t) => (
                <li key={t.id}>
                  <button className="flex w-full items-center gap-3 py-3 text-left hover:bg-muted/40" onClick={() => setTicketId(t.id)}>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.subject}</p><p className="text-xs text-muted-foreground">{titleCase(t.category)} · updated {timeAgo(t.updated_at)}</p></div>
                    <StatusBadge status={t.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="space-y-4">
          <Panel title="Quick guides">
            <ul className="space-y-3">{GUIDES.map(([t, d]) => <li key={t}><p className="flex items-center gap-1.5 text-sm font-medium"><BookOpen className="size-3.5 text-primary" />{t}</p><p className="text-xs text-muted-foreground">{d}</p></li>)}</ul>
            <Link href="/blog" className="mt-4 inline-block text-sm text-primary hover:underline">Read the blog →</Link>
          </Panel>
          <Panel title="Email us"><a href={`mailto:${SITE.supportEmail}`} className="flex items-center gap-2 text-sm text-primary hover:underline"><Mail className="size-4" /> {SITE.supportEmail}</a></Panel>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New support ticket</DialogTitle><DialogDescription>Include steps to reproduce for bugs. Don&apos;t share passwords or API keys.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="t-sub">Subject</Label><Input id="t-sub" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{["general", "bug", "billing", "data_import", "feature_request", "account"].map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{["low", "normal", "high", "urgent"].map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="t-msg">Message</Label><Textarea id="t-msg" rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={form.subject.trim().length < 3 || form.message.trim().length < 5 || create.isPending}>{create.isPending && <Loader2 className="animate-spin" />} Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!ticketId} onOpenChange={(o) => !o && setTicketId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>{detail.data?.subject || "Ticket"}</SheetTitle><SheetDescription>{detail.data && <StatusBadge status={detail.data.status} />}</SheetDescription></SheetHeader>
          <div className="space-y-3 px-4 pb-8">
            {detail.data?.messages.map((m) => (
              <div key={m.id} className={cn("rounded-xl p-3 text-sm whitespace-pre-wrap", m.author_type === "admin" ? "bg-accent/60" : "border")}>
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">{m.author_type === "admin" ? "CustomerSignal support" : "You"} · {timeAgo(m.created_at)}</p>{m.body}
              </div>
            ))}
            {detail.data && detail.data.status !== "closed" && (
              <div className="space-y-2 pt-2">
                <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" aria-label="Reply" />
                <Button onClick={() => send.mutate()} disabled={!reply.trim() || send.isPending}><Send /> Send reply</Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
