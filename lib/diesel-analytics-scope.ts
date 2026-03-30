import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase-types"

export type DieselScope = {
  plantIds: string[] | null
  businessUnitId: string | null
}

/**
 * Resolves which plants the current user may see for diesel analytics.
 * - plant_id on profile → single plant
 * - Jefe de unidad / similar with business_unit_id only → all plants in BU
 * - neither → null plantIds means "no extra filter" (RLS still applies on rows)
 */
export async function getDieselPlantScope(
  supabase: SupabaseClient<Database>
): Promise<DieselScope> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { plantIds: [], businessUnitId: null }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plant_id, business_unit_id, role")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { plantIds: [], businessUnitId: null }
  }

  if (profile.plant_id) {
    return { plantIds: [profile.plant_id], businessUnitId: profile.business_unit_id }
  }

  if (profile.business_unit_id) {
    const { data: plants } = await supabase
      .from("plants")
      .select("id")
      .eq("business_unit_id", profile.business_unit_id)

    const ids = (plants ?? []).map((p) => p.id).filter(Boolean)
    return { plantIds: ids.length ? ids : [], businessUnitId: profile.business_unit_id }
  }

  return { plantIds: null, businessUnitId: null }
}

export function plantFilterAllowed(
  plantId: string,
  scope: DieselScope
): boolean {
  if (scope.plantIds === null) return true
  return scope.plantIds.includes(plantId)
}
