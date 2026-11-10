"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, Loader2, Monitor, Plus, Trash2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { PasswordInput } from "@/components/forms/auth-fields"
import { ConfirmDialog, PageHeader, Panel } from "@/components/dashboard/primitives"
import { Pill } from "@/components/shared/badges"
import { CardSkeleton } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession, useWorkspace } from "@/hooks/use-session"
import { api, ApiError, errorMessage, setActiveWorkspaceId } from "@/lib/api"
import { COUNTRIES, INDUSTRIES } from "@/lib/site"
import { timeAgo } from "@/lib/utils"
import type { Workspace } from "@/types/api"

const NOTIF_TYPES = [
  ["analysis_completed", "Analysis completed"], ["report_ready", "Report ready"], ["monitoring_alert", "Monitoring alerts"],
  ["team", "Team changes"], ["billing", "Billing"], ["product_updates", "Product updates"],
] as const

interface SessionRow { id: string; user_agent: string | null; ip_address: string | null; current: boolean; created_at: string; last_used_at: string | null }
interface Category { id: string; slug: string; name: string; keywords: string[]; is_custom: boolean }

export function SettingsPage() {
  const params = useSearchParams()
  const router = useRouter()
  const qc = useQueryClient()
  const { data: session } = useSession()
  const { workspace, can, switchWorkspace } = useWorkspace()
  const [tab, setTab] = useState(params.get("tab") === "workspaces" ? "workspace" : params.get("tab") || "profile")
  const user = session?.user

  const [profile, setProfile] = useState({ full_name: "", company_name: "", job_title: "", timezone: "" })
  const [pw, setPw] = useState({ current_password: "", new_password: "" })
  const [ws, setWs] = useState({ name: "", industry: "", country: "", city: "", website: "", data_retention_days: "" })
  const [brand, setBrand] = useState({ primary_color: "#45e5ea", logo_url: "" })
  const [newWs, setNewWs] = useState<string | null>(params.get("tab") === "workspaces" ? "" : null)
  const [cat, setCat] = useState({ name: "", keywords: "" })
  const [delAccount, setDelAccount] = useState(false)
  const [delPassword, setDelPassword] = useState("")
  const [delConfirm, setDelConfirm] = useState("")
  const [delWs, setDelWs] = useState(false)

  const [syncedUser, setSyncedUser] = useState<unknown>(null)
  if (user && user !== syncedUser) {
    setSyncedUser(user)
    setProfile({ full_name: user.full_name, company_name: user.company_name || "", job_title: user.job_title || "", timezone: user.timezone })
  }
  const [syncedWs, setSyncedWs] = useState<unknown>(null)
  if (workspace && workspace !== syncedWs) {
    setSyncedWs(workspace)
    {
      setWs({ name: workspace.name, industry: workspace.industry || "", country: workspace.country || "", city: workspace.city || "", website: workspace.website || "",
        data_retention_days: workspace.data_retention_days ? String(workspace.data_retention_days) : "" })
      setBrand({ primary_color: workspace.branding?.primary_color || "#45e5ea", logo_url: workspace.branding?.logo_url || "" })
    }
  }

  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => api<SessionRow[]>("/auth/sessions", { noWorkspace: true }), enabled: tab === "security" })
  const categories = useQuery({ queryKey: ["categories", workspace?.id], queryFn: () => api<Category[]>("/workspaces/current/categories"), enabled: tab === "workspace" && !!workspace })
  const refreshSession = () => qc.invalidateQueries({ queryKey: ["session"] })

  const saveProfile = useMutation({
    mutationFn: () => api("/users/me", { method: "PATCH", body: profile, noWorkspace: true }),
    onSuccess: () => { toast.success("Profile saved"); refreshSession() }, onError: (e) => toast.error(errorMessage(e)),
  })
  const changePw = useMutation({
    mutationFn: () => api<{ message: string }>("/users/me/password", { method: "POST", body: { current_password: pw.current_password || null, new_password: pw.new_password }, noWorkspace: true }),
    onSuccess: (r) => { toast.success(r.message); setPw({ current_password: "", new_password: "" }); qc.invalidateQueries({ queryKey: ["sessions"] }) },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const savePrefs = useMutation({
    mutationFn: (prefs: Record<string, { in_app: boolean; email: boolean }>) => api("/users/me/notification-preferences", { method: "PUT", body: { notification_preferences: prefs }, noWorkspace: true }),
    onSuccess: () => { toast.success("Preferences saved"); refreshSession() }, onError: (e) => toast.error(errorMessage(e)),
  })
  const saveWs = useMutation({
    mutationFn: () => api("/workspaces/current", { method: "PATCH", body: { ...ws, data_retention_days: ws.data_retention_days ? Number(ws.data_retention_days) : null,
      industry: ws.industry || null, country: ws.country || null, city: ws.city || null, website: ws.website || null } }),
    onSuccess: () => { toast.success("Workspace saved"); refreshSession() }, onError: (e) => toast.error(errorMessage(e)),
  })
  const saveBrand = useMutation({
    mutationFn: () => api("/workspaces/current/branding", { method: "PUT", body: { primary_color: brand.primary_color, logo_url: brand.logo_url || null } }),
    onSuccess: () => { toast.success("Branding saved"); refreshSession() },
    onError: (e) => e instanceof ApiError && e.status === 402
      ? toast.error(e.message, { action: { label: "Upgrade", onClick: () => router.push("/app/billing") } }) : toast.error(errorMessage(e)),
  })
  const createWs = useMutation({
    mutationFn: () => api<Workspace>("/workspaces", { method: "POST", body: { name: newWs }, noWorkspace: true }),
    onSuccess: async (w) => { setNewWs(null); await refreshSession(); await switchWorkspace(w.id); toast.success("Workspace created"); router.push("/app") },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const addCat = useMutation({
    mutationFn: () => api("/workspaces/current/categories", { method: "POST", body: { name: cat.name, keywords: cat.keywords.split(",").map((k) => k.trim()).filter(Boolean) } }),
    onSuccess: () => { setCat({ name: "", keywords: "" }); qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Category added — re-analyze to apply it") },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const exportData = useMutation({
    mutationFn: () => api<unknown>("/users/me/export", { noWorkspace: true }),
    onSuccess: (data) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }))
      const a = document.createElement("a"); a.href = url; a.download = "customersignal-data-export.json"; a.click(); URL.revokeObjectURL(url)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (!user || !workspace) return <CardSkeleton rows={8} />
  const prefs = user.notification_preferences || {}

  return (
    <>
      <PageHeader title="Settings" description="Your profile, security, notifications and workspace configuration." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="privacy">Privacy & data</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Panel title="Profile" className="max-w-2xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="s-name">Full name</Label><Input id="s-name" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={user.email} disabled /></div>
              <div className="space-y-1.5"><Label htmlFor="s-co">Company</Label><Input id="s-co" value={profile.company_name} onChange={(e) => setProfile({ ...profile, company_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="s-title">Job title</Label><Input id="s-title" value={profile.job_title} onChange={(e) => setProfile({ ...profile, job_title: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="s-tz">Timezone</Label><Input id="s-tz" value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} /></div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              {user.email_verified ? <Pill color="green">Email verified</Pill> : <Pill color="amber">Email not verified</Pill>}
              {user.google_linked && <Pill color="signal">Google linked</Pill>}
            </div>
            <Button className="mt-4" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>{saveProfile.isPending && <Loader2 className="animate-spin" />} Save profile</Button>
          </Panel>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Panel title={user.has_password ? "Change password" : "Set a password"} description={user.has_password ? "Other sessions will be signed out." : "You sign in with Google. Add a password to also sign in with email."} className="max-w-2xl">
            <div className="grid gap-4 sm:grid-cols-2">
              {user.has_password && <div className="space-y-1.5"><Label htmlFor="s-cur">Current password</Label><PasswordInput id="s-cur" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></div>}
              <div className="space-y-1.5"><Label htmlFor="s-new">New password</Label><PasswordInput id="s-new" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">At least 10 characters with letters and numbers.</p>
            <Button className="mt-4" onClick={() => changePw.mutate()} disabled={pw.new_password.length < 10 || changePw.isPending}>Update password</Button>
          </Panel>
          <Panel title="Active sessions" className="max-w-2xl">
            <ul className="divide-y">
              {sessions.data?.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <Monitor className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1"><p className="truncate">{s.user_agent || "Unknown device"}</p><p className="text-xs text-muted-foreground">{s.ip_address} · active {timeAgo(s.last_used_at)}</p></div>
                  {s.current ? <Pill color="green">This device</Pill> : (
                    <Button variant="ghost" size="xs" onClick={async () => { await api(`/auth/sessions/${s.id}`, { method: "DELETE", noWorkspace: true }); qc.invalidateQueries({ queryKey: ["sessions"] }) }}>Sign out</Button>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </TabsContent>

        <TabsContent value="notifications">
          <Panel title="Notification preferences" description="Choose how you hear about activity across your workspaces." className="max-w-2xl">
            <div className="divide-y">
              <div className="grid grid-cols-[1fr_80px_80px] pb-2 text-xs font-medium text-muted-foreground"><span /><span className="text-center">In-app</span><span className="text-center">Email</span></div>
              {NOTIF_TYPES.map(([key, label]) => {
                const p = prefs[key] || { in_app: true, email: false }
                return (
                  <div key={key} className="grid grid-cols-[1fr_80px_80px] items-center py-3 text-sm">
                    <span>{label}</span>
                    {(["in_app", "email"] as const).map((ch) => (
                      <div key={ch} className="flex justify-center">
                        <Switch checked={p[ch]} aria-label={`${label} ${ch}`} onCheckedChange={(v) => savePrefs.mutate({ ...prefs, [key]: { ...p, [ch]: v } })} />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="workspace" className="space-y-4">
          <Panel title="Workspace details" className="max-w-3xl" actions={<Button variant="outline" size="sm" onClick={() => setNewWs("")}><Plus /> New workspace</Button>}>
            <fieldset disabled={!can("admin")} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="w-name">Name</Label><Input id="w-name" value={ws.name} onChange={(e) => setWs({ ...ws, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="w-web">Website</Label><Input id="w-web" value={ws.website} onChange={(e) => setWs({ ...ws, website: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Industry</Label>
                <Select value={ws.industry || undefined} onValueChange={(v) => setWs({ ...ws, industry: v })}><SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Country</Label>
                <Select value={ws.country || undefined} onValueChange={(v) => setWs({ ...ws, country: v })}><SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label htmlFor="w-city">City</Label><Input id="w-city" value={ws.city} onChange={(e) => setWs({ ...ws, city: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="w-ret">Data retention (days)</Label><Input id="w-ret" type="number" min={30} placeholder="Keep indefinitely" value={ws.data_retention_days} onChange={(e) => setWs({ ...ws, data_retention_days: e.target.value })} />
                <p className="text-xs text-muted-foreground">Reviews older than this are deleted automatically (daily).</p></div>
            </fieldset>
            {can("admin") && <Button className="mt-4" onClick={() => saveWs.mutate()} disabled={saveWs.isPending}>Save workspace</Button>}
          </Panel>
          <Panel title="Report branding" description="Custom colors and logo on PDF reports (Business plan and above)." className="max-w-3xl">
            <fieldset disabled={!can("admin")} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="b-color">Primary color</Label>
                <div className="flex gap-2"><input type="color" aria-label="Pick color" value={brand.primary_color} onChange={(e) => setBrand({ ...brand, primary_color: e.target.value })} className="h-9 w-12 rounded border" />
                  <Input id="b-color" value={brand.primary_color} onChange={(e) => setBrand({ ...brand, primary_color: e.target.value })} /></div></div>
              <div className="space-y-1.5"><Label htmlFor="b-logo">Logo URL</Label><Input id="b-logo" placeholder="https://" value={brand.logo_url} onChange={(e) => setBrand({ ...brand, logo_url: e.target.value })} /></div>
            </fieldset>
            {can("admin") && <Button className="mt-4" variant="outline" onClick={() => saveBrand.mutate()} disabled={saveBrand.isPending}>Save branding</Button>}
          </Panel>
          <Panel title="Review categories" description="Built-in complaint categories plus your own custom ones." className="max-w-3xl">
            <div className="flex flex-wrap gap-1.5">{categories.data?.map((c) => (
              <Pill key={c.id} color={c.is_custom ? "ice" : "gray"}>{c.name}
                {c.is_custom && can("analyst") && <button aria-label={`Delete ${c.name}`} onClick={async () => { await api(`/workspaces/current/categories/${c.id}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: ["categories"] }) }}><Trash2 className="size-3" /></button>}
              </Pill>))}</div>
            {can("analyst") && (
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                <Input placeholder="Category name" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} aria-label="Category name" />
                <Input placeholder="Keywords, comma separated" value={cat.keywords} onChange={(e) => setCat({ ...cat, keywords: e.target.value })} aria-label="Keywords" />
                <Button onClick={() => addCat.mutate()} disabled={cat.name.trim().length < 2 || addCat.isPending}>Add</Button>
              </div>
            )}
          </Panel>
          {can("owner") && !workspace.is_demo && (
            <Panel title="Danger zone" className="max-w-3xl border-destructive/30">
              <Button variant="destructive" onClick={() => setDelWs(true)}><Trash2 /> Delete this workspace</Button>
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          <Panel title="Export your data" description="Download your profile, workspaces, projects, reports and leads as JSON." className="max-w-2xl">
            <Button variant="outline" onClick={() => exportData.mutate()} disabled={exportData.isPending}><Download /> Export data</Button>
          </Panel>
          <Panel title="Delete account" description="Permanently deletes your account and workspaces you solely own. Shared workspaces must be transferred first." className="max-w-2xl border-destructive/30">
            <Button variant="destructive" onClick={() => setDelAccount(true)}><Trash2 /> Delete my account</Button>
          </Panel>
        </TabsContent>
      </Tabs>

      <Dialog open={newWs !== null} onOpenChange={(o) => !o && setNewWs(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create a workspace</DialogTitle><DialogDescription>Workspaces keep data, members and billing fully separate.</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="nw">Name</Label><Input id="nw" value={newWs || ""} onChange={(e) => setNewWs(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setNewWs(null)}>Cancel</Button>
            <Button onClick={() => createWs.mutate()} disabled={!newWs?.trim() || createWs.isPending}>{createWs.isPending && <Loader2 className="animate-spin" />} Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={delAccount} onOpenChange={setDelAccount}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete your account?</DialogTitle><DialogDescription>This can&apos;t be undone. Type DELETE to confirm.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {user.has_password && <div className="space-y-1.5"><Label htmlFor="dp">Password</Label><PasswordInput id="dp" value={delPassword} onChange={(e) => setDelPassword(e.target.value)} /></div>}
            <div className="space-y-1.5"><Label htmlFor="dc">Confirmation</Label><Input id="dc" value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} placeholder="DELETE" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDelAccount(false)}>Cancel</Button>
            <Button variant="destructive" disabled={delConfirm !== "DELETE"} onClick={async () => {
              try {
                await api("/users/me", { method: "DELETE", body: { password: delPassword || null, confirm: delConfirm }, noWorkspace: true })
                setActiveWorkspaceId(null); qc.clear(); router.replace("/")
              } catch (e) { toast.error(errorMessage(e)) }
            }}>Delete account</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={delWs} onOpenChange={setDelWs} destructive confirmLabel="Delete workspace" title={`Delete ${workspace.name}?`}
        description="All projects, reviews, reports and members of this workspace will lose access."
        onConfirm={async () => {
          await api("/workspaces/current", { method: "DELETE" }).catch((e) => { toast.error(errorMessage(e)); throw e })
          setActiveWorkspaceId(null); await refreshSession(); router.replace("/app")
        }} />
    </>
  )
}
