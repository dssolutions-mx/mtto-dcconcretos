import { NextResponse, type NextRequest } from "next/server"

/**
 * Proxy (Next.js 16) — optimistic cookie-only auth checks.
 * Per Next.js guidance: "only read the session from the cookie (optimistic checks),
 * and avoid database checks to prevent performance issues."
 * API routes and server components handle actual auth validation.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  // Rate limiting: use Vercel Firewall (Project → Settings → Firewall → Rate Limiting)
  // Configure rules in the dashboard; no code or Upstash required.

  // Enforce host allowlist (set ALLOWED_HOSTS="domain.com,www.domain.com" in env)
  const forwardedHost = request.headers.get("x-forwarded-host") || ""
  const hostHeader = request.headers.get("host") || ""
  const requestHost = (forwardedHost || hostHeader).toLowerCase()

  const allowedHostsEnv = (process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)

  const devHosts = new Set([
    "localhost:3000",
    "localhost:3001",
    "127.0.0.1:3000",
    "127.0.0.1:3001",
  ]) as Set<string>
  const allowedHosts = new Set<string>([...allowedHostsEnv, ...Array.from(devHosts)])

  if (allowedHostsEnv.length > 0 && requestHost && !allowedHosts.has(requestHost)) {
    return new NextResponse("Forbidden host", { status: 403 })
  }

  const pathname = request.nextUrl.pathname

  // Fast-path: /api/health-check — skip getUser, set offline headers from cookie presence
  if (pathname === "/api/health-check") {
    const hasCookies = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.value && c.value.length > 10)
    const res = NextResponse.next()
    if (hasCookies) {
      res.headers.set("X-Offline-Mode", "true")
      res.headers.set("X-Auth-Required", "true")
    }
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    return res
  }

  // Skip auth for API routes — they handle their own auth
  if (pathname.startsWith("/api/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    return response
  }

  // Optimistic check: Supabase cookies present → treat as likely authenticated
  const allCookies = request.cookies.getAll()
  const supabaseCookies = allCookies.filter(
    (c) => c.name.startsWith("sb-") && c.value && c.value.length > 10
  )
  const hasValidCookies = supabaseCookies.length > 0

  const publicRoutes = [
    "/login",
    "/auth/callback",
    "/forgot-password",
    "/auth/reset-password",
    "/auth/confirm",
    "/compras/accion-po",
  ]
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  // Work routes that support offline mode (cookie presence = allow)
  const offlineWorkRoutes = [
    "/checklists",
    "/ordenes",
    "/activos",
    "/dashboard",
    "/preventivo",
    "/reportes",
    "/incidentes",
    "/modelos",
    "/inventario",
    "/plantas",
    "/personal",
  ]
  const isWorkRoute = offlineWorkRoutes.some((route) => pathname.startsWith(route))

  let user: { id: string; email: string; aud: string; role: string } | null = null
  let isOfflineMode = false

  if (hasValidCookies) {
    user = {
      id: "optimistic-session",
      email: "user@session.local",
      aud: "authenticated",
      role: "authenticated",
    }
    if (isWorkRoute) {
      isOfflineMode = true
      response.headers.set("X-Offline-Mode", "true")
      response.headers.set("X-Auth-Required", "true")
    }
  } else if (isWorkRoute) {
    // Work route but no cookies — no offline bypass
    user = null
  }

  // Root path redirect
  if (pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = user ? "/dashboard" : "/login"
    const res = NextResponse.redirect(url)
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    return res
  }

  // Unauthenticated + protected route → redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirectedFrom", pathname)
    const res = NextResponse.redirect(url)
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    return res
  }

  // Authenticated user on login/register → redirect to dashboard
  if (user && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    const res = NextResponse.redirect(url)
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    return res
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
