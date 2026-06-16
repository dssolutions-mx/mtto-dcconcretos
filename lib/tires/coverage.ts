import type { TirePosition } from '@/types/tires'

export type AssetCoverageStatus = 'ok' | 'partial' | 'no-layout' | 'no-model'

export interface AssetCoverageRow {
  asset_id: string
  asset_name: string
  asset_code: string | null
  model_id: string | null
  model_name: string | null
  has_layout: boolean
  total_positions: number
  mounted_count: number
  coverage_pct: number
  status: AssetCoverageStatus
  orphaned_positions: string[]
}

export function computeAssetCoverageStatus(input: {
  hasModel: boolean
  hasLayout: boolean
  mountedCount: number
  totalPositions: number
}): AssetCoverageStatus {
  if (!input.hasModel || !input.hasLayout) return 'no-layout'
  if (input.totalPositions <= 0) return 'no-layout'
  if (input.mountedCount >= input.totalPositions) return 'ok'
  if (input.mountedCount === 0) return 'partial'
  return 'partial'
}

export function findOrphanedPositionCodes(
  activePositionCodes: string[],
  layoutPositions: TirePosition[]
): string[] {
  const valid = new Set(layoutPositions.map((p) => p.code))
  return activePositionCodes.filter((code) => !valid.has(code))
}

export function buildAssetCoverageRow(input: {
  asset_id: string
  asset_name: string
  asset_code?: string | null
  model_id?: string | null
  model_name?: string | null
  has_layout: boolean
  total_positions: number
  mounted_count: number
  orphaned_positions?: string[]
}): AssetCoverageRow {
  const total = input.total_positions
  const mounted = input.mounted_count
  const pct = total > 0 ? Math.round((mounted / total) * 100) : 0

  return {
    asset_id: input.asset_id,
    asset_name: input.asset_name,
    asset_code: input.asset_code ?? null,
    model_id: input.model_id ?? null,
    model_name: input.model_name ?? null,
    has_layout: input.has_layout,
    total_positions: total,
    mounted_count: mounted,
    coverage_pct: pct,
    status: computeAssetCoverageStatus({
      hasModel: !!input.model_id,
      hasLayout: input.has_layout,
      mountedCount: mounted,
      totalPositions: total,
    }),
    orphaned_positions: input.orphaned_positions ?? [],
  }
}

export const COVERAGE_STATUS_LABELS: Record<AssetCoverageStatus, string> = {
  ok: 'OK',
  partial: 'Parcial',
  'no-layout': 'Config',
  'no-model': 'Sin modelo',
}
