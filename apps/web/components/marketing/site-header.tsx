"use client"

import { ArrowRight, BookOpen, ChevronDown, LifeBuoy, Menu, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "motion/react"
import { useEffect, useState } from "react"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { FEATURES } from "./features-data"
import { SOLUTIONS } from "./site-data"

const RESOURCES = [
  { href: "/blog", label: "Blog", short: "Guides on review analysis and customer research.", icon: BookOpen },
  { href: "/security", label: "Security", short: "How we protect data and access reviews legitimately.", icon: ShieldCheck },
  { href: "/contact", label: "Contact & support", short: "Talk to sales or get help from our team.", icon: LifeBuoy },
]

const linkBase =
  "relative isolate inline-flex h-9 items-center gap-1 rounded-full px-3.5 text-[14.5px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none data-[state=open]:text-foreground"

function ActivePill({ on }: { on: boolean }) {
  if (!on) return null
  return (
    <motion.span
      layoutId="site-nav-pill"
      aria-hidden
      className="absolute inset-0 -z-10 rounded-full bg-foreground/[0.06]"
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
    />
  )
}

function MegaItem({ href, icon: Icon, title, body, tone = "#4169F5" }: { href: string; icon: React.ElementType; title: string; body: string; tone?: string }) {
  return (
    <DropdownMenuItem asChild className="items-start gap-3 rounded-xl p-3 focus:bg-[#f4f3ef]">
      <Link href={href}>
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${tone}14`, color: tone }}>
          <Icon aria-hidden className="size-[18px]" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[14px] font-semibold text-foreground">{title}</span>
          <span className="text-[13px] leading-snug text-muted-foreground">{body}</span>
        </span>
      </Link>
    </DropdownMenuItem>
  )
}

const TONES = ["#4169F5", "#FF8757", "#5E9E1F", "#2E7FD0", "#4169F5", "#FF8757", "#2E7FD0"]

/** Reads the pathname for active-link styling. Render inside <Suspense fallback={<SiteHeader />}>. */
export function SiteHeaderWithPath() {
  const pathname = usePathname()
  return <SiteHeader pathname={pathname} />
}

export function SiteHeader({ pathname = null }: { pathname?: string | null }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const isActive = (href: string) => !!pathname && (pathname === href || pathname.startsWith(`${href}/`))
  const resActive = RESOURCES.some((r) => isActive(r.href))

  return (
    <header className="sticky top-0 z-40 w-full px-3 pt-3 sm:px-5">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div
        className={cn(
          "mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between gap-4 rounded-full border pr-2 pl-5 transition-[background-color,border-color,box-shadow] duration-300",
          scrolled
            ? "border-border bg-white/80 shadow-[0_10px_30px_-18px_rgb(23_32_51/0.35)] backdrop-blur-md supports-backdrop-filter:bg-white/70"
            : "border-transparent bg-transparent",
        )}
      >
        <Logo />

        <nav aria-label="Main" className="relative hidden items-center gap-0.5 md:flex">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className={cn(linkBase, "group", isActive("/features") && "text-foreground")}>
              <ActivePill on={isActive("/features")} />
              Product <ChevronDown aria-hidden className="size-3.5 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={14} className="w-[38rem] rounded-2xl border-border bg-white p-2 shadow-[0_24px_60px_-24px_rgb(23_32_51/0.35)]">
              <div className="grid grid-cols-2 gap-0.5">
                {FEATURES.map((f, i) => (
                  <MegaItem key={f.id} href={`/features#${f.id}`} icon={f.icon} title={f.name} body={f.tagline} tone={TONES[i % TONES.length]} />
                ))}
                <DropdownMenuItem asChild className="items-center justify-between rounded-xl bg-[#101B35] p-3 text-white focus:bg-[#17243B] focus:text-white">
                  <Link href="/features">
                    <span className="text-[14px] font-semibold">Explore the platform</span>
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className={cn(linkBase, "group", isActive("/solutions") && "text-foreground")}>
              <ActivePill on={isActive("/solutions")} />
              Solutions <ChevronDown aria-hidden className="size-3.5 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={14} className="w-[24rem] rounded-2xl border-border bg-white p-2 shadow-[0_24px_60px_-24px_rgb(23_32_51/0.35)]">
              {SOLUTIONS.map((s, i) => (
                <MegaItem key={s.slug} href={`/solutions/${s.slug}`} icon={s.icon} title={s.name} body={s.short} tone={TONES[(i + 1) % TONES.length]} />
              ))}
              <DropdownMenuItem asChild className="mt-1 justify-between rounded-xl px-3 py-2.5 text-[14px] font-semibold text-[#2f52dd]">
                <Link href="/solutions">
                  All solutions <ArrowRight aria-hidden className="size-4" />
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/pricing" className={cn(linkBase, isActive("/pricing") && "text-foreground")}>
            <ActivePill on={isActive("/pricing")} />
            Pricing
          </Link>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className={cn(linkBase, "group", resActive && "text-foreground")}>
              <ActivePill on={resActive} />
              Resources <ChevronDown aria-hidden className="size-3.5 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={14} className="w-[22rem] rounded-2xl border-border bg-white p-2 shadow-[0_24px_60px_-24px_rgb(23_32_51/0.35)]">
              {RESOURCES.map((r, i) => (
                <MegaItem key={r.href} href={r.href} icon={r.icon} title={r.label} body={r.short} tone={TONES[i + 1]} />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/about" className={cn(linkBase, isActive("/about") && "text-foreground")}>
            <ActivePill on={isActive("/about")} />
            About
          </Link>
        </nav>

        <div className="hidden items-center gap-1.5 md:flex">
          <Button asChild variant="ghost" className="h-10 rounded-full px-4 text-[14.5px]">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild className="h-10 rounded-full px-5 text-[14.5px]">
            <Link href="/signup">
              Start free <ArrowRight data-arrow aria-hidden className="size-4" />
            </Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="size-10 rounded-full md:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[88%] max-w-sm gap-0 bg-[#F7F6F2] p-0">
            <SheetHeader className="border-b p-5">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Site navigation</SheetDescription>
              <Logo />
            </SheetHeader>
            <nav
              aria-label="Mobile"
              className="flex flex-1 flex-col overflow-y-auto p-4"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) setOpen(false)
              }}
            >
              <p className="px-3 pb-1 text-[12px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">Product</p>
              {FEATURES.slice(0, 5).map((f) => (
                <MobileLink key={f.id} href={`/features#${f.id}`}>
                  <f.icon aria-hidden className="size-4 text-[#4169F5]" /> {f.name}
                </MobileLink>
              ))}
              <MobileLink href="/features">All features</MobileLink>
              <p className="mt-5 px-3 pb-1 text-[12px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">Solutions</p>
              {SOLUTIONS.map((s) => (
                <MobileLink key={s.slug} href={`/solutions/${s.slug}`}>
                  <s.icon aria-hidden className="size-4 text-[#FF8757]" /> {s.name}
                </MobileLink>
              ))}
              <div className="my-4 h-px bg-border" />
              <MobileLink href="/pricing">Pricing</MobileLink>
              {RESOURCES.map((r) => (
                <MobileLink key={r.href} href={r.href}>
                  {r.label}
                </MobileLink>
              ))}
              <MobileLink href="/about">About</MobileLink>
            </nav>
            <div className="grid gap-2 border-t p-4">
              <Button asChild className="h-12 rounded-full text-base">
                <Link href="/signup" onClick={() => setOpen(false)}>
                  Start free
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full text-base">
                <Link href="/login" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[16px] font-medium text-foreground hover:bg-white focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
    >
      {children}
    </Link>
  )
}
