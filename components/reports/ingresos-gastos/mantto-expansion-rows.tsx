'use client'

import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ManttoOperationalDetails } from '@/lib/reports/ingresos-gastos-operational-details'
import type { ManttoBucket } from './operational-expansion-state'
import { manttoBucketKey } from './operational-expansion-state'
import type { PlantData } from './operational-expansion-types'
import { renderOperationalCurrencyCells } from './operational-column-utils'

type Props = {
  details: ManttoOperationalDetails
  plants: PlantData[]
  groupedPlants: Record<string, PlantData[]> | null
  groupByBusinessUnit: boolean
  plantColumnCount: number
  formatCurrency: (n: number) => string
  expandedBuckets: Map<string, boolean>
  onToggleBucket: (bucket: ManttoBucket) => void
  renderGrandTotalCell: (total: number, formatFn: (n: number) => string) => React.ReactNode
}

const BUCKET_LABELS: Record<ManttoBucket, string> = {
  preventive: '↳ Mantenimiento preventivo',
  corrective: '↳ Mantenimiento correctivo',
  other: '↳ Otros mantenimiento',
}

function getPlantBucketAmount(
  plantId: string,
  bucket: ManttoBucket,
  byPlant: ManttoOperationalDetails['byPlantId']
): number {
  const p = byPlant[plantId]
  if (!p) return 0
  if (bucket === 'preventive') return p.preventive_total
  if (bucket === 'corrective') return p.corrective_total
  return p.other_total
}

function collectRowsForScope(
  plants: PlantData[],
  byPlant: ManttoOperationalDetails['byPlantId'],
  bucket: ManttoBucket
): Array<{
  row_id: string
  label: string
  plant_id: string
  amount: number
}> {
  const items: Array<{
    row_id: string
    label: string
    plant_id: string
    amount: number
  }> = []

  for (const plant of plants) {
    const pb = byPlant[plant.plant_id]
    if (!pb) continue

    if (bucket === 'other') {
      for (const line of pb.other_lines || []) {
        if (line.amount > 0) {
          items.push({
            row_id: line.id,
            label: line.label,
            plant_id: plant.plant_id,
            amount: line.amount,
          })
        }
      }
      for (const a of pb.assets) {
        if (a.other_cost > 0) {
          items.push({
            row_id: `${a.asset_id}-other`,
            label: a.asset_code,
            plant_id: plant.plant_id,
            amount: a.other_cost,
          })
        }
      }
      continue
    }

    for (const a of pb.assets) {
      const amount =
        bucket === 'preventive' ? a.preventive_cost : a.corrective_cost
      if (amount > 0) {
        items.push({
          row_id: a.asset_id,
          label: a.asset_code,
          plant_id: plant.plant_id,
          amount,
        })
      }
    }
    if (bucket === 'corrective' && (pb.unallocated_corrective ?? 0) > 0) {
      items.push({
        row_id: `unallocated-${plant.plant_id}`,
        label: 'Sin activo asignado',
        plant_id: plant.plant_id,
        amount: pb.unallocated_corrective,
      })
    }
  }

  items.sort((a, b) => b.amount - a.amount)
  return items
}

export function ManttoExpansionRows({
  details,
  plants,
  groupedPlants,
  groupByBusinessUnit,
  plantColumnCount,
  formatCurrency,
  expandedBuckets,
  onToggleBucket,
  renderGrandTotalCell,
}: Props) {
  const byPlant = details.byPlantId
  const buckets: ManttoBucket[] = ['preventive', 'corrective', 'other']

  return (
    <>
      {buckets.map(bucket => {
        const key = manttoBucketKey(bucket)
        const isExpanded = expandedBuckets.get(key) || false
        const grandTotal = plants.reduce(
          (s, p) => s + getPlantBucketAmount(p.plant_id, bucket, byPlant),
          0
        )

        const detailRows = isExpanded
          ? collectRowsForScope(plants, byPlant, bucket)
          : []

        return (
          <React.Fragment key={key}>
            <tr className="bg-muted/20 border-b">
              <td className="sticky left-0 z-10 bg-muted/30 pl-6 p-3 border-r-2 font-medium text-sm">
                <button
                  type="button"
                  onClick={() => onToggleBucket(bucket)}
                  className="flex items-center gap-2 hover:opacity-70 transition-opacity text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                  {BUCKET_LABELS[bucket]}
                </button>
              </td>
              {renderOperationalCurrencyCells({
                plants,
                groupedPlants,
                groupByBusinessUnit,
                getPlantValue: pid => getPlantBucketAmount(pid, bucket, byPlant),
                formatCurrency,
                grandTotal,
                renderGrandTotalCell,
              })}
            </tr>

            {isExpanded &&
              detailRows.map(item => (
                <tr key={`${key}-${item.row_id}`} className="bg-muted/10 border-b">
                  <td className="sticky left-0 z-10 bg-muted/20 pl-14 p-3 border-r-2 text-sm text-muted-foreground">
                    {item.label}
                  </td>
                  {groupByBusinessUnit && groupedPlants
                    ? Object.entries(groupedPlants).map(([buId, buPlants]) => {
                        const buHasPlant = buPlants.some(
                          p => p.plant_id === item.plant_id
                        )
                        const amount = buHasPlant ? item.amount : 0
                        return (
                          <td key={buId} className="text-right p-3 border-r text-sm">
                            {amount > 0 ? formatCurrency(amount) : formatCurrency(0)}
                          </td>
                        )
                      })
                    : plants.map(plant => (
                        <td
                          key={plant.plant_id}
                          className="text-right p-3 border-r text-sm"
                        >
                          {plant.plant_id === item.plant_id
                            ? formatCurrency(item.amount)
                            : formatCurrency(0)}
                        </td>
                      ))}
                  {renderGrandTotalCell(item.amount, formatCurrency)}
                </tr>
              ))}
          </React.Fragment>
        )
      })}
    </>
  )
}
