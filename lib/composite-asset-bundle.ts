import type { SupabaseClient } from '@supabase/supabase-js'

/** All asset row IDs that move together: composite parent + its components, or a standalone asset. */
export function bundleAssetIdsFromRow(row: {
  id: string
  is_composite?: boolean | null
  component_assets?: string[] | null
}): string[] {
  if (row.is_composite && Array.isArray(row.component_assets) && row.component_assets.length > 0) {
    return Array.from(new Set([row.id, ...row.component_assets]))
  }
  return [row.id]
}

export async function getCompositeBundleAssetIds(
  supabase: SupabaseClient,
  assetId: string
): Promise<string[]> {
  const { data: row, error } = await supabase
    .from('assets')
    .select('id, is_composite, component_assets')
    .eq('id', assetId)
    .maybeSingle()

  if (error || !row) return [assetId]
  return bundleAssetIdsFromRow(row)
}
