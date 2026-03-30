import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Proxy (Next.js 16) — Supabase SSR session validation + token refresh.
 * Calls getUser() so expired tokens refresh via setAll → response cookies.
 * API routes and /api/health-check skip this (see below).
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

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

  // Fast-path: /api/health-check — skip getUser; offline headers from cookie presence only
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

  // API routes handle their own auth
  if (pathname.startsWith("/api/")) {
    const res = NextResponse.next({ request })
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    return res
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const publicRoutes = [
    "/login",
    "/register",
    "/auth/callback",
    "/forgot-password",
    "/auth/reset-password",
    "/auth/confirm",
    "/compras/accion-po",
  ]
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

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

  if (user && isWorkRoute) {
    supabaseResponse.headers.set("X-Offline-Mode", "true")
    supabaseResponse.headers.set("X-Auth-Required", "true")
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = user ? "/dashboard" : "/login"
    const res = NextResponse.redirect(url)
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    return res
  }

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirectedFrom", pathname)
    const res = NextResponse.redirect(url)
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    return res
  }

  // Do not redirect /login away based on session alone — client validates full state.

  supabaseResponse.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
