import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

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

  let user = null
  let isOfflineMode = false
  
  try {
    // Try Supabase auth (when online)
    const { data: { user: authUser }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.log('🔍 Middleware: Supabase auth failed:', error.message)
      throw error // Fall through to offline handling
    } else {
      user = authUser
      console.log('✅ Middleware: User authenticated via Supabase:', user?.email || user?.id || 'unknown')
    }
  } catch (error: any) {
    console.log('🌐 Middleware: Auth failed, checking if route allows offline access')
    
    // Define work routes that should be accessible offline
    const offlineWorkRoutes = [
      '/checklists',
      '/ordenes', 
      '/activos',
      '/dashboard',
      '/preventivo',
      '/reportes',
      '/incidentes',
      '/modelos',
      '/inventario',
      '/plantas',
      '/personal',
      '/compras'
    ]
    
    const isWorkRoute = offlineWorkRoutes.some(route => 
      request.nextUrl.pathname.startsWith(route)
    )
    
    if (isWorkRoute) {
      console.log('📱 Middleware: Allowing offline access to work route, client will validate auth')
      
      // Check for session cookies to differentiate access levels
      const allCookies = request.cookies.getAll()
      const supabaseCookies = allCookies.filter(cookie => 
        cookie.name.startsWith('sb-') && cookie.value && cookie.value.length > 10
      )
      
      if (supabaseCookies.length > 0) {
        console.log('🔑 Middleware: Session cookies found - likely authenticated offline user')
        user = { 
          id: 'offline-session',
          email: 'offline@session.local',
          aud: 'authenticated',
          role: 'authenticated'
        }
      } else {
        console.log('📝 Middleware: No session cookies - allowing access for client validation')
        user = { 
          id: 'offline-work-mode',
          email: 'offline@work.local',
          aud: 'authenticated',
          role: 'authenticated'
        }
      }
      
      isOfflineMode = true
      
      // Add headers to signal offline mode to client
      supabaseResponse.headers.set('X-Offline-Mode', 'true')
      supabaseResponse.headers.set('X-Auth-Required', 'true')
    } else {
      console.log('🔒 Middleware: Non-work route, requiring proper authentication')
    }
  }

  // Handle root path redirect
  if (request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = user ? "/dashboard" : "/login"
    console.log(`🔄 Middleware: Root redirect to ${url.pathname} ${isOfflineMode ? '(offline)' : '(online)'}`)
    return NextResponse.redirect(url)
  }

  // Define public routes (pages that don't require authentication)
  const publicRoutes = [
    "/login", 
    "/register", 
    "/auth/callback",
    "/forgot-password",
    "/auth/reset-password",
    "/auth/confirm"
  ]
  const isPublicRoute = publicRoutes.some((route) => 
    request.nextUrl.pathname.startsWith(route)
  )

  // Skip authentication for API routes - they handle their own auth
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')

  // If user is not authenticated and trying to access protected route (excluding API routes)
  if (!user && !isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirectedFrom", request.nextUrl.pathname)
    console.log(`🔒 Middleware: Redirecting unauthenticated user from ${request.nextUrl.pathname} to login`)
    return NextResponse.redirect(url)
  }

  // If user is authenticated and trying to access login/register pages
  if (user && 
      (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register")) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    console.log(`🏠 Middleware: Redirecting authenticated user from ${request.nextUrl.pathname} to dashboard ${isOfflineMode ? '(offline)' : '(online)'}`)
    return NextResponse.redirect(url)
  }

  // Log successful middleware pass-through
  if (user) {
    console.log(`✅ Middleware: Allowing authenticated access to ${request.nextUrl.pathname} ${isOfflineMode ? '(offline)' : '(online)'}`)
  } else if (isPublicRoute) {
    console.log(`🌐 Middleware: Allowing public access to ${request.nextUrl.pathname}`)
  } else if (isApiRoute) {
    console.log(`🔌 Middleware: Skipping auth for API route ${request.nextUrl.pathname}`)
  }

  // IMPORTANT: You must return the supabaseResponse object as it is.
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
