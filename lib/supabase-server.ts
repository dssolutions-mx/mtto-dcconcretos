import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase-types"

export async function createClient() {
  const cookieStore = await cookies()

  const client = createServerClient<Database>(
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
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  // Add mobile session recovery logic
  const originalGetUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = async () => {
    try {
      const result = await originalGetUser()
      
      // If session is missing but we have cookies, try to refresh
      if (!result.data.user && result.error?.message?.includes('Auth session missing')) {
        console.log('🔄 Mobile session recovery: Attempting to refresh session')
        
        // Try to get session instead
        const { data: { session }, error: sessionError } = await client.auth.getSession()
        
        if (session?.user && !sessionError) {
          console.log('✅ Mobile session recovery: Session refreshed successfully')
          return { data: { user: session.user }, error: null }
        }
      }
      
      return result
    } catch (error) {
      console.error('❌ Mobile session recovery failed:', error)
      return { data: { user: null }, error: error as any }
    }
  }

  return client
}
