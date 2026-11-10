/**
 * Typed fetch client for the FastAPI backend. Requests go to same-origin /api/v1/* (proxied by Next rewrites),
 * so the backend's httpOnly session cookies just work. Adds the CSRF header + active workspace header and
 * transparently refreshes an expired access token once.
 */
export class ApiError extends Error {
  status: number
  code: string
  details: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const API_BASE = "/api/v1"
const WORKSPACE_KEY = "cs_workspace_id"

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

export function getActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(WORKSPACE_KEY)
  } catch {
    return null
  }
}

export function setActiveWorkspaceId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(WORKSPACE_KEY, id)
    else window.localStorage.removeItem(WORKSPACE_KEY)
  } catch {
    /* storage unavailable */
  }
}

async function ensureCsrf(): Promise<string | null> {
  let token = readCookie("cs_csrf")
  if (!token) {
    await fetch(`${API_BASE}/auth/providers`, { credentials: "same-origin" }).catch(() => null)
    token = readCookie("cs_csrf")
  }
  return token
}

type Options = Omit<RequestInit, "body"> & {
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  /** Skip the X-Workspace-Id header (auth/user-level endpoints). */
  noWorkspace?: boolean
  /** Do not attempt token refresh on 401. */
  noRefresh?: boolean
}

let refreshing: Promise<boolean> | null = null

async function refresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "same-origin" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 0)
      })
  }
  return refreshing
}

export function buildUrl(path: string, query?: Options["query"]) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const { body, query, noWorkspace, noRefresh, headers, ...init } = opts
  const method = (init.method || "GET").toUpperCase()
  const h = new Headers(headers)
  const isForm = typeof FormData !== "undefined" && body instanceof FormData
  if (body !== undefined && !isForm) h.set("content-type", "application/json")
  if (method !== "GET" && method !== "HEAD") {
    const csrf = await ensureCsrf()
    if (csrf) h.set("x-csrf-token", csrf)
  }
  const ws = !noWorkspace ? getActiveWorkspaceId() : null
  if (ws) h.set("x-workspace-id", ws)

  const doFetch = () =>
    fetch(buildUrl(path, query), {
      ...init,
      method,
      headers: h,
      credentials: "same-origin",
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    })

  let res = await doFetch()
  // The 15-minute access cookie expires long before the refresh cookie. Session checks (/auth/me) must be able
  // to renew it; other /auth/* calls establish or end sessions themselves and must not.
  const canRefresh = !path.startsWith("/admin") && (!path.startsWith("/auth/") || path === "/auth/me")
  if (res.status === 401 && !noRefresh && canRefresh) {
    if (await refresh()) res = await doFetch()
  }
  if (!res.ok) {
    let payload: { error?: { code?: string; message?: string; details?: unknown } } = {}
    try {
      payload = await res.json()
    } catch {
      /* non-JSON error */
    }
    const err = payload.error || {}
    throw new ApiError(res.status, err.code || "http_error", err.message || `Request failed (${res.status})`, err.details)
  }
  if (res.status === 204) return undefined as T
  const type = res.headers.get("content-type") || ""
  if (type.includes("application/json")) return (await res.json()) as T
  return (await res.blob()) as unknown as T
}

/** Download a binary endpoint (PDF/CSV) and trigger a browser save. */
export async function download(path: string, filename: string, query?: Options["query"]) {
  const blob = await api<Blob>(path, { query })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}
