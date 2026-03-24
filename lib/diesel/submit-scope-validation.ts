import type { SupabaseClient } from '@supabase/supabase-js'

export type DieselWarehouseRow = { id: string; plant_id?: string | null }

/**
 * Resolves plant_id for diesel_transactions: explicit selection wins, else warehouse row.
 */
export function resolveDieselTransactionPlantId(
  selectedPlant: string | null,
  selectedWarehouse: string | null,
  warehouses: DieselWarehouseRow[],
  allBuWarehouses?: DieselWarehouseRow[]
): string | null {
  if (!selectedWarehouse) return selectedPlant ?? null
  const wh =
    warehouses.find((w) => w.id === selectedWarehouse) ??
    allBuWarehouses?.find((w) => w.id === selectedWarehouse)
  const fromWarehouse = wh?.plant_id ?? null
  return selectedPlant ?? fromWarehouse ?? null
}

/**
 * Validates plant + warehouse scope before diesel_transactions insert so RLS
 * rejections (403) become clear client errors.
 * When plant is omitted, uses diesel_warehouses.plant_id (Jefe de Unidad: warehouse-only flow).
 */
export async function validateDieselTransactionScope(
  supabase: SupabaseClient,
  opts: {
    userId: string
    selectedPlant: string | null
    selectedWarehouse: string
  }
): Promise<{ error: string } | null> {
  const { data: warehouse, error: warehouseError } = await supabase
    .from('diesel_warehouses')
    .select('plant_id')
    .eq('id', opts.selectedWarehouse)
    .single()

  if (warehouseError || !warehouse) {
    return { error: 'No se pudo validar el almacén. Intenta de nuevo.' }
  }

  const effectivePlantId = opts.selectedPlant ?? warehouse.plant_id
  if (!effectivePlantId) {
    return { error: 'El almacén no tiene planta asociada. Contacta soporte.' }
  }

  if (
    opts.selectedPlant &&
    warehouse.plant_id &&
    opts.selectedPlant !== warehouse.plant_id
  ) {
    return {
      error:
        'El almacén no corresponde a la planta seleccionada. Vuelve a elegir planta y almacén.'
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plant_id, business_unit_id, role')
    .eq('id', opts.userId)
    .single()

  if (profileError || !profile) {
    return { error: 'No se pudo validar tu perfil. Intenta de nuevo.' }
  }

  if (
    profile.role === 'JEFE_PLANTA' &&
    profile.plant_id &&
    effectivePlantId !== profile.plant_id
  ) {
    return { error: 'Solo puedes registrar movimientos en tu planta asignada' }
  }

  return null
}
