import type { SupabaseClient } from '@supabase/supabase-js'
import type { FleetAssetRow } from '@/lib/fleet/organize'
import {
  buildVerificationMap,
  computeAssetTrustFields,
  type TrustPolicyRow,
} from '@/lib/fleet/trust-server'
import type { Database } from '@/types/supabase-types'

const ASSET_TRUST_SELECT = `
  id,
  asset_id,
  name,
  status,
  current_hours,
  current_kilometers,
  serial_number,
  insurance_end_date,
  plant_id,
  model_id,
  department_id,
  installation_date,
  plants (
    id,
    name,
    code,
    business_unit_id,
    business_units ( id, name, code )
  ),
  equipment_models (
    id,
    name,
    manufacturer,
    category,
    year_introduced
  )
`

/** Trust breakdown for one asset (avoids loading the whole fleet). */
export async function getTrustDetailForAsset(
  supabase: SupabaseClient<Database>,
  assetId: string
) {
  const [{ data: asset, error: aErr }, polRes, verRes, confRes] = await Promise.all([
    supabase
      .from('assets')
      .select(ASSET_TRUST_SELECT)
      .eq('id', assetId)
      .single(),
    supabase.from('trust_field_policies').select('field, window_days, severity'),
    supabase
      .from('asset_field_verifications')
      .select('asset_id, field, verified_at')
      .eq('asset_id', assetId),
    supabase.from('asset_conflicts').select('asset_id').eq('asset_id', assetId).limit(1),
  ])

  if (aErr || !asset) {
    return { error: aErr?.message ?? 'Activo no encontrado' as string, data: null }
  }

  const row = asset as unknown as FleetAssetRow
  const polRows = (polRes.error ? [] : (polRes.data ?? [])) as TrustPolicyRow[]
  const verRows =
    (verRes.data ?? []) as { asset_id: string; field: string; verified_at: string }[]
  const vmap = buildVerificationMap(verRows)
  const conflictSet = new Set<string>()
  if (!confRes.error && confRes.data?.length) conflictSet.add(assetId)

  const { trust_pct, fields } = computeAssetTrustFields(
    row,
    vmap,
    polRows,
    conflictSet
  )

  return {
    error: null,
    data: { trust_pct, fields, policies: polRows },
  }
}
