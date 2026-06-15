import type { SupabaseClient } from '@supabase/supabase-js'

export type ClientPlantScopeProfile = {
  id?: string | null
  role?: string | null
  plant_id?: string | null
  business_unit_id?: string | null
  managed_plant_ids?: string[] | null
}

/** Sync scope from auth profile (may be stale until RPC runs in loadProfile). */
export function plantIdsFromProfile(profile: ClientPlantScopeProfile | null): string[] {
  if (!profile) return []

  if (profile.role === 'JEFE_PLANTA' || profile.role === 'ENCARGADO_MANTENIMIENTO') {
    const managed = profile.managed_plant_ids
    if (managed && managed.length > 0) return managed.filter(Boolean)
    if (profile.plant_id) return [profile.plant_id]
    return []
  }

  if (profile.plant_id) return [profile.plant_id]
  return []
}

export async function fetchProfileScopedPlantIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase.rpc('profile_scoped_plant_ids', {
    p_user_id: userId,
  })
  if (error || !Array.isArray(data) || data.length === 0) {
    return []
  }
  return (data as string[]).filter(Boolean)
}

/**
 * Authoritative plant IDs for the current user on the client.
 * Prefers `profile_scoped_plant_ids` for JP / Encargado; falls back to profile fields.
 */
export async function resolveClientPlantIds(
  supabase: SupabaseClient,
  profile: ClientPlantScopeProfile
): Promise<string[]> {
  if (
    (profile.role === 'JEFE_PLANTA' || profile.role === 'ENCARGADO_MANTENIMIENTO') &&
    profile.id
  ) {
    const fromRpc = await fetchProfileScopedPlantIds(supabase, profile.id)
    if (fromRpc.length > 0) return fromRpc
  }

  const fromProfile = plantIdsFromProfile(profile)
  if (fromProfile.length > 0) return fromProfile

  if (profile.business_unit_id && profile.role === 'JEFE_UNIDAD_NEGOCIO') {
    const { data: buPlants } = await supabase
      .from('plants')
      .select('id')
      .eq('business_unit_id', profile.business_unit_id)
    return (buPlants ?? []).map((p) => p.id).filter(Boolean)
  }

  return []
}

export async function fetchPlantsForScope(
  supabase: SupabaseClient,
  plantIds: string[]
): Promise<Array<{ id: string; name: string; code?: string; business_unit_id: string | null }>> {
  if (plantIds.length === 0) return []

  const { data, error } = await supabase
    .from('plants')
    .select('id, name, code, business_unit_id, status')
    .in('id', plantIds)
    .eq('status', 'active')
    .order('name')

  if (error) {
    console.error('fetchPlantsForScope:', error)
    return []
  }

  return (data ?? []) as Array<{
    id: string
    name: string
    code?: string
    business_unit_id: string | null
  }>
}
