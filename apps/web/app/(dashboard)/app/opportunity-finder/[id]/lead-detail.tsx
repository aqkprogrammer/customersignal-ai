"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileText,
  Globe,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog, JobProgress, PageHeader, Panel, useJob } from "@/components/dashboard/primitives"
import { UploadDialog } from "@/components/dashboard/review-dialogs"
import { SeverityMeter, Stars, StatusBadge, TrendBadge } from "@/components/shared/badges"
import { CardSkeleton, DemoBadge, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/hooks/use-session"
import { api, download, errorMessage } from "@/lib/api"
import { categoryLabel } from "@/lib/site"
import { formatDate, timeAgo, titleCase } from "@/lib/utils"
import type { Job, Lead, Report } from "@/types/api"

const PIPELINE = ["new", "researched", "contacted", "replied", "meeting_booked", "converted", "not_interested"]
type PitchField = "cold_email_subject" | "cold_email" | "linkedin_message" | "follow_up_email" | "executive_summary"

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button variant="outline" size="sm" onClick={async () => {
      await navigator.clipboard.writeText(text)
      setDone(true); setTimeout(() => setDone(false), 1500)
    }}>
      {done ? <Check /> : <Copy />} {done ? "Copied" : "Copy"}
    </Button>
  )
}

export function LeadPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const { can } = useWorkspace()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [reportJob, setReportJob] = useState<{ job: string; report: string } | null>(null)
  const [draft, setDraft] = useState<Partial<Record<PitchField, string>>>({})
  const [contact, setContact] = useState({ contact_name: "", contact_email: "", contact_linkedin: "" })
  const [note, setNote] = useState("")
  const [del, setDel] = useState(false)

  const lead = useQuery({ queryKey: ["lead", id], queryFn: () => api<Lead>(`/leads/${id}`) })
  const job = useJob(jobId, { invalidate: [["lead", id], ["leads"]], onDone: (j) => j.status === "completed" && toast.success("Outreach pack ready") })
  const rJob = useJob(reportJob?.job, { invalidate: [["lead", id]], onDone: (j) => j.status === "completed" && toast.success("PDF report ready") })

  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  if (lead.data && lead.data.updated_at !== syncedAt) {
    const l = lead.data
    setSyncedAt(l.updated_at)
    setDraft({ cold_email_subject: l.cold_email_subject || "", cold_email: l.cold_email || "", linkedin_message: l.linkedin_message || "",
      follow_up_email: l.follow_up_email || "", executive_summary: l.executive_summary || "" })
    setContact({ contact_name: l.contact_name || "", contact_email: l.contact_email || "", contact_linkedin: l.contact_linkedin || "" })
  }

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Lead>(`/leads/${id}`, { method: "PATCH", body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead", id] }); qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Saved") },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const generate = useMutation({
    mutationFn: () => api<Job>(`/leads/${id}/generate`, { method: "POST" }),
    onSuccess: (j) => setJobId(j.id),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const makeReport = useMutation({
    mutationFn: () => api<{ report: Report; job: Job }>(`/leads/${id}/report`, { method: "POST" }),
    onSuccess: (r) => setReportJob({ job: r.job.id, report: r.report.id }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const addNote = useMutation({
    mutationFn: () => api(`/leads/${id}/notes`, { method: "POST", body: { message: note } }),
    onSuccess: () => { setNote(""); qc.invalidateQueries({ queryKey: ["lead", id] }) },
  })
  const hubspot = useMutation({
    mutationFn: () => api(`/leads/${id}/sync/hubspot`, { method: "POST" }),
    onSuccess: () => toast.success("Synced to HubSpot"),
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (lead.error) return <ErrorState error={lead.error} onRetry={() => lead.refetch()} />
  if (!lead.data) return <CardSkeleton rows={8} />
  const l = lead.data
  const primary = l.businesses?.find((b) => b.is_primary)
  const running = job.data && (job.data.status === "pending" || job.data.status === "processing")
  const reportId = reportJob?.report || l.report_id

  return (
    <>
      <PageHeader
        title={l.business_name}
        description={[l.industry, [l.city, l.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        badge={<>{l.is_demo && <DemoBadge />}<StatusBadge status={l.status} /></>}
        actions={can("analyst") && (
          <>
            <Select value={l.status} onValueChange={(s) => patch.mutate({ status: s })}>
              <SelectTrigger className="w-[170px]" aria-label="Lead status"><SelectValue /></SelectTrigger>
              <SelectContent>{PIPELINE.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setUploadOpen(true)}><Upload /> Upload reviews</Button>
            <Button onClick={() => generate.mutate()} disabled={generate.isPending || !!running || !l.review_count}>
              {l.pitch_status === "ready" ? <RefreshCw /> : <Sparkles />} {l.pitch_status === "ready" ? "Regenerate" : "Analyze & generate pitch"}
            </Button>
          </>
        )}
      />
      {jobId && <JobProgress job={job.data} className="mb-4" />}

      {!l.review_count ? (
        <EmptyState icon={Upload} title={`Add ${l.business_name}'s review data`}
          description="Upload a CSV/Excel export of reviews you're authorized to use (e.g. from an approved data provider). The pitch is generated strictly from this evidence."
          action={can("analyst") && <Button onClick={() => setUploadOpen(true)}><Upload /> Upload review CSV</Button>} />
      ) : l.pitch_status !== "ready" ? (
        <EmptyState icon={Sparkles} title={l.pitch_status === "generating" || running ? "Generating…" : l.pitch_status === "failed" ? "Generation failed" : "Ready to analyze"}
          description={`${l.review_count} reviews loaded. CustomerSignal AI will group recurring complaints, rank them by frequency, recency and rating, and draft a report and outreach.`}
          action={can("analyst") && !running && <Button onClick={() => generate.mutate()} disabled={generate.isPending}><Sparkles /> Analyze & generate pitch</Button>} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <Panel title="Executive summary" actions={<span className="text-xs text-muted-foreground">{l.review_count} reviews analyzed</span>}>
              <Textarea rows={4} value={draft.executive_summary} onChange={(e) => setDraft({ ...draft, executive_summary: e.target.value })} disabled={!can("analyst")} />
            </Panel>

            <Panel title="Ranked issues" description="Severity combines frequency, recency and ratings. Evidence shows actual review excerpts with source references.">
              {!l.issues?.length ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="size-4" /> No recurring issues were found in this dataset — there&apos;s nothing to pitch on.</p>
              ) : (
                <ol className="space-y-4">
                  {l.issues.map((issue, i) => (
                    <li key={issue.key} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
                        <p className="flex-1 font-medium">{issue.title}</p>
                        <TrendBadge trend={issue.trend} />
                        <SeverityMeter value={issue.severity} />
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">{issue.why_it_matters}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{categoryLabel(issue.category)} · {issue.count} reviews{issue.avg_rating ? ` · ${issue.avg_rating}★ avg` : ""}</p>
                      <ul className="mt-3 space-y-2">
                        {issue.evidence.map((e) => (
                          <li key={e.review_id} className="border-l-2 border-primary/40 pl-3 text-sm">
                            <p className="italic">“{e.excerpt}”</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              <Stars rating={e.rating} className="mr-1 align-middle" />
                              {[e.platform, formatDate(e.date), `ref ${e.review_id.slice(0, 8)}`].filter(Boolean).join(" · ")}{e.is_demo && " · DEMO"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Business improvement opportunities">
                <ul className="space-y-2.5">{l.opportunities?.filter((o) => o.kind !== "solution").map((o) => <li key={o.title} className="text-sm"><p className="font-medium">{o.title}</p><p className="text-muted-foreground">{o.description}</p></li>)}</ul>
              </Panel>
              <Panel title="Recommended solutions">
                <ul className="space-y-2.5">{l.opportunities?.filter((o) => o.kind === "solution").map((o) => <li key={o.title} className="text-sm"><p className="font-medium">{o.title}</p><p className="text-muted-foreground">{o.description}</p></li>)}</ul>
              </Panel>
            </div>

            <Panel title="Outreach" description="Edit freely — placeholders {first_name} and {sender_name} are yours to fill."
              actions={can("analyst") && <Button size="sm" onClick={() => patch.mutate(draft)} disabled={patch.isPending}>{patch.isPending && <Loader2 className="animate-spin" />} Save edits</Button>}>
              <Tabs defaultValue="email">
                <TabsList><TabsTrigger value="email">Cold email</TabsTrigger><TabsTrigger value="linkedin">LinkedIn</TabsTrigger><TabsTrigger value="followup">Follow-up</TabsTrigger></TabsList>
                <TabsContent value="email" className="space-y-2 pt-3">
                  <Input value={draft.cold_email_subject} onChange={(e) => setDraft({ ...draft, cold_email_subject: e.target.value })} aria-label="Email subject" />
                  <Textarea rows={12} value={draft.cold_email} onChange={(e) => setDraft({ ...draft, cold_email: e.target.value })} aria-label="Cold email" />
                  <CopyButton text={`Subject: ${draft.cold_email_subject}\n\n${draft.cold_email}`} />
                </TabsContent>
                <TabsContent value="linkedin" className="space-y-2 pt-3">
                  <Textarea rows={5} value={draft.linkedin_message} onChange={(e) => setDraft({ ...draft, linkedin_message: e.target.value })} aria-label="LinkedIn message" />
                  <div className="flex items-center justify-between"><CopyButton text={draft.linkedin_message || ""} /><span className="text-xs text-muted-foreground">{(draft.linkedin_message || "").length}/300</span></div>
                </TabsContent>
                <TabsContent value="followup" className="space-y-2 pt-3">
                  <Textarea rows={8} value={draft.follow_up_email} onChange={(e) => setDraft({ ...draft, follow_up_email: e.target.value })} aria-label="Follow-up email" />
                  <CopyButton text={draft.follow_up_email || ""} />
                </TabsContent>
              </Tabs>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="One-page PDF report">
              {reportJob && <JobProgress job={rJob.data} className="mb-3" />}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => makeReport.mutate()} disabled={makeReport.isPending || !can("analyst")}>
                  {makeReport.isPending ? <Loader2 className="animate-spin" /> : <FileText />} {reportId ? "Regenerate PDF" : "Generate PDF"}
                </Button>
                {reportId && (
                  <>
                    <Button variant="outline" onClick={() => download(`/reports/${reportId}/download`, `${l.business_name}-intelligence.pdf`).catch((e) => toast.error(errorMessage(e)))}><Download /> Download</Button>
                    <Button variant="ghost" asChild><Link href={`/app/reports/${reportId}`}>Open</Link></Button>
                  </>
                )}
              </div>
            </Panel>
            <Panel title="Contact">
              <div className="space-y-2.5">
                <div className="space-y-1"><Label htmlFor="cn">Name</Label><Input id="cn" value={contact.contact_name} onChange={(e) => setContact({ ...contact, contact_name: e.target.value })} /></div>
                <div className="space-y-1"><Label htmlFor="ce">Email</Label><Input id="ce" type="email" value={contact.contact_email} onChange={(e) => setContact({ ...contact, contact_email: e.target.value })} /></div>
                <div className="space-y-1"><Label htmlFor="cl">LinkedIn URL</Label><Input id="cl" value={contact.contact_linkedin} onChange={(e) => setContact({ ...contact, contact_linkedin: e.target.value })} /></div>
                {can("analyst") && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => patch.mutate({ ...contact, contact_email: contact.contact_email || null })}>Save contact</Button>
                    <Button size="sm" variant="outline" onClick={() => patch.mutate({ status: "contacted" })}><Send /> Mark as contacted</Button>
                    <Button size="sm" variant="ghost" onClick={() => hubspot.mutate()} disabled={hubspot.isPending}>Sync to HubSpot</Button>
                  </div>
                )}
              </div>
              {l.website && <a href={l.website} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:underline"><Globe className="size-3.5" /> {l.website}</a>}
            </Panel>
            <Panel title="Activity & notes">
              {can("analyst") && (
                <div className="mb-3 flex gap-2">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" aria-label="Note" />
                  <Button size="sm" onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending}>Add</Button>
                </div>
              )}
              <ul className="space-y-3">
                {l.activities?.map((a) => (
                  <li key={a.id} className="text-sm">
                    <p>{a.message}</p>
                    <p className="text-xs text-muted-foreground">{a.actor || "System"} · {timeAgo(a.created_at)}</p>
                  </li>
                ))}
              </ul>
            </Panel>
            {can("analyst") && <Button variant="ghost" className="w-full text-destructive" onClick={() => setDel(true)}><Trash2 /> Delete lead</Button>}
          </div>
        </div>
      )}

      {l.project_id && (
        <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} projectId={l.project_id} businessId={primary?.id}
          onComplete={() => qc.invalidateQueries({ queryKey: ["lead", id] })} />
      )}
      <ConfirmDialog open={del} onOpenChange={setDel} title="Delete this lead?" description="The lead and its outreach drafts will be removed." destructive confirmLabel="Delete"
        onConfirm={async () => { await api(`/leads/${id}`, { method: "DELETE" }); router.replace("/app/opportunity-finder") }} />
    </>
  )
}
