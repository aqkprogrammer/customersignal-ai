"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Bell,
  Check,
  ChevronsUpDown,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  User,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { LogoMark } from "@/components/brand/logo"
import { CommandPalette } from "@/components/dashboard/command-palette"
import { NAV_SECTIONS, navLabel } from "@/components/dashboard/nav"
import { DemoBadge } from "@/components/shared/states"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSession, useWorkspace } from "@/hooks/use-session"
import { api, errorMessage, setActiveWorkspaceId } from "@/lib/api"
import { cn, initials, timeAgo, titleCase } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace"
import type { Notification, Workspace } from "@/types/api"

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          {!collapsed && <p className="mb-1.5 px-2 text-[11px] font-medium tracking-wider text-muted-foreground/80 uppercase">{section.title}</p>}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href)
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active && "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--primary)]",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <item.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
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

function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { workspace, workspaces, switchWorkspace } = useWorkspace()
  const qc = useQueryClient()
  const router = useRouter()
  const demo = useMutation({
    mutationFn: () => api<Workspace>("/workspaces/demo", { method: "POST", noWorkspace: true }),
    onSuccess: async (ws) => {
      await qc.invalidateQueries({ queryKey: ["session"] })
      await switchWorkspace(ws.id)
      router.push("/app")
      toast.success("Demo workspace ready — it contains synthetic sample data.")
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const hasDemo = workspaces.some((w) => w.is_demo)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border bg-background/60 p-2 text-left transition-colors hover:bg-muted",
            collapsed && "justify-center border-transparent bg-transparent",
          )}
          aria-label="Switch workspace"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-semibold text-white">
            {initials(workspace?.name)}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{workspace?.name || "Loading…"}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {workspace?.is_demo ? "Demo data" : titleCase(workspace?.role || "")}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => switchWorkspace(w.id)} className="gap-2">
            <span className="flex size-6 items-center justify-center rounded bg-muted text-[10px] font-semibold">{initials(w.name)}</span>
            <span className="flex-1 truncate">{w.name}</span>
            {w.is_demo && <DemoBadge />}
            {w.id === workspace?.id && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {!hasDemo && (
          <DropdownMenuItem onSelect={() => demo.mutate()} disabled={demo.isPending}>
            <Sparkles /> Open demo workspace
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/app/settings?tab=workspaces">
            <Plus /> Create workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationsBell() {
  const qc = useQueryClient()
  const router = useRouter()
  const { data } = useQuery({
    queryKey: ["notifications", "bell"],
    queryFn: () => api<{ items: Notification[]; unread_count: number }>("/notifications", { query: { page_size: 8 }, noWorkspace: true }),
    refetchInterval: 30_000,
  })
  const markAll = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST", noWorkspace: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  })
  const open = async (n: Notification) => {
    if (!n.read) await api(`/notifications/${n.id}/read`, { method: "POST", noWorkspace: true }).catch(() => null)
    qc.invalidateQueries({ queryKey: ["notifications"] })
    if (n.workspace_id) setActiveWorkspaceId(n.workspace_id)
    if (n.link) router.push(n.link)
  }
  const unread = data?.unread_count ?? 0
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-4 font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button className="text-xs text-primary hover:underline" onClick={() => markAll.mutate()}>
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!data?.items.length ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            data.items.map((n) => (
              <button key={n.id} onClick={() => open(n)} className="flex w-full gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/60">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{n.title}</span>
                  {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/app/settings?tab=notifications">Notification preferences</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function UserMenu() {
  const { data } = useSession()
  const router = useRouter()
  const qc = useQueryClient()
  const { theme, setTheme } = useTheme()
  const user = data?.user
  async function logout() {
    await api("/auth/logout", { method: "POST", noWorkspace: true }).catch(() => null)
    setActiveWorkspaceId(null)
    qc.clear()
    router.replace("/login")
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" aria-label="Account menu">
          <Avatar className="size-8">
            {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
            <AvatarFallback className="bg-accent text-xs font-semibold text-primary">{initials(user?.full_name || user?.email)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user?.full_name || "Your account"}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings"><User /> Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/settings?tab=workspace"><Settings /> Workspace settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun /> : <Moon />} {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} variant="destructive">
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Crumbs() {
  const pathname = usePathname()
  const label = navLabel(pathname)
  const isRoot = pathname === "/app"
  const depth = pathname.split("/").filter(Boolean).length
  return (
    <Breadcrumb className="hidden md:block">
      <BreadcrumbList>
        <BreadcrumbItem>
          {isRoot ? <BreadcrumbPage>Overview</BreadcrumbPage> : <BreadcrumbLink asChild><Link href="/app">Home</Link></BreadcrumbLink>}
        </BreadcrumbItem>
        {!isRoot && label && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {depth > 2 ? (
                <BreadcrumbLink asChild>
                  <Link href={`/${pathname.split("/").slice(1, 3).join("/")}`}>{label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {depth > 2 && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage>Details</BreadcrumbPage></BreadcrumbItem>
              </>
            )}
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, isLoading } = useSession()
  const { workspace } = useWorkspace()
  const router = useRouter()
  const collapsed = useWorkspaceStore((s) => s.sidebarCollapsed)
  const toggle = useWorkspaceStore((s) => s.toggleSidebar)
  const setCommandOpen = useWorkspaceStore((s) => s.setCommandOpen)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem("cs_sidebar_collapsed") === "1" && !useWorkspaceStore.getState().sidebarCollapsed) toggle()
    } catch {
      /* ignore */
    }
  }, [toggle])

  useEffect(() => {
    if (session && !session.user.onboarding_completed) router.replace("/onboarding")
  }, [session, router])

  const { data: announcements } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api<{ id: string; title: string; body: string; level: string }[]>("/public/announcements", { noWorkspace: true }),
    staleTime: 300_000,
  })

  if (isLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LogoMark className="size-9 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 lg:flex",
          collapsed ? "w-[68px]" : "w-[248px]",
        )}
      >
        <div className={cn("flex h-14 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
          <Link href="/app" className="flex items-center gap-2 font-semibold" aria-label="Overview">
            <LogoMark />
            {!collapsed && (
              <span className="text-[15px] tracking-tight">
                CustomerSignal<span className="text-primary"> AI</span>
              </span>
            )}
          </Link>
        </div>
        <div className="px-3">
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>
        <SidebarNav collapsed={collapsed} />
        <div className="border-t p-3">
          <Button variant="ghost" size="sm" className={cn("w-full justify-start text-muted-foreground", collapsed && "justify-center")} onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen /> : <><PanelLeftClose /> Collapse</>}
          </Button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[272px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center px-4">
            <LogoMark />
          </div>
          <div className="px-3">
            <WorkspaceSwitcher collapsed={false} />
          </div>
          <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="size-4" />
          </Button>
          <Crumbs />
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setCommandOpen(true)}
              className="hidden h-8 w-64 items-center gap-2 rounded-lg border bg-card px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/30 sm:flex"
            >
              <Search className="size-3.5" /> Search or jump to…
              <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
            </button>
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setCommandOpen(true)} aria-label="Search">
              <Search className="size-4" />
            </Button>
            <NotificationsBell />
            <UserMenu />
          </div>
        </header>
        {workspace?.is_demo && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-[13px] text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            <strong>Demo workspace:</strong> all reviews here are synthetic sample data, not real customer feedback.
          </div>
        )}
        {announcements?.slice(0, 1).map((a) => (
          <div key={a.id} className="border-b bg-accent/60 px-6 py-2 text-[13px] text-accent-foreground">
            <strong>{a.title}</strong> — {a.body}
          </div>
        ))}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <CommandPalette />
    </div>
  )
}
