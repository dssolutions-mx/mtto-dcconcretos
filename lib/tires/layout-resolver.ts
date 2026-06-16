import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_TIRE_POSITIONS,
  getPositionsForTemplate,
} from '@/lib/tires/positions'
import type {
  EquipmentModelTireLayout,
  ResolvedTireLayout,
  TireLayoutTemplateKey,
  TirePosition,
} from '@/types/tires'

function isTirePosition(value: unknown): value is TirePosition {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return (
    typeof p.code === 'string' &&
    typeof p.label === 'string' &&
    typeof p.axle === 'number' &&
    (p.side === 'izq' || p.side === 'der' || p.side === 'centro')
  )
}

function parsePositionsJson(raw: unknown): TirePosition[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isTirePosition)
}

/** Pure resolver: DB layout row → position list (template fallback when positions empty). */
export function resolvePositionsFromLayout(
  layout: Pick<EquipmentModelTireLayout, 'template_key' | 'positions' | 'svg_variant'>
): TirePosition[] {
  const custom = parsePositionsJson(layout.positions)
  if (custom.length > 0) return custom
  if (layout.template_key === 'custom') return DEFAULT_TIRE_POSITIONS
  return getPositionsForTemplate(layout.template_key)
}

export function buildResolvedLayout(
  layout: Pick<EquipmentModelTireLayout, 'template_key' | 'positions' | 'svg_variant'>,
  modelId: string
): ResolvedTireLayout {
  return {
    positions: resolvePositionsFromLayout(layout),
    source: 'model',
    template_key: layout.template_key,
    svg_variant: layout.svg_variant ?? 'v1',
    model_id: modelId,
  }
}

export function defaultResolvedLayout(): ResolvedTireLayout {
  return {
    positions: DEFAULT_TIRE_POSITIONS,
    source: 'default',
    template_key: 'truck_6x4',
    svg_variant: 'v1',
    model_id: null,
  }
}

/**
 * Resolve tire positions for an asset via its equipment model layout.
 * Falls back to DEFAULT_TIRE_POSITIONS (6x4 truck) when no model or layout exists.
 */
export async function getPositionsForAsset(
  supabase: SupabaseClient,
  assetId: string
): Promise<ResolvedTireLayout> {
  const { data: asset, error: assetErr } = await supabase
    .from('assets')
    .select('id, model_id')
    .eq('id', assetId)
    .maybeSingle()

  if (assetErr) throw assetErr
  if (!asset?.model_id) return defaultResolvedLayout()

  const { data: layout, error: layoutErr } = await supabase
    .from('equipment_model_tire_layouts')
    .select('template_key, positions, svg_variant')
    .eq('model_id', asset.model_id)
    .maybeSingle()

  if (layoutErr) throw layoutErr
  if (!layout) return defaultResolvedLayout()

  return buildResolvedLayout(
    {
      template_key: (layout.template_key ?? 'truck_6x4') as TireLayoutTemplateKey,
      positions: parsePositionsJson(layout.positions),
      svg_variant: layout.svg_variant ?? 'v1',
    },
    asset.model_id
  )
}
