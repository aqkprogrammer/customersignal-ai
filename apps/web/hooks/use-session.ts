"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo } from "react"
import { api, ApiError, getActiveWorkspaceId, setActiveWorkspaceId } from "@/lib/api"
import { useWorkspaceStore } from "@/stores/workspace"
import type { Session, Workspace } from "@/types/api"

export function useSession() {
  const router = useRouter()
  const setWorkspaceId = useWorkspaceStore((s) => s.setWorkspaceId)
  const query = useQuery({
    queryKey: ["session"],
    queryFn: () => api<Session>("/auth/me", { noWorkspace: true }),
    staleTime: 60_000,
    // 4xx is final (401 → login). Network errors and 5xx usually mean the API is waking up: keep trying for ~1 min.
    retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 6,
    retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 15_000),
  })

  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`)
    }
  }, [query.error, router])

  // Keep the active workspace valid: stored choice → user default → first membership.
  useEffect(() => {
    const data = query.data
    if (!data) return
    const stored = getActiveWorkspaceId()
    const valid = data.workspaces.find((w) => w.id === stored)
    const next = valid?.id || data.user.default_workspace_id || data.workspaces[0]?.id || null
    if (next !== stored) setActiveWorkspaceId(next)
    setWorkspaceId(next)
  }, [query.data, setWorkspaceId])

  return query
}

export function useWorkspace(): {
  workspace: Workspace | undefined
  workspaces: Workspace[]
  switchWorkspace: (id: string) => Promise<void>
  can: (min: "viewer" | "analyst" | "admin" | "owner") => boolean
} {
  const { data } = useSession()
  const qc = useQueryClient()
  const workspaceId = useWorkspaceStore((s) => s.workspaceId)
  const setWorkspaceId = useWorkspaceStore((s) => s.setWorkspaceId)
  const workspaces = useMemo(() => data?.workspaces ?? [], [data])
  const workspace = workspaces.find((w) => w.id === workspaceId)
  const rank = { viewer: 0, analyst: 1, admin: 2, owner: 3 }

  const switchWorkspace = useCallback(
    async (id: string) => {
      setActiveWorkspaceId(id)
      setWorkspaceId(id)
      await api(`/workspaces/${id}/default`, { method: "POST", noWorkspace: true }).catch(() => null)
      // Every workspace-scoped query must refetch for the new tenant.
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" })
      await qc.invalidateQueries({ queryKey: ["session"] })
    },
    [qc, setWorkspaceId],
  )

  const can = useCallback(
    (min: keyof typeof rank) => (workspace?.role ? rank[workspace.role] >= rank[min] : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspace?.role],
  )

  return { workspace, workspaces, switchWorkspace, can }
}
