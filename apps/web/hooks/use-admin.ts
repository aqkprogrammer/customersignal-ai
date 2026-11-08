"use client"

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { adminApi, adminErrorMessage, can } from "@/lib/admin-api"
import type { AdminMe } from "@/lib/admin-types"

export const ME_KEY = ["admin", "me"] as const

export function useAdminMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => adminApi<AdminMe>("/auth/me"),
    staleTime: 60_000,
    retry: false,
  })
}

/** Permission check against the signed-in admin's permission list ("*" = everything). UX only — the API enforces. */
export function useCan() {
  const { data } = useAdminMe()
  const perms = data?.permissions
  return useCallback((permission: string) => can(perms, permission), [perms])
}

type MutationArgs<TVars, TData> = {
  fn: (vars: TVars) => Promise<TData>
  success?: string | ((data: TData, vars: TVars) => string | null)
  invalidate?: QueryKey[]
  onSuccess?: (data: TData, vars: TVars) => void
}

/** useMutation with standard toasts and cache invalidation. */
export function useAdminMutation<TVars = void, TData = unknown>({ fn, success, invalidate, onSuccess }: MutationArgs<TVars, TData>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data, vars) => {
      const msg = typeof success === "function" ? success(data, vars) : success
      if (msg) toast.success(msg)
      await Promise.all((invalidate || []).map((key) => qc.invalidateQueries({ queryKey: key })))
      onSuccess?.(data, vars)
    },
    onError: (err) => {
      toast.error(adminErrorMessage(err))
    },
  })
}

/** Debounced copy of a value (search boxes). */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Page/page_size state that resets to page 1 whenever any of `deps` change. */
export function usePaging(initialSize = 25) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialSize)
  const setPageSize = useCallback((n: number) => {
    setPageSizeState(n)
    setPage(1)
  }, [])
  return { page, pageSize, setPage, setPageSize }
}
