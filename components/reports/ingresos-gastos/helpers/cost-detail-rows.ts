/**
 * Group expanded cost detail entries so one manual adjustment appears as one row
 * with amounts per plant column (instead of one row per plant).
 */

export type CostDetailEntryWithPlant = {
  id: string
  description: string | null
  subcategory: string | null
  expense_subcategory?: string | null
  amount: number
  plantId?: string
}

/** Derive parent adjustment id from API entry id (UUID, UUID-distId, or UUID-distId-dept). */
export function adjustmentIdFromEntryId(entryId: string): string {
  if (entryId === 'autoconsumo-plant_indirect_material_costs') return entryId
  let withoutSuffix = entryId
  if (withoutSuffix.endsWith('-dept')) withoutSuffix = withoutSuffix.slice(0, -'-dept'.length)
  else if (withoutSuffix.endsWith('-bu')) withoutSuffix = withoutSuffix.slice(0, -'-bu'.length)
  const parts = withoutSuffix.split('-')
  // Single UUID has 5 hyphen-separated segments
  if (parts.length <= 5) return withoutSuffix
  return parts.slice(0, 5).join('-')
}

export type GroupedCostLine = {
  rowKey: string
  label: string
  amountsByPlant: Map<string, number>
}

export function groupCostDetailEntriesByAdjustment(
  entries: CostDetailEntryWithPlant[],
  labelFor: (e: CostDetailEntryWithPlant) => string
): GroupedCostLine[] {
  const groups = new Map<string, { label: string; amountsByPlant: Map<string, number> }>()

  for (const entry of entries) {
    const adjKey = adjustmentIdFromEntryId(entry.id)
    const plantId = entry.plantId || 'unknown'
    if (!groups.has(adjKey)) {
      groups.set(adjKey, { label: labelFor(entry), amountsByPlant: new Map() })
    }
    const g = groups.get(adjKey)!
    const next = (g.amountsByPlant.get(plantId) || 0) + entry.amount
    g.amountsByPlant.set(plantId, next)
    const nextLabel = labelFor(entry)
    if (nextLabel && nextLabel !== 'Sin descripción') {
      g.label = nextLabel
    }
  }

  return Array.from(groups.entries())
    .map(([rowKey, v]) => ({
      rowKey,
      label: v.label || 'Sin descripción',
      amountsByPlant: v.amountsByPlant,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}
