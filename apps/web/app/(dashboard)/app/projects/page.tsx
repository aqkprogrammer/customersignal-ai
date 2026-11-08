"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, ArchiveRestore, FolderKanban, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog, PageHeader, Pagination } from "@/components/dashboard/primitives"
import { ProjectDialog } from "@/components/dashboard/project-form"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { DemoBadge, EmptyState, ErrorState, TableSkeleton } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useWorkspace } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { INDUSTRIES } from "@/lib/site"
import { formatDate, formatNumber, titleCase } from "@/lib/utils"
import type { Page, Project } from "@/types/api"

const KIND_LABEL: Record<string, string> = { standard: "Review analysis", opportunity_finder: "Opportunity finder", gap_finder: "Gap finder" }

export default function Page() {
  return (
    <Suspense>
      <ProjectsPage />
    </Suspense>
  )
}

function ProjectsPage() {
  const params = useSearchParams()
  const qc = useQueryClient()
  const { can } = useWorkspace()
  const [q, setQ] = useState("")
  const [debounced, setDebounced] = useState("")
  const [status, setStatus] = useState("active")
  const [industry, setIndustry] = useState("all")
  const [sort, setSort] = useState("created_desc")
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<{ open: boolean; project?: Project | null }>({ open: params.get("new") === "1" })
  const [confirm, setConfirm] = useState<Project | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(q); setPage(1) }, 250)
    return () => clearTimeout(t)
  }, [q])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["projects", "list", debounced, status, industry, sort, page],
    queryFn: () => api<Page<Project>>("/projects", { query: { q: debounced, status, industry: industry === "all" ? undefined : industry, sort, page, page_size: 20 } }),
    placeholderData: keepPreviousData,
  })

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "archive" | "unarchive" | "delete" }) =>
      action === "delete" ? api(`/projects/${id}`, { method: "DELETE" }) : api(`/projects/${id}/${action}`, { method: "POST" }),
    onSuccess: (_, v) => {
      toast.success(v.action === "delete" ? "Project deleted" : v.action === "archive" ? "Project archived" : "Project restored")
      qc.invalidateQueries({ queryKey: ["projects"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project holds the reviews for one business, location or product, plus its competitors."
        actions={can("analyst") && <Button onClick={() => setDialog({ open: true })}><Plus /> New project</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…" className="pl-8" aria-label="Search projects" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-[140px]" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={industry} onValueChange={(v) => { setIndustry(v); setPage(1) }}>
          <SelectTrigger className="w-[170px]" aria-label="Industry"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All industries</SelectItem>
            {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[160px]" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">Newest first</SelectItem>
            <SelectItem value="created_asc">Oldest first</SelectItem>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton />
      ) : !data?.items.length ? (
        <EmptyState icon={FolderKanban} title={debounced || status !== "active" || industry !== "all" ? "No matching projects" : "No projects yet"}
          description="Create a project, then upload a review dataset to start the analysis."
          action={can("analyst") && <Button onClick={() => setDialog({ open: true })}><Plus /> Create your first project</Button>} />
      ) : (
        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Industry</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead className="text-right">Reviews</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/app/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {p.business_name}{p.is_demo && <DemoBadge />}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell"><Pill>{KIND_LABEL[p.kind]}</Pill></TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{p.industry || "—"}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{[p.city, p.country].filter(Boolean).join(", ") || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(p.stats?.total ?? 0)}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{formatDate(p.created_at)}</TableCell>
                  <TableCell>
                    {can("analyst") && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setDialog({ open: true, project: p })}><Pencil /> Edit</DropdownMenuItem>
                          {p.status === "archived" ? (
                            <DropdownMenuItem onSelect={() => act.mutate({ id: p.id, action: "unarchive" })}><ArchiveRestore /> Restore</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => act.mutate({ id: p.id, action: "archive" })}><Archive /> Archive</DropdownMenuItem>
                          )}
                          {can("admin") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(p)}><Trash2 /> Delete</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {data && <Pagination page={page} pageSize={data.page_size} total={data.total} onPage={setPage} />}

      <ProjectDialog open={dialog.open} project={dialog.project} onOpenChange={(open) => setDialog({ open })} />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete "${confirm?.name}"?`}
        description="The project, its reviews and analysis results will be removed from this workspace. This can't be undone from the app."
        confirmLabel="Delete project"
        destructive
        onConfirm={() => (confirm ? act.mutateAsync({ id: confirm.id, action: "delete" }) : undefined)}
      />
      <span className="sr-only">{titleCase(status)}</span>
    </>
  )
}
