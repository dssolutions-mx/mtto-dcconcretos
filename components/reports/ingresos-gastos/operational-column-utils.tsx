'use client'

import React from 'react'
import type { PlantData } from './operational-expansion-types'

export type { PlantData }

export function sumForBu(
  buPlants: PlantData[],
  getPlantValue: (plantId: string) => number
): number {
  return buPlants.reduce((s, p) => s + getPlantValue(p.plant_id), 0)
}

export function weightedMeanForBu(
  buPlants: PlantData[],
  getPlantValue: (plantId: string) => number | null,
  getWeight: (plantId: string) => number
): number | null {
  let weighted = 0
  let totalWeight = 0
  for (const p of buPlants) {
    const v = getPlantValue(p.plant_id)
    const w = getWeight(p.plant_id)
    if (v != null && Number.isFinite(v) && w > 0) {
      weighted += v * w
      totalWeight += w
    }
  }
  return totalWeight > 0 ? weighted / totalWeight : null
}

export function renderOperationalPlantCells(props: {
  plants: PlantData[]
  groupedPlants: Record<string, PlantData[]> | null
  groupByBusinessUnit: boolean
  getPlantValue: (plantId: string) => number | null
  formatFn: (val: number | null) => string
  grandTotal: number | null
  renderGrandTotal: (display: string) => React.ReactNode
}): React.ReactNode {
  const {
    plants,
    groupedPlants,
    groupByBusinessUnit,
    getPlantValue,
    formatFn,
    grandTotal,
    renderGrandTotal,
  } = props

  if (groupByBusinessUnit && groupedPlants) {
    return (
      <>
        {Object.entries(groupedPlants).map(([buId, buPlants]) => {
          const vals = buPlants.map(p => getPlantValue(p.plant_id))
          const allNull = vals.every(v => v == null)
          const sum = vals.reduce((s, v) => s + (v ?? 0), 0)
          const display = allNull && vals.length > 0 ? '—' : formatFn(sum)
          return (
            <td key={buId} className="text-right p-3 border-r text-sm">
              {display}
            </td>
          )
        })}
        {renderGrandTotal(
          grandTotal != null && Number.isFinite(grandTotal)
            ? formatFn(grandTotal)
            : '—'
        )}
      </>
    )
  }

  return (
    <>
      {plants.map(plant => {
        const v = getPlantValue(plant.plant_id)
        return (
          <td key={plant.plant_id} className="text-right p-3 border-r text-sm">
            {v == null ? '—' : formatFn(v)}
          </td>
        )
      })}
      {renderGrandTotal(
        grandTotal != null && Number.isFinite(grandTotal)
          ? formatFn(grandTotal)
          : '—'
      )}
    </>
  )
}

export function renderOperationalCurrencyCells(props: {
  plants: PlantData[]
  groupedPlants: Record<string, PlantData[]> | null
  groupByBusinessUnit: boolean
  getPlantValue: (plantId: string) => number
  formatCurrency: (n: number) => string
  grandTotal: number
  renderGrandTotalCell: (total: number, formatFn: (n: number) => string) => React.ReactNode
}): React.ReactNode {
  const {
    plants,
    groupedPlants,
    groupByBusinessUnit,
    getPlantValue,
    formatCurrency,
    grandTotal,
    renderGrandTotalCell,
  } = props

  if (groupByBusinessUnit && groupedPlants) {
    return (
      <>
        {Object.entries(groupedPlants).map(([buId, buPlants]) => (
          <td key={buId} className="text-right p-3 border-r text-sm">
            {formatCurrency(sumForBu(buPlants, getPlantValue))}
          </td>
        ))}
        {renderGrandTotalCell(grandTotal, formatCurrency)}
      </>
    )
  }

  return (
    <>
      {plants.map(plant => (
        <td key={plant.plant_id} className="text-right p-3 border-r text-sm">
          {formatCurrency(getPlantValue(plant.plant_id))}
        </td>
      ))}
      {renderGrandTotalCell(grandTotal, formatCurrency)}
    </>
  )
}
