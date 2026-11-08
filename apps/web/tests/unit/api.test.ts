import { beforeEach, describe, expect, it, vi } from "vitest"
import { api, ApiError, buildUrl, errorMessage, setActiveWorkspaceId } from "@/lib/api"

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

describe("api client", () => {
  beforeEach(() => {
    document.cookie = "cs_csrf=test-csrf-token; path=/"
    setActiveWorkspaceId("ws-123")
  })

  it("builds query strings, skipping empty values", () => {
    expect(buildUrl("/reviews", { a: 1, b: "", c: null, d: undefined, e: "x y" })).toBe("/api/v1/reviews?a=1&e=x+y")
  })

  it("sends CSRF and workspace headers on mutations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(200, { ok: true }))
    await api("/projects", { method: "POST", body: { name: "P" } })
    const [, init] = fetchMock.mock.calls[0]
    const headers = new Headers(init?.headers)
    expect(headers.get("x-csrf-token")).toBe("test-csrf-token")
    expect(headers.get("x-workspace-id")).toBe("ws-123")
    expect(headers.get("content-type")).toBe("application/json")
    expect(init?.credentials).toBe("same-origin")
  })

  it("omits the workspace header when asked", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(200, {}))
    await api("/auth/me", { noWorkspace: true })
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("x-workspace-id")).toBeNull()
  })

  it("refreshes once on 401 and retries the request", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(401, { error: { code: "token_expired", message: "expired" } }))
      .mockResolvedValueOnce(json(200, { status: "refreshed" }))
      .mockResolvedValueOnce(json(200, { items: [] }))
    const res = await api<{ items: unknown[] }>("/projects")
    expect(res.items).toEqual([])
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual(["/api/v1/projects", "/api/v1/auth/refresh", "/api/v1/projects"])
  })

  it("throws a typed ApiError from the error envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json(402, { error: { code: "plan_limit", message: "Upgrade to add more.", details: { limit: 2 } } }),
    )
    const err = (await api("/projects", { method: "POST", body: {} }).catch((e: unknown) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(402)
    expect(err.code).toBe("plan_limit")
    expect(err.details).toEqual({ limit: 2 })
    expect(errorMessage(err)).toBe("Upgrade to add more.")
  })
})
