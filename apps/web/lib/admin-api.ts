import { api, ApiError } from "@/lib/api"

type AdminOptions = Omit<NonNullable<Parameters<typeof api>[1]>, "noWorkspace">

export const ADMIN_LOGIN_PATH = "/admin/login"

/**
 * Admin API client: every call goes to /api/v1/admin/*, never sends the workspace header, and bounces to the admin
 * login page when the admin session is missing/expired (except for the login call itself, which uses 401 for
 * wrong credentials / MFA codes).
 */
export async function adminApi<T = unknown>(path: string, opts: AdminOptions = {}): Promise<T> {
  const full = `/admin${path.startsWith("/") ? path : `/${path}`}`
  try {
    return await api<T>(full, { ...opts, noWorkspace: true, noRefresh: true })
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.status === 401 &&
      !path.startsWith("/auth/login") &&
      typeof window !== "undefined" &&
      window.location.pathname !== ADMIN_LOGIN_PATH
    ) {
      window.location.replace(ADMIN_LOGIN_PATH)
    }
    throw err
  }
}

/** Render API validation details (422) or the error message as a single toast-friendly string. */
export function adminErrorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (err instanceof ApiError) {
    if (Array.isArray(err.details) && err.details.length) {
      const first = err.details[0] as { field?: string; message?: string }
      if (first?.message) return first.field ? `${first.field}: ${first.message}` : first.message
    }
    return err.message || fallback
  }
  if (err instanceof Error) return err.message
  return fallback
}

export function can(permissions: string[] | undefined, permission: string) {
  if (!permissions) return false
  return permissions.includes("*") || permissions.includes(permission)
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  support_admin: "Support admin",
  billing_admin: "Billing admin",
  read_only: "Read only",
}

export function dollarsToCents(v: string): number | null {
  const n = Number(v)
  if (v.trim() === "" || Number.isNaN(n) || n < 0) return null
  return Math.round(n * 100)
}

export function centsToDollars(c: number | null | undefined): string {
  if (c === null || c === undefined) return ""
  return (c / 100).toFixed(2).replace(/\.00$/, "")
}

export function formatUsd(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 4) }).format(n)
}

/** "2026-03" → "Mar 26"; "2026-03-14" → "Mar 14". */
export function shortPeriod(v: string) {
  if (/^\d{4}-\d{2}$/.test(v)) {
    const [y, m] = v.split("-").map(Number)
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(`${v.slice(0, 10)}T00:00:00Z`)
    return d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
  }
  return v
}

export function formatDateTime(v: string | null | undefined) {
  if (!v) return "—"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
}
