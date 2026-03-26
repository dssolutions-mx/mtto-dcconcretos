import type { SupabaseClient } from '@supabase/supabase-js'

type AssetRow = {
  id: string
  is_composite: boolean | null
  component_assets: string[] | null
}

function normalizeComponents(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string')
}

function expandOneAssetId(
  id: string,
  assetsById: Map<string, AssetRow>,
  parentByComponent: Map<string, string>,
  compositeById: Map<string, AssetRow>
): string[] {
  const row = assetsById.get(id)
  if (row?.is_composite) {
    const comp = compositeById.get(id) || row
    const parts = normalizeComponents(comp.component_assets)
    return [...new Set([id, ...parts])]
  }

  const parentId = parentByComponent.get(id)
  if (parentId) {
    const comp = compositeById.get(parentId)
    if (comp?.is_composite) {
      const parts = normalizeComponents(comp.component_assets)
      return [...new Set([parentId, ...parts])]
    }
    return [parentId, id]
  }

  return [id]
}

/**
 * For each assignment `asset_id`, returns all `checklist_schedules.asset_id` values
 * that belong to that logical unit (composite + components, or standalone).
 */
export async function expandPerAssignmentAssetScopes(
  supabase: SupabaseClient,
  assignmentAssetIds: string[]
): Promise<Map<string, string[]>> {
  const ids = [...new Set(assignmentAssetIds.filter(Boolean))]
  const result = new Map<string, string[]>()
  if (ids.length === 0) return result

  const { data: assetsRows, error: assetsError } = await supabase
    .from('assets')
    .select('id, is_composite, component_assets')
    .in('id', ids)

  if (assetsError) {
    console.error('expandPerAssignmentAssetScopes: assets query', assetsError)
    for (const id of ids) result.set(id, [id])
    return result
  }

  const assetsById = new Map((assetsRows || []).map((a) => [a.id, a as AssetRow]))

  const { data: rels } = await supabase
    .from('asset_composite_relationships')
    .select('composite_asset_id, component_asset_id')
    .in('component_asset_id', ids)
    .eq('status', 'active')

  const parentByComponent = new Map<string, string>()
  for (const r of rels || []) {
    parentByComponent.set(r.component_asset_id, r.composite_asset_id)
  }

  const compositeIdsToLoad = new Set<string>()
  for (const id of ids) {
    const row = assetsById.get(id)
    if (row?.is_composite) compositeIdsToLoad.add(id)
  }
  for (const id of ids) {
    const p = parentByComponent.get(id)
    if (p) compositeIdsToLoad.add(p)
  }

  let compositeById = new Map<string, AssetRow>()
  if (compositeIdsToLoad.size > 0) {
    const { data: compositeAssets, error: compErr } = await supabase
      .from('assets')
      .select('id, is_composite, component_assets')
      .in('id', [...compositeIdsToLoad])

    if (compErr) {
      console.error('expandPerAssignmentAssetScopes: composite assets query', compErr)
    } else {
      compositeById = new Map((compositeAssets || []).map((a) => [a.id, a as AssetRow]))
    }
  }

  for (const id of ids) {
    result.set(id, expandOneAssetId(id, assetsById, parentByComponent, compositeById))
  }

  return result
}

/**
 * Union of all schedule asset IDs covered by the given operator assignments.
 */
export async function expandAssetIdsForOperatorChecklists(
  supabase: SupabaseClient,
  assignmentAssetIds: string[]
): Promise<string[]> {
  const map = await expandPerAssignmentAssetScopes(supabase, assignmentAssetIds)
  const out = new Set<string>()
  for (const arr of map.values()) {
    for (const x of arr) out.add(x)
  }
  return [...out]
}

export function findAssignmentForScheduleAsset<
  T extends { asset_id: string; assignment_type?: string }
>(
  scheduleAssetId: string,
  assignedAssets: T[],
  scopes: Map<string, string[]>
): T | undefined {
  const primaries = assignedAssets.filter((a) => a.asset_id && scopes.get(a.asset_id)?.includes(scheduleAssetId))
  const primary = primaries.find((a) => a.assignment_type === 'primary')
  if (primary) return primary
  return primaries[0]
}
