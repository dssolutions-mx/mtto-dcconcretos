import type { SupabaseClient } from '@supabase/supabase-js'

export interface TirePartLine {
  type: 'tire'
  tire_id: string
  name: string
  position_code?: string | null
  quantity: number
  unit_cost: number
  total_price: number
  source: 'tire_event' | 'tire_purchase'
}

export async function buildTirePartsForWorkOrder(
  supabase: SupabaseClient,
  workOrderId: string
): Promise<TirePartLine[]> {
  const lines: TirePartLine[] = []
  const seenTires = new Set<string>()

  const { data: events } = await supabase
    .from('tire_events')
    .select('tire_id, cost, from_position, to_position, event_type, tire:tires(brand, size, purchase_cost)')
    .eq('work_order_id', workOrderId)

  for (const ev of events ?? []) {
    const tire = ev.tire as { brand?: string; size?: string; purchase_cost?: number } | null
    if (!ev.tire_id || seenTires.has(ev.tire_id)) continue

    const eventCost = Number(ev.cost) || 0
    const purchaseCost =
      ev.event_type === 'montaje' ? Number(tire?.purchase_cost) || 0 : 0
    const total = eventCost + purchaseCost
    if (total <= 0) continue

    seenTires.add(ev.tire_id)
    lines.push({
      type: 'tire',
      tire_id: ev.tire_id,
      name: tire ? `${tire.brand ?? 'Llanta'} ${tire.size ?? ''}`.trim() : 'Llanta',
      position_code: ev.to_position ?? ev.from_position ?? null,
      quantity: 1,
      unit_cost: total,
      total_price: total,
      source: eventCost > 0 ? 'tire_event' : 'tire_purchase',
    })
  }

  // Installations mounted under this WO without separate event cost
  const { data: installs } = await supabase
    .from('asset_tire_installations')
    .select('tire_id, position_code, tire:tires(brand, size, purchase_cost)')
    .eq('work_order_id', workOrderId)

  for (const inst of installs ?? []) {
    if (!inst.tire_id || seenTires.has(inst.tire_id)) continue
    const tire = inst.tire as { brand?: string; size?: string; purchase_cost?: number } | null
    const purchaseCost = Number(tire?.purchase_cost) || 0
    if (purchaseCost <= 0) continue

    seenTires.add(inst.tire_id)
    lines.push({
      type: 'tire',
      tire_id: inst.tire_id,
      name: tire ? `${tire.brand ?? 'Llanta'} ${tire.size ?? ''}`.trim() : 'Llanta',
      position_code: inst.position_code,
      quantity: 1,
      unit_cost: purchaseCost,
      total_price: purchaseCost,
      source: 'tire_purchase',
    })
  }

  return lines
}

export function mergePartsWithTireLines(
  existingParts: unknown,
  tireLines: TirePartLine[]
): unknown[] {
  let base: unknown[] = []
  if (Array.isArray(existingParts)) {
    base = existingParts
  } else if (typeof existingParts === 'string') {
    try {
      const parsed = JSON.parse(existingParts)
      if (Array.isArray(parsed)) base = parsed
    } catch {
      base = []
    }
  }

  if (tireLines.length === 0) return base
  const existingTireIds = new Set(
    base
      .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
      .map((p) => p.tire_id as string)
      .filter(Boolean)
  )

  const merged = [...base]
  for (const line of tireLines) {
    if (!existingTireIds.has(line.tire_id)) {
      merged.push(line)
    }
  }
  return merged
}
