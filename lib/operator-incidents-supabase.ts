import type { createClient } from '@/lib/supabase-server'

/** Server Supabase client returned by `createClient()` (matches SSR client generics). */
export type OperatorRouteSupabase = Awaited<ReturnType<typeof createClient>>
