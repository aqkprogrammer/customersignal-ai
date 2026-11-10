"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Mail, MoreHorizontal, RefreshCw, UserPlus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog, PageHeader, Panel } from "@/components/dashboard/primitives"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { CardSkeleton, ErrorState } from "@/components/shared/states"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useWorkspace } from "@/hooks/use-session"
import { api, ApiError, errorMessage } from "@/lib/api"
import { formatDate, initials, timeAgo, titleCase } from "@/lib/utils"

interface Member { id: string; user_id: string; email: string; full_name: string; avatar_url: string | null; role: string; joined_at: string; last_active_at: string | null; actions_30d: number; is_you: boolean }
interface Invite { id: string; email: string; role: string; status: string; expires_at: string; created_at: string }
interface TeamData { members: Member[]; invitations: Invite[]; limit: number | null; your_role: string; team_collaboration: boolean }

const ROLE_HELP: Record<string, string> = {
  owner: "Full control incl. billing and deleting the workspace",
  admin: "Manage team, integrations and settings",
  analyst: "Upload data, run analyses, create reports and leads",
  viewer: "Read-only access to dashboards and reports",
}

export default function TeamPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const { can, workspace } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [invite, setInvite] = useState({ email: "", role: "analyst" })
  const [remove, setRemove] = useState<Member | null>(null)
  const team = useQuery({ queryKey: ["team", workspace?.id], queryFn: () => api<TeamData>("/team/members"), enabled: !!workspace })
  const refresh = () => qc.invalidateQueries({ queryKey: ["team"] })

  const send = useMutation({
    mutationFn: () => api("/team/invitations", { method: "POST", body: invite }),
    onSuccess: () => { toast.success(`Invitation sent to ${invite.email}`); setOpen(false); setInvite({ email: "", role: "analyst" }); refresh() },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) toast.error(e.message, { action: { label: "Upgrade", onClick: () => router.push("/app/billing") } })
      else toast.error(errorMessage(e))
    },
  })
  const role = useMutation({
    mutationFn: ({ id, r }: { id: string; r: string }) => api(`/team/members/${id}`, { method: "PATCH", body: { role: r } }),
    onSuccess: () => { toast.success("Role updated"); refresh(); qc.invalidateQueries({ queryKey: ["session"] }) },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const inviteAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "resend" | "revoke" }) =>
      action === "resend" ? api(`/team/invitations/${id}/resend`, { method: "POST" }) : api(`/team/invitations/${id}`, { method: "DELETE" }),
    onSuccess: (_, v) => { toast.success(v.action === "resend" ? "Invitation resent" : "Invitation revoked"); refresh() },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const t = team.data
  const pending = t?.invitations.filter((i) => i.status === "pending").length ?? 0
  const roleOptions = t?.your_role === "owner" ? ["owner", "admin", "analyst", "viewer"] : ["analyst", "viewer"]

  return (
    <>
      <PageHeader title="Team" description="Invite colleagues and control what they can do. Permissions are enforced on the server."
        actions={can("admin") && <Button onClick={() => setOpen(true)}><UserPlus /> Invite member</Button>} />
      {team.error ? <ErrorState error={team.error} onRetry={() => team.refetch()} /> : !t ? <CardSkeleton rows={6} /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Pill color="signal">{t.members.length + pending} / {t.limit ?? "∞"} seats used</Pill>
            {!t.team_collaboration && <span>Upgrade to Pro for team collaboration.</span>}
          </div>
          <div className="surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Last active</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Actions (30d)</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">{m.avatar_url && <AvatarImage src={m.avatar_url} alt="" />}<AvatarFallback className="text-xs">{initials(m.full_name || m.email)}</AvatarFallback></Avatar>
                        <div><p className="text-sm font-medium">{m.full_name || m.email} {m.is_you && <Pill>You</Pill>}</p><p className="text-xs text-muted-foreground">{m.email}</p></div>
                      </div>
                    </TableCell>
                    <TableCell><Pill color={m.role === "owner" ? "ice" : m.role === "admin" ? "signal" : "gray"}>{titleCase(m.role)}</Pill></TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{timeAgo(m.last_active_at)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{m.actions_30d}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{formatDate(m.joined_at)}</TableCell>
                    <TableCell>
                      {(m.is_you ? m.role !== "owner" : can("admin") && m.role !== "owner") && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Manage ${m.email}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!m.is_you && (
                              <>
                                <DropdownMenuLabel>Change role</DropdownMenuLabel>
                                {roleOptions.filter((r) => r !== m.role).map((r) => (
                                  <DropdownMenuItem key={r} onSelect={() => role.mutate({ id: m.id, r })}>{r === "owner" ? "Transfer ownership" : `Make ${r}`}</DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem variant="destructive" onSelect={() => setRemove(m)}>{m.is_you ? "Leave workspace" : "Remove from workspace"}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {t.invitations.length > 0 && (
            <Panel title="Invitations">
              <ul className="divide-y">
                {t.invitations.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <Mail className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 text-sm">{i.email} <span className="text-xs text-muted-foreground">· {titleCase(i.role)} · expires {formatDate(i.expires_at)}</span></span>
                    <StatusBadge status={i.status} />
                    {can("admin") && (
                      <>
                        <Button variant="ghost" size="xs" onClick={() => inviteAction.mutate({ id: i.id, action: "resend" })}><RefreshCw /> Resend</Button>
                        {i.status === "pending" && <Button variant="ghost" size="xs" onClick={() => inviteAction.mutate({ id: i.id, action: "revoke" })}><X /> Revoke</Button>}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Roles & permissions">
            <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(ROLE_HELP).map(([r, d]) => <div key={r}><dt className="text-sm font-medium">{titleCase(r)}</dt><dd className="text-xs text-muted-foreground">{d}</dd></div>)}</dl>
          </Panel>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>They&apos;ll receive an email link valid for 7 days. They must sign in with this email to accept.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="i-email">Email</Label><Input id="i-email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={invite.role} onValueChange={(r) => setInvite({ ...invite, role: r })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(t?.your_role === "owner" ? ["admin", "analyst", "viewer"] : ["analyst", "viewer"]).map((r) => <SelectItem key={r} value={r}>{titleCase(r)}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ROLE_HELP[invite.role]}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => send.mutate()} disabled={!/^\S+@\S+\.\S+$/.test(invite.email) || send.isPending}>{send.isPending && <Loader2 className="animate-spin" />} Send invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!remove} onOpenChange={(o) => !o && setRemove(null)} destructive
        title={remove?.is_you ? "Leave this workspace?" : `Remove ${remove?.email}?`}
        description={remove?.is_you ? "You'll lose access until someone invites you again." : "They'll immediately lose access to this workspace."}
        confirmLabel={remove?.is_you ? "Leave" : "Remove"}
        onConfirm={async () => {
          await api(`/team/members/${remove!.id}`, { method: "DELETE" }).catch((e) => { toast.error(errorMessage(e)); throw e })
          if (remove?.is_you) { await qc.invalidateQueries({ queryKey: ["session"] }); router.replace("/app") } else refresh()
        }} />
    </>
  )
}
