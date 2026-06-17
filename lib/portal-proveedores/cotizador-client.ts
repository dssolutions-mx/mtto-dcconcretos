import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export function isCotizadorConfigured(): boolean {
  return Boolean(
    process.env.COTIZADOR_SUPABASE_URL &&
      process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY
  )
}

/** Read-only Supabase client for the cotizador ERP (service role). */
export function createCotizadorAdminClient(): SupabaseClient | null {
  const url = process.env.COTIZADOR_SUPABASE_URL
  const key = process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}
