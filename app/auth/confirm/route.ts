import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login?error=missing_token', request.url))
  }

  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )

  // Exchange the token_hash for a session
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type as any,
  })

  if (error) {
    console.error('Token verification error:', error)
    
    // Redirect to appropriate error page based on type
    if (type === 'recovery') {
      return NextResponse.redirect(
        new URL('/forgot-password?error=invalid_token', request.url)
      )
    }
    
    return NextResponse.redirect(
      new URL('/login?error=invalid_token', request.url)
    )
  }

  if (!data.session) {
    return NextResponse.redirect(
      new URL('/login?error=no_session', request.url)
    )
  }

  // For password recovery, redirect to reset password page
  if (type === 'recovery') {
    // The session is now active, redirect to password reset page
    return NextResponse.redirect(new URL('/auth/reset-password', request.url))
  }

  // For other types (signup confirmation, etc.), redirect to next or dashboard
  return NextResponse.redirect(new URL(next, request.url))
} 