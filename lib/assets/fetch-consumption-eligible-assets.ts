import type { SupabaseClient } from '@supabase/supabase-js'
import {
  filterConsumptionEligibleAssets,
  type CompositeParentRow,
  type CompositeRelationshipRow,
} from '@/lib/assets/consumption-eligible-assets'

const CONSUMPTION_ASSET_SELECT = `
  id,
  name,
  asset_id,
  status,
  location,
  department,
  current_hours,
  current_kilometers,
  plant_id,
  department_id,
  model_id,
  is_composite,
  plants (
    id,
    name,
    code,
    business_units (
      id,
      name,
      code
    )
  ),
  departments (
    id,
    name,
    code
  ),
  equipment_models (
    id,
    name,
    manufacturer,
    maintenance_unit
  )
`

export async function fetchConsumptionEligibleAssets(
  supabase: SupabaseClient,
  filters: { plantId?: string | null; status?: string | null }
): Promise<{ data: Record<string, unknown>[]; error: string | null }> {
  let query = supabase.from('assets').select(CONSUMPTION_ASSET_SELECT)

  if (filters.plantId) {
    query = query.eq('plant_id', filters.plantId)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  } else {
    query = query.eq('status', 'operational')
  }

  const { data: allAssets, error: assetsError } = await query.order('name', {
    ascending: true,
  })

  if (assetsError) {
    return { data: [], error: assetsError.message }
  }

  const assets = (allAssets ?? []) as Record<string, unknown>[]

  const { data: relationships, error: relError } = await supabase
    .from('asset_composite_relationships')
    .select('composite_asset_id, component_asset_id, status')
    .eq('status', 'active')

  if (relError) {
    return { data: [], error: relError.message }
  }

  const compositeIds = [
    ...new Set(
      ((relationships ?? []) as CompositeRelationshipRow[]).map(
        (r) => r.composite_asset_id
      )
    ),
  ]

  let composites: CompositeParentRow[] = []
  if (compositeIds.length > 0) {
    const { data: compositeRows, error: compError } = await supabase
      .from('assets')
      .select('id, name, asset_id, primary_component_id, is_composite')
      .in('id', compositeIds)
      .eq('is_composite', true)

    if (compError) {
      return { data: [], error: compError.message }
    }
    composites = (compositeRows ?? []) as CompositeParentRow[]
  }

  const eligible = filterConsumptionEligibleAssets(
    assets as { id: string; is_composite?: boolean | null }[],
    (relationships ?? []) as CompositeRelationshipRow[],
    composites
  )

  return { data: eligible as Record<string, unknown>[], error: null }
}
