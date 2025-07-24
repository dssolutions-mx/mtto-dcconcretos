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

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  let user = null
  let isOfflineMode = false
  
  // FIRST: Check Zustand auth store (most reliable for offline)
  const zustandAuthCookie = request.cookies.get('auth-store')
  if (zustandAuthCookie?.value) {
    try {
      const authStore = JSON.parse(decodeURIComponent(zustandAuthCookie.value))
      if (authStore.state?.user && authStore.state.user.id) {
        console.log('✅ Middleware: Found valid Zustand auth state, user:', authStore.state.user.email || authStore.state.user.id)
        user = authStore.state.user
        
        // If we have Zustand auth, skip Supabase network call for better offline experience
        if (authStore.state.profile) {
          console.log('📱 Middleware: Using cached Zustand auth (offline-ready)')
          return supabaseResponse
        }
      }
    } catch (error) {
      console.warn('⚠️ Middleware: Failed to parse Zustand auth store:', error)
    }
  }
  
  // SECOND: If no Zustand auth, try Supabase (only if likely online)
  if (!user) {
    // Check if we have any Supabase session cookies
    const allCookies = request.cookies.getAll()
    const supabaseCookies = allCookies.filter(cookie => 
      cookie.name.startsWith('sb-') && cookie.value && cookie.value.length > 10
    )
    
    console.log('🍪 Available Supabase cookies:', supabaseCookies.map(c => c.name))
    
    try {
      // Only attempt network call if we have session cookies (indicates previous auth)
      if (supabaseCookies.length > 0) {
        // Set a shorter timeout for faster offline detection
        const authPromise = supabase.auth.getUser()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth timeout - likely offline')), 2000)
        )
        
        const { data, error } = await Promise.race([authPromise, timeoutPromise]) as any
        
        if (error) {
          throw error
        }
        
        user = data.user
        console.log('✅ Middleware: Successfully authenticated via Supabase:', user?.id || 'no-id')
      } else {
        console.log('🔍 Middleware: No session cookies, skipping network auth call')
        throw new Error('No session cookies found')
      }
      
    } catch (error: any) {
      isOfflineMode = true
      const errorMessage = error.message || 'Unknown error'
      console.warn('🌐 Middleware: Supabase auth failed, checking offline fallbacks:', errorMessage)
      
      // THIRD: Fallback to Supabase session cookies for offline access
      if (supabaseCookies.length > 0) {
        console.log('📱 Middleware: Using Supabase session cookies for offline access')
        console.log('🔑 Session cookies found:', supabaseCookies.map(c => `${c.name}=${c.value.substring(0, 10)}...`))
        
        // Create a minimal user object to prevent login redirect
        user = { 
          id: 'offline-user-' + Date.now(),
          email: 'offline@local.app',
          aud: 'authenticated',
          role: 'authenticated'
        }
      } else {
        console.log('❌ Middleware: No authentication state found, will redirect to login')
      }
    }
  }

  // Handle root path redirect
  if (request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = user ? "/dashboard" : "/login"
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
    return NextResponse.redirect(url)
  }

  // If user is authenticated and trying to access login/register pages
  if (user && 
      (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register")) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You must return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it
  // 2. Copy over the cookies
  // 3. Change the response object to fit your needs, but avoid changing the cookies!
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!
  
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
