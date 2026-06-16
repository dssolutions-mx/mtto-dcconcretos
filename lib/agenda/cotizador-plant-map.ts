import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

export type CotizadorPlantMaps = {
  maintenanceToCotizador: Map<string, string>
  cotizadorToMaintenance: Map<string, string>
}

/**
 * Maps Cotizador plant UUIDs ↔ MantenPro `plants.id` via shared `code`.
 */
export async function buildCotizadorPlantMaps(
  maintenanceSupabase: SupabaseClient,
): Promise<CotizadorPlantMaps> {
  const maintenanceToCotizador = new Map<string, string>()
  const cotizadorToMaintenance = new Map<string, string>()

  const { data: plants } = await maintenanceSupabase.from("plants").select("id, code")
  const codeToMaintenanceId = new Map<string, string>()
  for (const p of plants ?? []) {
    if (p.code) codeToMaintenanceId.set(p.code, p.id)
  }

  const url = process.env.COTIZADOR_SUPABASE_URL
  const key = process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return { maintenanceToCotizador, cotizadorToMaintenance }
  }

  const cotizador = createSupabaseClient(url, key, { auth: { persistSession: false } })
  const { data: cotPlants } = await cotizador.from("plants").select("id, code")
  for (const cp of cotPlants ?? []) {
    const mid = cp.code ? codeToMaintenanceId.get(cp.code) : undefined
    if (mid) {
      maintenanceToCotizador.set(mid, cp.id)
      cotizadorToMaintenance.set(cp.id, mid)
    }
  }

  return { maintenanceToCotizador, cotizadorToMaintenance }
}

export function resolveCotizadorPlantIds(
  plantIdsParam: string | null,
  maps: CotizadorPlantMaps,
): string[] | null {
  if (!plantIdsParam?.trim()) return null
  const ids = plantIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
  if (ids.length === 0) return null

  return ids.map((id) => {
    if (maps.maintenanceToCotizador.has(id)) {
      return maps.maintenanceToCotizador.get(id)!
    }
    return id
  })
}
