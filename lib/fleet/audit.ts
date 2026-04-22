import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase-types'

export async function insertAssetAuditLog(
  supabase: SupabaseClient<Database>,
  row: {
    asset_id: string
    user_id: string
    field: string
    before_value: string | null
    after_value: string | null
    source?: string
  }
) {
  const { error } = await supabase.from('assets_audit_log').insert({
    asset_id: row.asset_id,
    user_id: row.user_id,
    field: row.field,
    before_value: row.before_value,
    after_value: row.after_value,
    source: row.source ?? 'fleet_ui',
  })
  return error
}
