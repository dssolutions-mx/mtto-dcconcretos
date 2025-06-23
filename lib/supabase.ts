import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"

// Singleton instance
let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // Persist session in localStorage for better reliability
          persistSession: true,
          // Auto refresh token before expiry
          autoRefreshToken: true,
          // Detect session from URL (for OAuth redirects)
          detectSessionInUrl: true
        }
      }
    )
  }
  return supabaseInstance
}

// Export singleton instance
export const supabase = createClient()
