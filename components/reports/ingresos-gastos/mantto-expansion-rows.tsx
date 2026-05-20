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
}

function getPlantBucketAmount(
  plantId: string,
  bucket: ManttoBucket,
  byPlant: ManttoOperationalDetails['byPlantId']
): number {
  const p = byPlant[plantId]
  if (!p) return 0
  return bucket === 'preventive' ? p.preventive_total : p.corrective_total
}

function collectAssetsForScope(
  plants: PlantData[],
  byPlant: ManttoOperationalDetails['byPlantId'],
  bucket: ManttoBucket
): Array<{
  asset_id: string
  asset_code: string
  plant_id: string
  amount: number
}> {
  const items: Array<{
    asset_id: string
    asset_code: string
    plant_id: string
    amount: number
  }> = []
  for (const plant of plants) {
    const pb = byPlant[plant.plant_id]
    if (!pb) continue
    for (const a of pb.assets) {
      const amount =
        bucket === 'preventive' ? a.preventive_cost : a.corrective_cost
      if (amount > 0) {
        items.push({
          asset_id: a.asset_id,
          asset_code: a.asset_code,
          plant_id: plant.plant_id,
          amount,
        })
      }
    }
    if (bucket === 'corrective' && (pb.unallocated_corrective ?? 0) > 0) {
      items.push({
        asset_id: `unallocated-${plant.plant_id}`,
        asset_code: 'Sin activo asignado',
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

  const manttoTotalsMismatch = plants.some(p => {
    const pb = byPlant[p.plant_id]
    if (!pb) return false
    const sum = pb.preventive_total + pb.corrective_total
    return Math.abs(sum - p.mantto_total) > 0.05
  })

  const buckets: ManttoBucket[] = ['preventive', 'corrective']

  return (
    <>
      {manttoTotalsMismatch && (
        <tr className="bg-amber-50/80 dark:bg-amber-950/20">
          <td
            colSpan={plantColumnCount + 2}
            className="pl-10 p-2 text-amber-900 dark:text-amber-200 text-xs border-r-2"
          >
            La suma del desglose (preventivo + correctivo) no coincide con el total MANTTO. de
            esta fila; revise datos o POs sin orden de trabajo.
          </td>
        </tr>
      )}

      {buckets.map(bucket => {
        const key = manttoBucketKey(bucket)
        const isExpanded = expandedBuckets.get(key) || false
        const grandTotal = plants.reduce(
          (s, p) => s + getPlantBucketAmount(p.plant_id, bucket, byPlant),
          0
        )

        const assetRows = isExpanded
          ? collectAssetsForScope(plants, byPlant, bucket)
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
              assetRows.map(item => {
                return (
                  <tr key={`${key}-${item.asset_id}`} className="bg-muted/10 border-b">
                    <td className="sticky left-0 z-10 bg-muted/20 pl-14 p-3 border-r-2 text-sm text-muted-foreground">
                      {item.asset_code}
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
                )
              })}
          </React.Fragment>
        )
      })}
    </>
  )
}
