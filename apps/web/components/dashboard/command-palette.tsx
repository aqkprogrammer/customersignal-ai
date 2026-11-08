"use client"

import { useQuery } from "@tanstack/react-query"
import { FilePlus2, FolderKanban, Moon, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { ALL_NAV } from "@/components/dashboard/nav"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { api } from "@/lib/api"
import { useWorkspaceStore } from "@/stores/workspace"
import type { Page, Project } from "@/types/api"

export function CommandPalette() {
  const open = useWorkspaceStore((s) => s.commandOpen)
  const setOpen = useWorkspaceStore((s) => s.setCommandOpen)
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [search, setSearch] = useState("")

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(!useWorkspaceStore.getState().commandOpen)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [setOpen])

  const { data: projects } = useQuery({
    queryKey: ["projects", "palette", search],
    queryFn: () => api<Page<Project>>("/projects", { query: { q: search || undefined, page_size: 6 } }),
    enabled: open,
  })

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Search pages, projects and actions">
      <CommandInput placeholder="Search pages, projects, actions…" value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/app/reviews?import=1")}>
            <Upload /> Upload reviews
          </CommandItem>
          <CommandItem onSelect={() => go("/app/projects?new=1")}>
            <FolderKanban /> New project
          </CommandItem>
          <CommandItem onSelect={() => go("/app/reports?new=1")}>
            <FilePlus2 /> Generate AI report
          </CommandItem>
          <CommandItem onSelect={() => { setTheme(theme === "dark" ? "light" : "dark"); setOpen(false) }}>
            <Moon /> Toggle dark mode
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pages">
          {ALL_NAV.map((n) => (
            <CommandItem key={n.href} value={`${n.label} ${n.keywords || ""}`} onSelect={() => go(n.href)}>
              <n.icon /> {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {!!projects?.items.length && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.items.map((p) => (
                <CommandItem key={p.id} value={`project ${p.name} ${p.business_name || ""}`} onSelect={() => go(`/app/projects/${p.id}`)}>
                  <FolderKanban /> {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
