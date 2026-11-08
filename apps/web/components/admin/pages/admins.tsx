"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, KeyRound, Loader2, Plus, ShieldAlert, ShieldCheck, UserCog } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"
import { toast } from "sonner"
import { Pill } from "@/components/shared/badges"
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ME_KEY, useAdminMe, useAdminMutation, useCan } from "@/hooks/use-admin"
import { adminApi, formatDateTime, ROLE_LABELS } from "@/lib/admin-api"
import { ADMIN_ROLES, type AdminMe, type AdminRole, type AdminsResponse } from "@/lib/admin-types"
import { titleCase } from "@/lib/utils"
import { ConfirmDialog, Field, PageHeader, Panel, TableCard } from "../ui"

export function AdminAdmins() {
  const can = useCan()
  const me = useAdminMe()
  const isSuper = can("admins.manage")
  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title={isSuper ? "Admins & security" : "My security"}
        description={isSuper ? "Admin accounts, roles and your own two-factor authentication." : "Manage two-factor authentication for your admin account."}
      />
      <div className="space-y-4">
        {me.data && <SecurityPanel me={me.data} />}
        {isSuper && <AdminsManager meId={me.data?.id} />}
      </div>
    </>
  )
}

// ----------------------------------------------------------------------------------------------- security
function SecurityPanel({ me }: { me: AdminMe }) {
  const qc = useQueryClient()
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null)
  const [code, setCode] = useState("")
  const [disableOpen, setDisableOpen] = useState(false)
  const [disableCode, setDisableCode] = useState("")

  const start = useAdminMutation<void, { secret: string; otpauth_uri: string }>({
    fn: () => adminApi("/auth/mfa/setup", { method: "POST" }),
    onSuccess: (d) => {
      setSetup(d)
      setCode("")
    },
  })
  const enable = useAdminMutation<string, AdminMe>({
    fn: (c) => adminApi("/auth/mfa/enable", { method: "POST", body: { code: c } }),
    success: "Two-factor authentication enabled",
    onSuccess: (admin) => {
      qc.setQueryData(ME_KEY, admin)
      setSetup(null)
      setCode("")
    },
  })
  const disable = useAdminMutation<string, AdminMe>({
    fn: (c) => adminApi("/auth/mfa/disable", { method: "POST", body: { code: c } }),
    success: "Two-factor authentication disabled",
    onSuccess: (admin) => {
      qc.setQueryData(ME_KEY, admin)
      setDisableOpen(false)
      setDisableCode("")
    },
  })

  return (
    <Panel
      id="security"
      title={<span className="inline-flex items-center gap-1.5"><KeyRound className="size-3.5" /> Two-factor authentication</span>}
      description={`Signed in as ${me.email} · ${ROLE_LABELS[me.role] || me.role}`}
      actions={me.mfa_enabled ? <Pill color="green"><ShieldCheck className="size-3" /> Enabled</Pill> : <Pill color="amber"><ShieldAlert className="size-3" /> Not enabled</Pill>}
    >
      {me.mfa_enabled ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Sign-in requires a 6-digit code from your authenticator app.</p>
          <Button variant="destructive" size="sm" onClick={() => setDisableOpen(true)}>Disable MFA</Button>
        </div>
      ) : !setup ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Protect this admin account with a TOTP authenticator (1Password, Google Authenticator, Authy…). Strongly recommended for every admin.</p>
          <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>
            {start.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Set up MFA
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-[auto_1fr]">
          <div className="mx-auto rounded-xl bg-white p-3">
            <QRCodeSVG value={setup.otpauth_uri} size={168} level="M" marginSize={0} />
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (/^\d{6}$/.test(code)) enable.mutate(code)
            }}
          >
            <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
              <li>Scan the QR code with your authenticator app.</li>
              <li>Or enter this secret manually:</li>
            </ol>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border bg-black/30 px-2.5 py-1.5 font-mono text-xs tracking-wider text-indigo-100">{setup.secret}</code>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Copy secret"
                onClick={() => {
                  navigator.clipboard.writeText(setup.secret).then(() => toast.success("Secret copied"), () => toast.error("Couldn't copy"))
                }}
              >
                <Copy />
              </Button>
            </div>
            <Field label="Enter the 6-digit code to confirm" htmlFor="mfa-code">
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="max-w-[180px] text-center font-mono tracking-[0.4em]"
                autoFocus
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={code.length !== 6 || enable.isPending}>
                {enable.isPending && <Loader2 className="animate-spin" />} Enable MFA
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSetup(null)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}
      <Dialog open={disableOpen} onOpenChange={(o) => { setDisableOpen(o); if (!o) setDisableCode("") }}>
        <DialogContent className="sm:max-w-sm">
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (/^\d{6}$/.test(disableCode)) disable.mutate(disableCode) }}>
            <DialogHeader>
              <DialogTitle>Disable two-factor authentication?</DialogTitle>
              <DialogDescription>Your account will be protected by password only. Enter a current code to confirm.</DialogDescription>
            </DialogHeader>
            <Input
              aria-label="Authentication code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center font-mono tracking-[0.4em]"
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDisableOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={disableCode.length !== 6 || disable.isPending}>
                {disable.isPending && <Loader2 className="animate-spin" />} Disable MFA
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  )
}

// -------------------------------------------------------------------------------------------- admin users
function AdminsManager({ meId }: { meId?: string }) {
  const [creating, setCreating] = useState(false)
  const [toggling, setToggling] = useState<AdminMe | null>(null)
  const q = useQuery({ queryKey: ["admin", "admins"], queryFn: () => adminApi<AdminsResponse>("/admins") })
  const update = useAdminMutation<{ id: string; role?: AdminRole; is_active?: boolean }>({
    fn: ({ id, ...body }) => adminApi(`/admins/${id}`, { method: "PATCH", body }),
    success: (_d, v) => (v.role ? `Role changed to ${ROLE_LABELS[v.role]}` : v.is_active ? "Admin reactivated" : "Admin deactivated"),
    invalidate: [["admin", "admins"]],
  })

  return (
    <>
      <Panel
        title={<span className="inline-flex items-center gap-1.5"><UserCog className="size-3.5" /> Admin accounts</span>}
        description="Admins sign in at /admin/login with their own credentials. You can't change your own role or status."
        actions={<Button size="sm" onClick={() => setCreating(true)}><Plus /> New admin</Button>}
        bodyClassName="p-0"
      >
        {q.isPending ? (
          <div className="p-4"><CardSkeleton rows={4} /></div>
        ) : q.isError ? (
          <div className="p-4"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
        ) : q.data.admins.length === 0 ? (
          <div className="p-4"><EmptyState title="No admins" className="border-0" /></div>
        ) : (
          <TableCard className="rounded-none border-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>MFA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.admins.map((a) => {
                  const self = a.id === meId
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium text-white">{a.full_name || a.email}{self && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}</div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </TableCell>
                      <TableCell>
                        <Select value={a.role} onValueChange={(v) => update.mutate({ id: a.id, role: v as AdminRole })} disabled={self || update.isPending}>
                          <SelectTrigger size="sm" className="w-[150px] text-xs" aria-label={`Role for ${a.email}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{ADMIN_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{a.mfa_enabled ? <Pill color="green">On</Pill> : <Pill color="amber">Off</Pill>}</TableCell>
                      <TableCell>{a.is_active ? <Pill color="green">Active</Pill> : <Pill color="red">Deactivated</Pill>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(a.last_login_at)}</TableCell>
                      <TableCell className="text-right">
                        {!self && (
                          <Button variant={a.is_active ? "destructive" : "outline"} size="xs" onClick={() => setToggling(a)}>
                            {a.is_active ? "Deactivate" : "Reactivate"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </Panel>
      {q.data && (
        <Panel title="Role permissions" description="Enforced server-side on every admin endpoint">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(q.data.roles).map(([role, perms]) => (
              <div key={role} className="rounded-lg border p-3">
                <div className="mb-2 text-sm font-medium text-white">{ROLE_LABELS[role] || titleCase(role)}</div>
                <div className="flex flex-wrap gap-1">
                  {perms.includes("*") ? <Pill color="violet">Everything</Pill> : perms.map((p) => <code key={p} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{p}</code>)}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">{creating && <CreateAdminForm onDone={() => setCreating(false)} />}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.is_active ? "Deactivate admin?" : "Reactivate admin?"}
        description={toggling ? (toggling.is_active ? `${toggling.email} will be signed out and unable to access the admin console.` : `${toggling.email} will regain admin access with the ${ROLE_LABELS[toggling.role]} role.`) : undefined}
        confirmLabel={toggling?.is_active ? "Deactivate" : "Reactivate"}
        destructive={!!toggling?.is_active}
        pending={update.isPending}
        onConfirm={() => (toggling ? update.mutateAsync({ id: toggling.id, is_active: !toggling.is_active }) : Promise.resolve())}
      />
    </>
  )
}

function CreateAdminForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<AdminRole>("read_only")
  const [password, setPassword] = useState("")
  const create = useAdminMutation<Record<string, unknown>>({
    fn: (body) => adminApi("/admins", { method: "POST", body }),
    success: "Admin created — share the password through a secure channel",
    invalidate: [["admin", "admins"]],
    onSuccess: onDone,
  })
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const valid = emailOk && name.trim().length >= 1 && password.length >= 12
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (valid) create.mutate({ email: email.trim(), full_name: name.trim(), role, password }) }}>
      <DialogHeader>
        <DialogTitle>New admin</DialogTitle>
        <DialogDescription>They should enable MFA after their first sign-in.</DialogDescription>
      </DialogHeader>
      <Field label="Full name" htmlFor="na-name"><Input id="na-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus /></Field>
      <Field label="Email" htmlFor="na-email" error={email && !emailOk ? "Enter a valid email." : undefined}><Input id="na-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></Field>
      <Field label="Role">
        <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{ADMIN_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Initial password" htmlFor="na-pass" hint="At least 12 characters; strength rules are enforced by the server." error={password && password.length < 12 ? "Too short." : undefined}>
        <Input id="na-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={!valid || create.isPending}>{create.isPending && <Loader2 className="animate-spin" />} Create admin</Button>
      </DialogFooter>
    </form>
  )
}
