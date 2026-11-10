"use client"

import { useQueryClient } from "@tanstack/react-query"
import { motion } from "motion/react"
import { ChevronsLeft, ChevronsRight, KeyRound, Loader2, LogOut, Menu, ShieldAlert, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { LogoMark } from "@/components/brand/logo"
import { ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAdminMe, useCan } from "@/hooks/use-admin"
import { adminApi, adminErrorMessage, ROLE_LABELS } from "@/lib/admin-api"
import type { AdminMe } from "@/lib/admin-types"
import { cn, initials } from "@/lib/utils"
import { ADMIN_NAV, type NavSection } from "./nav"

function useVisibleNav(): NavSection[] {
  const can = useCan()
  return ADMIN_NAV.map((s) => ({ ...s, items: s.items.filter((i) => can(i.permission)) })).filter((s) => s.items.length)
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const sections = useVisibleNav()
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3" aria-label="Admin">
      {sections.map((section) => (
        <div key={section.title}>
          {!collapsed && (
            <div className="px-2 pb-1 font-mono text-[10px] tracking-[0.16em] text-subtle-foreground uppercase">{section.title}</div>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href)
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white",
                    active && "text-white",
                    collapsed && "justify-center px-0",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId={collapsed ? "admin-nav-active-c" : "admin-nav-active"}
                      aria-hidden
                      className="absolute inset-0 rounded-md bg-sidebar-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--signal)_18%,transparent)]"
                      transition={{ type: "spring", stiffness: 420, damping: 38 }}
                    >
                      <span className="absolute inset-y-1.5 left-0 w-px bg-signal shadow-[0_0_8px_var(--signal)]" />
                    </motion.span>
                  )}
                  <item.icon className={cn("relative size-4 shrink-0", active ? "text-signal" : "text-sidebar-foreground/60 group-hover:text-signal-200")} />
                  {!collapsed && <span className="relative truncate">{item.label}</span>}
                </Link>
              )
              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/admin/dashboard" className={cn("flex items-center gap-2", collapsed && "justify-center")} aria-label="Admin overview">
      <LogoMark className="size-7" />
      {!collapsed && (
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold text-white">CustomerSignal</span>
          <span className="block font-mono text-[9.5px] tracking-[0.16em] text-signal/80 uppercase">Command centre</span>
        </span>
      )}
    </Link>
  )
}

function RoleBadge({ role }: { role: string }) {
  const tone =
    role === "super_admin"
      ? "bg-ice-500/15 text-ice-200 ring-ice-400/30"
      : role === "billing_admin"
        ? "bg-sky-500/15 text-sky-200 ring-sky-400/30"
        : role === "support_admin"
          ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
          : "bg-slate-500/15 text-slate-200 ring-slate-400/30"
  return <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset", tone)}>{ROLE_LABELS[role] || role}</span>
}

function MfaBadge({ enabled }: { enabled: boolean }) {
  return (
    <Link
      href="/admin/admins#security"
      className={cn(
        "hidden items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset sm:inline-flex",
        enabled ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25" : "bg-amber-500/10 text-amber-300 ring-amber-400/30",
      )}
      title={enabled ? "Two-factor authentication is on" : "Two-factor authentication is off — set it up"}
    >
      {enabled ? <ShieldCheck className="size-3" /> : <ShieldAlert className="size-3" />}
      {enabled ? "MFA on" : "MFA off"}
    </Link>
  )
}

function UserMenu({ me }: { me: AdminMe }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [pending, setPending] = useState(false)
  const logout = async () => {
    setPending(true)
    try {
      await adminApi("/auth/logout", { method: "POST" })
    } catch (err) {
      toast.error(adminErrorMessage(err))
    } finally {
      qc.clear()
      router.replace("/admin/login")
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          <span className="flex size-7 items-center justify-center rounded-md border border-[color-mix(in_oklab,var(--signal)_40%,transparent)] font-mono text-[11px] text-signal">
            {initials(me.full_name || me.email)}
          </span>
          <span className="hidden max-w-[160px] leading-tight md:block">
            <span className="block truncate text-xs font-medium text-white">{me.full_name || me.email}</span>
            <span className="block truncate text-[10px] text-muted-foreground">{me.email}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1">
          <div className="truncate text-xs font-medium">{me.email}</div>
          <RoleBadge role={me.role} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin/admins#security">
            <KeyRound /> Security & MFA
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void logout() }} disabled={pending} variant="destructive">
          {pending ? <Loader2 className="animate-spin" /> : <LogOut />} Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-60 border-r bg-sidebar/80 p-4 lg:block">
        <Skeleton className="h-7 w-36" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="h-8 w-56" />
        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function AdminShellFallback() {
  return <ShellSkeleton />
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const me = useAdminMe()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  if (me.isPending) return <ShellSkeleton />
  if (me.isError || !me.data) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <ErrorState error={me.error} onRetry={() => me.refetch()} className="max-w-md" />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar/85 backdrop-blur transition-[width] duration-200 lg:flex",
          collapsed ? "w-[60px]" : "w-60",
        )}
      >
        <div className={cn("flex h-14 items-center border-b border-sidebar-border px-3", collapsed && "justify-center px-0")}>
          <Brand collapsed={collapsed} />
        </div>
        <NavList collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full justify-start text-xs text-sidebar-foreground/70", collapsed && "justify-center")}
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight /> : <><ChevronsLeft /> Collapse</>}
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="h-14 justify-center border-b border-sidebar-border px-3">
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
            <SheetDescription className="sr-only">Navigate the admin console</SheetDescription>
            <Brand />
          </SheetHeader>
          <NavList onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/75 px-3 backdrop-blur-md sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <div className="flex items-center gap-2 lg:hidden">
            <LogoMark className="size-6" />
          </div>
          <div className="hidden items-center gap-2 font-mono text-[10.5px] tracking-[0.14em] text-subtle-foreground uppercase sm:flex">
            <span className="size-1.5 rounded-full bg-mint shadow-[0_0_8px_var(--mint)]" />
            Secure admin session
          </div>
          <div className="ml-auto flex items-center gap-2">
            <RoleBadge role={me.data.role} />
            <MfaBadge enabled={me.data.mfa_enabled} />
            <UserMenu me={me.data} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-5 sm:px-5 lg:px-6">{children}</main>
      </div>
    </div>
  )
}
