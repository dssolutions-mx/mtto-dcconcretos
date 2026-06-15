import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Diesel/urea consumption must target a physical asset, not a composite parent.
 * For composite bundles, only the designated primary_component_id is eligible when set.
 */

export type CompositeParentRow = {
  id: string
  name: string | null
  asset_id: string | null
  primary_component_id: string | null
  is_composite?: boolean | null
}

export type CompositeRelationshipRow = {
  composite_asset_id: string
  component_asset_id: string
  status: string
}

export type AssetForConsumptionEligibility = {
  id: string
  is_composite?: boolean | null
  [key: string]: unknown
}

export type CompositeDisplay = {
  id: string
  name: string
  asset_id: string | null
}

export type ConsumptionEligibleAsset<T extends AssetForConsumptionEligibility> = T & {
  composite_display?: CompositeDisplay
}

export type ConsumptionAssetValidationResult =
  | { ok: true }
  | { ok: false; error: string }

const CONSUMPTION_REJECT_COMPOSITE =
  'No se puede registrar combustible en el activo compuesto. Selecciona el componente del equipo.'
const CONSUMPTION_REJECT_NON_PRIMARY =
  'Este componente no recibe combustible en el compuesto. Selecciona el componente principal de carga.'

/**
 * Builds parent lookup: component_id -> composite parent (active relationships only).
 */
export function buildComponentToParentMap(
  relationships: CompositeRelationshipRow[],
  compositesById: Map<string, CompositeParentRow>
): Map<string, CompositeParentRow> {
  const map = new Map<string, CompositeParentRow>()
  for (const rel of relationships) {
    if (rel.status !== 'active') continue
    const parent = compositesById.get(rel.composite_asset_id)
    if (parent) map.set(rel.component_asset_id, parent)
  }
  return map
}

/**
 * Filters assets for diesel/urea pickers and enriches primary components with composite display info.
 */
export function filterConsumptionEligibleAssets<T extends AssetForConsumptionEligibility>(
  assets: T[],
  relationships: CompositeRelationshipRow[],
  composites: CompositeParentRow[]
): ConsumptionEligibleAsset<T>[] {
  const compositesById = new Map(composites.map((c) => [c.id, c]))
  const componentToParent = buildComponentToParentMap(relationships, compositesById)
  const result: ConsumptionEligibleAsset<T>[] = []

  for (const asset of assets) {
    if (asset.is_composite) continue

    const parent = componentToParent.get(asset.id)
    if (parent) {
      const primaryId = parent.primary_component_id
      if (primaryId && primaryId !== asset.id) continue
      const enriched: ConsumptionEligibleAsset<T> = {
        ...asset,
        composite_display: {
          id: parent.id,
          name: parent.name ?? parent.asset_id ?? 'Compuesto',
          asset_id: parent.asset_id,
        },
      }
      result.push(enriched)
      continue
    }

    result.push({ ...asset })
  }

  return result
}

/**
 * Server-side validation before diesel_transactions consumption insert.
 */
export function validateConsumptionAssetId(
  assetId: string,
  assetRow: { id: string; is_composite?: boolean | null } | null,
  parent: CompositeParentRow | null
): ConsumptionAssetValidationResult {
  if (!assetRow) {
    return { ok: false, error: 'Activo no encontrado.' }
  }
  if (assetRow.is_composite) {
    return { ok: false, error: CONSUMPTION_REJECT_COMPOSITE }
  }
  if (parent?.primary_component_id && parent.primary_component_id !== assetId) {
    return { ok: false, error: CONSUMPTION_REJECT_NON_PRIMARY }
  }
  return { ok: true }
}

export async function fetchConsumptionValidationContext(
  supabase: SupabaseClient,
  assetId: string
): Promise<{
  asset: { id: string; is_composite?: boolean | null } | null
  parent: CompositeParentRow | null
}> {
  const { data: asset } = await supabase
    .from('assets')
    .select('id, is_composite')
    .eq('id', assetId)
    .maybeSingle()

  const assetRow = asset as { id: string; is_composite?: boolean | null } | null

  const { data: rel } = await supabase
    .from('asset_composite_relationships')
    .select('composite_asset_id')
    .eq('component_asset_id', assetId)
    .eq('status', 'active')
    .maybeSingle()

  const relRow = rel as { composite_asset_id: string } | null
  if (!relRow?.composite_asset_id) {
    return { asset: assetRow, parent: null }
  }

  const { data: parent } = await supabase
    .from('assets')
    .select('id, name, asset_id, primary_component_id, is_composite')
    .eq('id', relRow.composite_asset_id)
    .maybeSingle()

  return {
    asset: assetRow,
    parent: parent as CompositeParentRow | null,
  }
}

/** Returns error message when invalid, or null when OK. */
export async function assertConsumptionAssetValid(
  supabase: SupabaseClient,
  assetId: string
): Promise<string | null> {
  const { asset, parent } = await fetchConsumptionValidationContext(supabase, assetId)
  const result = validateConsumptionAssetId(assetId, asset, parent)
  return result.ok ? null : result.error
}
