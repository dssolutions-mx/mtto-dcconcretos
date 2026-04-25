import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase-types'

export type SupplierActor = {
  user: { id: string }
  profile: {
    id: string
    role: Database['public']['Enums']['user_role'] | null
    business_unit_id: string | null
  } | null
}

export async function getSupplierActor(
  supabase: SupabaseClient<Database>
): Promise<{ user: null; profile: null } | (SupplierActor & { user: { id: string } })> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { user: null, profile: null }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, business_unit_id')
    .eq('id', user.id)
    .single()

  return {
    user: { id: user.id },
    profile: profile ?? null,
  }
}

export async function getSupplierJunctionBusinessUnitIds(
  supabase: SupabaseClient<Database>,
  supplierId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('supplier_business_units')
    .select('business_unit_id')
    .eq('supplier_id', supplierId)
  return (data ?? []).map((r) => r.business_unit_id)
}
