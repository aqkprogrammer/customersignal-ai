"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Briefcase,
  Check,
  FileSpreadsheet,
  HeartPulse,
  Hotel,
  Loader2,
  Megaphone,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Webhook,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { LogoMark } from "@/components/brand/logo"
import { ConnectingScreen } from "@/components/shared/connecting"
import { SignalEmblem } from "@/components/aurora"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "@/hooks/use-session"
import { api, ApiError, errorMessage, setActiveWorkspaceId } from "@/lib/api"
import { COUNTRIES, INDUSTRIES } from "@/lib/site"
import { cn } from "@/lib/utils"
import type { Project, Workspace } from "@/types/api"

const BUSINESS_TYPES: { value: string; label: string; icon: LucideIcon; industry: string }[] = [
  { value: "restaurant", label: "Restaurant", icon: UtensilsCrossed, industry: "Restaurants" },
  { value: "beauty_wellness", label: "Beauty & wellness", icon: Sparkles, industry: "Beauty & wellness" },
  { value: "healthcare", label: "Healthcare", icon: HeartPulse, industry: "Healthcare" },
  { value: "ecommerce", label: "Ecommerce", icon: ShoppingBag, industry: "Ecommerce" },
  { value: "hospitality", label: "Hotel & hospitality", icon: Hotel, industry: "Hotels & hospitality" },
  { value: "agency", label: "Marketing agency", icon: Megaphone, industry: "Marketing agency" },
  { value: "other", label: "Other", icon: Store, industry: "Other" },
]

const GOALS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "understand_complaints", label: "Understand customer complaints", icon: Search },
  { value: "improve_satisfaction", label: "Improve customer satisfaction", icon: TrendingUp },
  { value: "competitor_weaknesses", label: "Discover competitor weaknesses", icon: Target },
  { value: "product_opportunities", label: "Find new product opportunities", icon: Sparkles },
  { value: "monitor_reputation", label: "Monitor online reputation", icon: BarChart3 },
  { value: "market_research", label: "Research a new market", icon: Briefcase },
]

const SOURCES: { value: string; label: string; note: string; icon: LucideIcon }[] = [
  { value: "csv", label: "CSV / Excel uploads", note: "Available now", icon: FileSpreadsheet },
  { value: "reviews_api", label: "Reviews API", note: "Push reviews from your systems", icon: Webhook },
  { value: "google_business_profile", label: "Google Business Profile", note: "Requires Google API approval", icon: Store },
  { value: "amazon", label: "Amazon (Selling Partner)", note: "Requires Amazon approval", icon: ShoppingBag },
  { value: "shopify", label: "Shopify reviews app export", note: "Via CSV export", icon: ShoppingBag },
  { value: "manual", label: "Manual entry", note: "Type in feedback", icon: Users },
]

const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"]
const STEPS = ["Welcome", "Business", "Company", "Goals", "Data", "Project", "Done"]

type Data = {
  business_type?: string
  company_name?: string
  website?: string
  country?: string
  city?: string
  industry?: string
  company_size?: string
  goals?: string[]
  preferred_sources?: string[]
  first_project_id?: string
}

function OptionCard({ selected, onClick, icon: Icon, label, note }: { selected: boolean; onClick: () => void; icon: LucideIcon; label: string; note?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
        selected && "border-primary bg-accent/60 ring-1 ring-primary",
      )}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground", selected && "bg-primary text-primary-foreground")}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </span>
      {selected && <Check className="size-4 text-primary" />}
    </button>
  )
}

export function OnboardingWizard() {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: session, isLoading, error: sessionError, failureCount, refetch: refetchSession } = useSession()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<Data>({})
  const [project, setProject] = useState({ name: "", business_name: "", description: "" })
  const [hydrated, setHydrated] = useState(false)

  if (session && !hydrated) {
    const saved = (session.user.onboarding_data || {}) as Data
    setData({ company_name: session.user.company_name || undefined, ...saved })
    setStep(Math.min(Math.max(session.user.onboarding_step || 1, 1), 7))
    setProject((p) => ({ ...p, business_name: saved.company_name || session.user.company_name || "" }))
    setHydrated(true)
  }

  const save = useMutation({
    mutationFn: (vars: { step: number; data: Data; complete?: boolean }) =>
      api("/users/me/onboarding", { method: "PUT", body: { step: vars.step, data: vars.data, complete: !!vars.complete }, noWorkspace: true }),
  })

  async function go(nextStep: number, patch: Data = {}) {
    const merged = { ...data, ...patch }
    setData(merged)
    try {
      await save.mutateAsync({ step: nextStep, data: merged })
      setStep(nextStep)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const createProject = useMutation({
    mutationFn: () =>
      api<Project>("/projects", {
        method: "POST",
        body: {
          name: project.name.trim(),
          business_name: project.business_name.trim() || null,
          description: project.description.trim() || null,
          industry: data.industry || null,
          country: data.country || null,
          city: data.city || null,
          website: data.website || null,
          data_source: "csv",
        },
      }),
    onSuccess: (p) => go(7, { first_project_id: p.id }),
    onError: (err) => toast.error(errorMessage(err)),
  })

  const demo = useMutation({
    mutationFn: () => api<Workspace>("/workspaces/demo", { method: "POST", noWorkspace: true }),
  })

  async function finish(target: "dashboard" | "upload" | "demo") {
    try {
      await save.mutateAsync({ step: 7, data, complete: true })
      if (target === "demo") {
        const ws = await demo.mutateAsync()
        setActiveWorkspaceId(ws.id)
      }
      await qc.invalidateQueries({ queryKey: ["session"] })
      if (target === "upload" && data.first_project_id) router.replace(`/app/reviews?project=${data.first_project_id}&import=1`)
      else router.replace("/app?tour=1")
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  if (isLoading || !hydrated) {
    return <ConnectingScreen attempts={failureCount} />
  }
  if (!session && sessionError && !(sessionError instanceof ApiError && sessionError.status === 401)) {
    return <ConnectingScreen error={sessionError} attempts={failureCount} onRetry={() => void refetchSession()} loginHref="/login?next=%2Fonboarding" />
  }

  const toggle = (key: "goals" | "preferred_sources", value: string) => {
    const list = new Set(data[key] || [])
    if (list.has(value)) list.delete(value)
    else list.add(value)
    setData({ ...data, [key]: [...list] })
  }

  const busy = save.isPending || createProject.isPending || demo.isPending
  const firstName = (session?.user.full_name || "").split(" ")[0]

  return (
    <div className="min-h-screen bg-[#EFEEE9] dark:bg-background">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <LogoMark /> CustomerSignal<span className="text-primary">AI</span>
        </div>
        {step > 1 && step < 7 && (
          <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => finish("dashboard")} disabled={busy}>
            Skip setup
          </button>
        )}
      </header>
      <div className="mx-auto max-w-2xl px-4 pb-16">
        <ol className="mb-8 flex items-center gap-1.5" aria-label="Onboarding progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <div className={cn("h-1.5 rounded-full bg-border transition-colors", i + 1 <= step && "bg-primary")} />
              <span className={cn("mt-1.5 hidden text-[11px] sm:block", i + 1 === step ? "font-medium text-foreground" : "text-muted-foreground")}>{s}</span>
            </li>
          ))}
        </ol>

        <div className="surface p-6 sm:p-9">
          {step === 1 && (
            <div className="text-center">
              <div className="mx-auto w-40 text-foreground">
                <SignalEmblem className="w-full" />
              </div>
              <p className="mt-3 inline-flex rounded-full bg-[#f3fbe6] px-3 py-1 text-[13px] font-semibold text-[#3b6b0c]">Workspace ready</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Welcome{firstName ? `, ${firstName}` : ""}.</h1>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                Let&apos;s tailor CustomerSignal AI to your business. It takes about two minutes — you can skip any optional step.
              </p>
              <Button size="lg" variant="signal" className="mt-8 h-11 px-6" onClick={() => go(2)} disabled={busy}>
                Get started <ArrowRight data-arrow />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold">What type of business do you operate?</h2>
              <p className="mt-1 text-sm text-muted-foreground">We&apos;ll tune categories and examples to your industry.</p>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {BUSINESS_TYPES.map((b) => (
                  <OptionCard key={b.value} icon={b.icon} label={b.label} selected={data.business_type === b.value}
                    onClick={() => setData({ ...data, business_type: b.value, industry: data.industry || b.industry })} />
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold">Tell us about your company</h2>
              <p className="mt-1 text-sm text-muted-foreground">Used for your workspace and report branding.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="company">Company name</Label>
                  <Input id="company" value={data.company_name || ""} onChange={(e) => setData({ ...data, company_name: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" placeholder="https://" value={data.website || ""} onChange={(e) => setData({ ...data, website: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Select value={data.country} onValueChange={(v) => setData({ ...data, country: v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="Dubai" value={data.city || ""} onChange={(e) => setData({ ...data, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Select value={data.industry} onValueChange={(v) => setData({ ...data, industry: v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>{INDUSTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Company size</Label>
                  <Select value={data.company_size} onValueChange={(v) => setData({ ...data, company_size: v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Employees" /></SelectTrigger>
                    <SelectContent>{SIZES.map((c) => <SelectItem key={c} value={c}>{c} employees</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-xl font-semibold">What do you want to achieve?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Pick as many as you like.</p>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {GOALS.map((g) => (
                  <OptionCard key={g.value} icon={g.icon} label={g.label} selected={(data.goals || []).includes(g.value)} onClick={() => toggle("goals", g.value)} />
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="text-xl font-semibold">Where does your feedback live?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We only use data you&apos;re authorized to access — uploads, official APIs and approved providers. CSV works for every source today.
              </p>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {SOURCES.map((s) => (
                  <OptionCard key={s.value} icon={s.icon} label={s.label} note={s.note}
                    selected={(data.preferred_sources || []).includes(s.value)} onClick={() => toggle("preferred_sources", s.value)} />
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <h2 className="text-xl font-semibold">Create your first project</h2>
              <p className="mt-1 text-sm text-muted-foreground">A project groups the reviews for one business, location or product.</p>
              <div className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pname">Project name</Label>
                  <Input id="pname" placeholder="e.g. Downtown branch reviews" value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bname">Business or product name</Label>
                  <Input id="bname" value={project.business_name} onChange={(e) => setProject({ ...project, business_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pdesc">Description <span className="text-muted-foreground">(optional)</span></Label>
                  <Textarea id="pdesc" rows={3} value={project.description} onChange={(e) => setProject({ ...project, description: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Check className="size-7" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold">You&apos;re all set</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {data.first_project_id
                  ? "Upload a review export to see sentiment, recurring complaints and opportunities within minutes."
                  : "Create a project and upload reviews whenever you're ready."}
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {data.first_project_id ? (
                  <Button className="h-11" onClick={() => finish("upload")} disabled={busy}>
                    <FileSpreadsheet /> Upload your first reviews
                  </Button>
                ) : (
                  <Button className="h-11" onClick={() => finish("dashboard")} disabled={busy}>
                    Go to dashboard <ArrowRight />
                  </Button>
                )}
                <Button variant="outline" className="h-11" onClick={() => finish("demo")} disabled={busy}>
                  {demo.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Explore the demo workspace
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">The demo workspace contains clearly labelled synthetic sample reviews.</p>
            </div>
          )}

          {step > 1 && step < 7 && (
            <div className="mt-8 flex items-center justify-between border-t pt-5">
              <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={busy}>
                <ArrowLeft /> Back
              </Button>
              <div className="flex gap-2">
                {step !== 2 && (
                  <Button variant="ghost" onClick={() => go(step + 1)} disabled={busy}>
                    Skip
                  </Button>
                )}
                {step === 6 ? (
                  <Button onClick={() => createProject.mutate()} disabled={busy || !project.name.trim()}>
                    {createProject.isPending && <Loader2 className="animate-spin" />} Create project
                  </Button>
                ) : (
                  <Button onClick={() => go(step + 1)} disabled={busy || (step === 2 && !data.business_type)}>
                    {save.isPending && <Loader2 className="animate-spin" />} Continue <ArrowRight />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
