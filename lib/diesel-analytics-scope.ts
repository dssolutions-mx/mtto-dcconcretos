import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase-types"

export type DieselScope = {
  plantIds: string[] | null
  businessUnitId: string | null
}

/**
 * Resolves which plants the current user may see for diesel analytics.
 * - JEFE_PLANTA: `profile_scoped_plant_ids` (primary + `profile_managed_plants`), with BU from profile
 * - other roles with `plant_id` → single plant
 * - jefe de unidad / no plant but with `business_unit_id` → all plants in BU
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

  if (profile.role === "JEFE_PLANTA") {
    const { data: scoped, error: rpcError } = await supabase.rpc(
      "profile_scoped_plant_ids",
      { p_user_id: user.id }
    )
    const ids =
      !rpcError && Array.isArray(scoped) && scoped.length > 0
        ? (scoped as string[]).filter(Boolean)
        : profile.plant_id
          ? [profile.plant_id]
          : []
    return {
      plantIds: ids.length ? ids : [],
      businessUnitId: profile.business_unit_id,
    }
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
