import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Validates plant + warehouse scope before diesel_transactions insert so RLS
 * rejectsions (403) become clear client errors — e.g. missing plant for Jefe Unidad.
 */
export async function validateDieselTransactionScope(
  supabase: SupabaseClient,
  opts: {
    userId: string
    selectedPlant: string | null
    selectedWarehouse: string
  }
): Promise<{ error: string } | null> {
  if (!opts.selectedPlant) {
    return { error: 'Selecciona una planta' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plant_id, business_unit_id, role')
    .eq('id', opts.userId)
    .single()

  if (profileError || !profile) {
    return { error: 'No se pudo validar tu perfil. Intenta de nuevo.' }
  }

  if (profile.role === 'JEFE_PLANTA' && profile.plant_id && opts.selectedPlant !== profile.plant_id) {
    return { error: 'Solo puedes registrar movimientos en tu planta asignada' }
  }

  const { data: warehouse, error: warehouseError } = await supabase
    .from('diesel_warehouses')
    .select('plant_id')
    .eq('id', opts.selectedWarehouse)
    .single()

  if (warehouseError || !warehouse) {
    return { error: 'No se pudo validar el almacén. Intenta de nuevo.' }
  }

  if (warehouse.plant_id && warehouse.plant_id !== opts.selectedPlant) {
    return {
      error:
        'El almacén no corresponde a la planta seleccionada. Vuelve a elegir planta y almacén.'
    }
  }

  return null
}
