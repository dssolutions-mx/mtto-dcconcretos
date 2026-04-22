import type { SupabaseClient } from '@supabase/supabase-js'
import type { FleetAssetRow } from '@/lib/fleet/organize'
import { buildFleetNodes } from '@/lib/fleet/organize'
import {
  buildVerificationMap,
  computeTrustByAssetId,
  type TrustPolicyRow,
} from '@/lib/fleet/trust-server'
import type { FleetOrganizeLens } from '@/types/fleet'
import type { Database } from '@/types/supabase-types'

const ASSET_SELECT = `
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

export async function fetchFleetTreePayload(
  supabase: SupabaseClient<Database>,
  lens: FleetOrganizeLens
) {
  const { data: assetsRaw, error: assetsError } = await supabase
    .from('assets')
    .select(ASSET_SELECT)
    .order('asset_id')

  if (assetsError) throw new Error(assetsError.message)
  const assets = (assetsRaw ?? []) as unknown as FleetAssetRow[]
  const assetIds = assets.map((a) => a.id)

  const [verRes, polRes, confRes] = await Promise.all([
    assetIds.length
      ? supabase
          .from('asset_field_verifications')
          .select('asset_id, field, verified_at')
          .in('asset_id', assetIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('trust_field_policies').select('field, window_days, severity'),
    supabase.from('asset_conflicts').select('asset_id'),
  ])

  if (verRes.error) console.warn('asset_field_verifications', verRes.error)
  if (polRes.error) console.warn('trust_field_policies', polRes.error)
  if (confRes.error) console.warn('asset_conflicts', confRes.error)

  const verRows =
    (verRes.data ?? []) as { asset_id: string; field: string; verified_at: string }[]
  const polRows = (polRes.data ?? []) as TrustPolicyRow[]
  const conflicts = (confRes.data ?? []) as { asset_id: string | null }[]

  const conflictSet = new Set(
    conflicts.map((c) => c.asset_id).filter((x): x is string => !!x)
  )
  const vmap = buildVerificationMap(verRows)
  const trustByAssetId = computeTrustByAssetId(
    assets,
    vmap,
    polRows,
    conflictSet
  )
  const nodes = buildFleetNodes(assets, lens, trustByAssetId)

  return {
    nodes,
    assets,
    trustByAssetId,
    policies: polRows,
    verificationRows: verRows,
    conflictAssetIds: [...conflictSet],
  }
}
