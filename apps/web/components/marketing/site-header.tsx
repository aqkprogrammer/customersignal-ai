"use client"

import { ArrowRight, ChevronDown, Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "motion/react"
import { useEffect, useState } from "react"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { PRIMARY_NAV, SOLUTIONS } from "./site-data"

const linkBase =
  "relative rounded-md px-3 py-2 text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"

/** Active-route indicator: a lit hairline that glides between items (shared layout animation). */
function ActiveMark({ on }: { on: boolean }) {
  if (!on) return null
  return (
    <motion.span
      layoutId="site-nav-active"
      aria-hidden
      className="absolute inset-x-3 -bottom-[14px] h-px bg-signal shadow-[0_0_10px_var(--signal)]"
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
    />
  )
}

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

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled
          ? "border-border bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/65"
          : "border-transparent bg-transparent",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-0.5 md:flex">
          <Link href="/features" className={cn(linkBase, isActive("/features") && "text-foreground")}>
            Features
            <ActiveMark on={isActive("/features")} />
          </Link>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              className={cn(linkBase, "group inline-flex items-center gap-1 data-[state=open]:text-foreground", isActive("/solutions") && "text-foreground")}
            >
              Solutions <ChevronDown aria-hidden className="size-3.5 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              <ActiveMark on={isActive("/solutions")} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={10} className="w-[22rem] rounded-lg border-border-strong p-1.5 dark:bg-popover/95 dark:backdrop-blur-md">
              {SOLUTIONS.map((s) => (
                <DropdownMenuItem key={s.slug} asChild className="items-start gap-3 rounded-lg p-2.5">
                  <Link href={`/solutions/${s.slug}`}>
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border-strong text-signal">
                      <s.icon aria-hidden className="size-4" />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">{s.name}</span>
                      <span className="text-xs leading-snug text-muted-foreground">{s.short}</span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="justify-between rounded-lg px-2.5 py-2 text-sm font-medium">
                <Link href="/solutions">
                  All solutions <ArrowRight aria-hidden className="size-4" />
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {PRIMARY_NAV.filter((n) => n.href !== "/features").map((n) => (
            <Link key={n.href} href={n.href} className={cn(linkBase, isActive(n.href) && "text-foreground")}>
              {n.label}
              <ActiveMark on={isActive(n.href)} />
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" className="h-9 px-3 text-[13.5px] text-muted-foreground">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="signal" className="h-9 rounded-lg px-4">
            <Link href="/signup">
              Start free <ArrowRight data-arrow aria-hidden className="size-4" />
            </Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[86%] max-w-sm gap-0 p-0">
            <SheetHeader className="border-b p-5">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Site navigation</SheetDescription>
              <Logo />
            </SheetHeader>
            <nav aria-label="Mobile" className="flex flex-1 flex-col overflow-y-auto p-3" onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false)
            }}>
              <MobileLink href="/features">Features</MobileLink>
              <p className="mt-4 mb-1 px-3 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Solutions</p>
              {SOLUTIONS.map((s) => (
                <MobileLink key={s.slug} href={`/solutions/${s.slug}`}>
                  <s.icon aria-hidden className="size-4 text-primary" /> {s.name}
                </MobileLink>
              ))}
              <MobileLink href="/solutions">All solutions</MobileLink>
              <div className="my-3 h-px bg-border" />
              {PRIMARY_NAV.filter((n) => n.href !== "/features").map((n) => (
                <MobileLink key={n.href} href={n.href}>
                  {n.label}
                </MobileLink>
              ))}
              <MobileLink href="/contact">Contact</MobileLink>
            </nav>
            <div className="grid gap-2 border-t p-4">
              <Button asChild className="h-11 text-base">
                <Link href="/signup" onClick={() => setOpen(false)}>
                  Start free
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 text-base">
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
      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] font-medium text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </Link>
  )
}
