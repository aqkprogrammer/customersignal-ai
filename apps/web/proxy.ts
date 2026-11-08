import { NextResponse, type NextRequest } from "next/server"

/**
 * Optimistic route protection only (cookie presence). Real authentication and authorization are enforced by the
 * FastAPI backend on every request — hiding routes here is purely UX.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hasSession = request.cookies.has("cs_session") || request.cookies.has("cs_access")
  const hasAdmin = request.cookies.has("cs_admin")

  if ((pathname === "/app" || pathname.startsWith("/app/") || pathname.startsWith("/onboarding")) && !hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = `?next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(url)
  }
  if ((pathname === "/login" || pathname === "/signup") && hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = "/app"
    url.search = ""
    return NextResponse.redirect(url)
  }
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !hasAdmin) {
    const url = request.nextUrl.clone()
    url.pathname = "/admin/login"
    url.search = ""
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/app/:path*", "/app", "/onboarding/:path*", "/onboarding", "/login", "/signup", "/admin/:path*", "/admin"],
}
