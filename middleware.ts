import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { canAccessRoute, getRoleDisplayName } from "@/lib/auth/role-permissions"

// Cache profile data for a short time to reduce database queries
const profileCache = new Map<string, { profile: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Force session refresh on auth routes
  if (request.nextUrl.pathname === '/auth/callback') {
    return supabaseResponse
  }

  // Rutas públicas que no requieren autenticación
  const publicRoutes = ["/login", "/register", "/auth/callback"]
  const isPublicRoute = publicRoutes.some((route) => request.nextUrl.pathname.startsWith(route))
  
  // Rutas de API públicas que no requieren autenticación
  const publicApiRoutes = ["/api/auth/register", "/api/auth/test-registration"]
  const isPublicApiRoute = publicApiRoutes.some((route) => request.nextUrl.pathname.startsWith(route))
  
  // Rutas de API que permiten acceso con sesión existente
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/")

  const pathname = request.nextUrl.pathname

  // Si la ruta es la raíz, redirigir a /dashboard
  if (pathname === "/") {
    const dashboardUrl = new URL("/dashboard", request.url)
    const response = NextResponse.redirect(dashboardUrl)
    // Copy Supabase cookies to the new response
    supabaseResponse.cookies.getAll().forEach(cookie => {
      response.cookies.set(cookie.name, cookie.value, cookie)
    })
    return response
  }

  // If user is on a public route and is authenticated, redirect to dashboard
  if (user && (pathname === "/login" || pathname === "/register")) {
    const dashboardUrl = new URL("/dashboard", request.url)
    const response = NextResponse.redirect(dashboardUrl)
    supabaseResponse.cookies.getAll().forEach(cookie => {
      response.cookies.set(cookie.name, cookie.value, cookie)
    })
    return response
  }

  // Role-based route protection for authenticated users
  if (user && !isPublicRoute && !isPublicApiRoute && !isApiRoute) {
    try {
      // Check cache first
      const cacheKey = user.id
      const cached = profileCache.get(cacheKey)
      const now = Date.now()
      
      let profile = null
      
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        profile = cached.profile
      } else {
        // Get user profile with role information
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('role, status')
          .eq('id', user.id)
          .eq('status', 'active')
          .single()

        if (!profileError && data) {
          profile = data
          // Cache the profile
          profileCache.set(cacheKey, { profile: data, timestamp: now })
        }
      }

      if (!profile) {
        console.error('Profile not found or inactive for user:', user.id)
        // Clear the invalid session
        await supabase.auth.signOut()
        
        const loginUrl = new URL("/login", request.url)
        loginUrl.searchParams.set("error", "profile_not_found")
        const response = NextResponse.redirect(loginUrl)
        supabaseResponse.cookies.getAll().forEach(cookie => {
          response.cookies.set(cookie.name, cookie.value, cookie)
        })
        return response
      }

      // Use canAccessRoute from role-permissions.ts for centralized access control
      if (!canAccessRoute(profile.role, pathname)) {
        console.log(`Access denied for role ${profile.role} to ${pathname}`)
        const dashboardUrl = new URL("/dashboard", request.url)
        dashboardUrl.searchParams.set("error", "access_denied")
        dashboardUrl.searchParams.set("module", pathname.split('/')[1])
        dashboardUrl.searchParams.set("role", profile.role)
        const response = NextResponse.redirect(dashboardUrl)
        supabaseResponse.cookies.getAll().forEach(cookie => {
          response.cookies.set(cookie.name, cookie.value, cookie)
        })
        return response
      }

      // Log successful access for monitoring
      if (process.env.NODE_ENV === 'development') {
        console.log(`Access granted: ${getRoleDisplayName(profile.role)} → ${pathname}`)
      }

    } catch (error) {
      console.error('Error checking role permissions:', error)
      // On error, allow access but clear cache for this user
      if (user?.id) {
        profileCache.delete(user.id)
      }
    }
  }

  // Si no hay sesión y no es una ruta pública, redirigir al login
  if (!user && !isPublicRoute && !isPublicApiRoute) {
    // Para rutas de API, devolver 401 en lugar de redirigir
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname)
    const response = NextResponse.redirect(redirectUrl)
    // Copy Supabase cookies to the new response
    supabaseResponse.cookies.getAll().forEach(cookie => {
      response.cookies.set(cookie.name, cookie.value, cookie)
    })
    return response
  }

  // Clean up old cache entries periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    const cutoff = Date.now() - CACHE_DURATION
    for (const [key, value] of profileCache.entries()) {
      if (value.timestamp < cutoff) {
        profileCache.delete(key)
      }
    }
  }

  // IMPORTANT: You must return the response as is for the Auth cookies to work correctly
  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
