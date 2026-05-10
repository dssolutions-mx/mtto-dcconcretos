import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Last diesel consumption horometer reading for an asset (any diesel warehouse), ordered by
 * transaction_date then created_at. Used to chain `previous_horometer` more reliably than
 * `assets.current_hours` alone.
 */
export async function fetchLastDieselHorometerReading(
  supabase: SupabaseClient,
  assetId: string
): Promise<{ horometer: number | null; kilometer: number | null }> {
  const { data, error } = await supabase
    .from('diesel_transactions')
    .select(
      `
      horometer_reading,
      kilometer_reading,
      transaction_date,
      created_at,
      diesel_warehouses!inner(product_type),
      diesel_products!inner(product_type)
    `
    )
    .eq('asset_id', assetId)
    .eq('transaction_type', 'consumption')
    .eq('diesel_warehouses.product_type', 'diesel')
    .eq('diesel_products.product_type', 'diesel')
    .neq('is_transfer', true)
    .not('horometer_reading', 'is', null)
    .order('transaction_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('[last-diesel-horometer]', error.message)
    return { horometer: null, kilometer: null }
  }
  if (!data) return { horometer: null, kilometer: null }
  return {
    horometer: data.horometer_reading != null ? Number(data.horometer_reading) : null,
    kilometer: data.kilometer_reading != null ? Number(data.kilometer_reading) : null,
  }
}
