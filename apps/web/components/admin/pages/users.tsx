"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Users } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Pill, StatusBadge } from "@/components/shared/badges"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDebounced, usePaging } from "@/hooks/use-admin"
import { adminApi } from "@/lib/admin-api"
import type { AdminUserRow, Paged } from "@/lib/admin-types"
import { formatDate, timeAgo, titleCase } from "@/lib/utils"
import { FilterBar, FilterSelect, PageHeader, Pager, SearchBox, SortHead, TableCard, TableRowsSkeleton } from "../ui"
import { PLAN_OPTIONS } from "./shared"

type Sort = "created_desc" | "created_asc" | "last_active"

export function AdminUsers() {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [plan, setPlan] = useState("")
  const [verified, setVerified] = useState("")
  const [sort, setSort] = useState<Sort>("created_desc")
  const { page, pageSize, setPage, setPageSize } = usePaging()
  const search = useDebounced(q)

  const query = useQuery({
    queryKey: ["admin", "users", { search, status, plan, verified, sort, page, pageSize }],
    queryFn: () =>
      adminApi<Paged<AdminUserRow>>("/users", {
        query: { q: search, status, plan, verified, sort, page, page_size: pageSize },
      }),
    placeholderData: keepPreviousData,
  })

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(1)
  }

  return (
    <>
      <PageHeader eyebrow="Customers" title="Users" description="Search, inspect and manage every customer account." />
      <FilterBar>
        <SearchBox value={q} onChange={reset(setQ)} placeholder="Search email, name, company…" />
        <FilterSelect
          label="Status"
          value={status}
          onChange={reset(setStatus)}
          options={["active", "suspended", "banned"].map((s) => ({ value: s, label: titleCase(s) }))}
        />
        <FilterSelect label="Plan" value={plan} onChange={reset(setPlan)} options={PLAN_OPTIONS} />
        <FilterSelect
          label="Email"
          value={verified}
          onChange={reset(setVerified)}
          options={[
            { value: "true", label: "Verified" },
            { value: "false", label: "Unverified" },
          ]}
        />
      </FilterBar>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <TableCard
          footer={
            query.data && (
              <Pager page={page} pageSize={pageSize} total={query.data.total} onPage={setPage} onPageSize={setPageSize} fetching={query.isFetching} />
            )
          }
        >
          {query.isPending ? (
            <TableRowsSkeleton cols={6} />
          ) : query.data.items.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Users} title="No users match" description="Try a different search or clear the filters." className="border-0" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Email</TableHead>
                  <SortHead label="Last active" active={sort === "last_active"} dir="desc" onClick={() => { setSort("last_active"); setPage(1) }} />
                  <SortHead
                    label="Joined"
                    active={sort !== "last_active"}
                    dir={sort === "created_asc" ? "asc" : "desc"}
                    onClick={() => {
                      setSort(sort === "created_desc" ? "created_asc" : "created_desc")
                      setPage(1)
                    }}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((u) => (
                  <TableRow key={u.id} className="hover:bg-surface-hover">
                    <TableCell className="max-w-[280px]">
                      <Link href={`/admin/users/${u.id}`} className="block min-w-0">
                        <div className="truncate font-medium text-foreground hover:text-signal-600">{u.full_name || u.email}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {u.email}
                          {u.company_name && ` · ${u.company_name}`}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.status} />
                    </TableCell>
                    <TableCell>
                      <Pill color={u.plan === "free" ? "gray" : "signal"}>{titleCase(u.plan)}</Pill>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {u.email_verified ? <Pill color="green">Verified</Pill> : <Pill color="amber">Unverified</Pill>}
                        {u.google && <Pill color="sky">Google</Pill>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(u.last_active_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}
    </>
  )
}
