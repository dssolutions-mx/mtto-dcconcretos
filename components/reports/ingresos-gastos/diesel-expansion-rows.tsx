'use client'

import React from 'react'
import type { DieselOperationalDetails } from '@/lib/reports/ingresos-gastos-operational-details'
import type { PlantData } from './operational-expansion-types'
import { sumForBu, weightedMeanForBu } from './operational-column-utils'

type Props = {
  details: DieselOperationalDetails
  plants: PlantData[]
  groupedPlants: Record<string, PlantData[]> | null
  groupByBusinessUnit: boolean
  formatNumber: (n: number, decimals?: number) => string
  renderGrandTotalPlain: (display: string) => React.ReactNode
}

type MetricRow = {
  label: string
  caption?: string
  isAverage: boolean
  getPlantValue: (plantId: string) => number | null
  formatFn: (val: number | null) => string
  aggregateGrand: () => number | null
}

function renderCells(
  props: {
    row: MetricRow
    plants: PlantData[]
    groupedPlants: Record<string, PlantData[]> | null
    groupByBusinessUnit: boolean
    get: (plantId: string) => DieselOperationalDetails['byPlantId'][string] | undefined
    renderGrandTotalPlain: (display: string) => React.ReactNode
  }
) {
  const { row, plants, groupedPlants, groupByBusinessUnit, get, renderGrandTotalPlain } = props

  if (groupByBusinessUnit && groupedPlants) {
    return (
      <>
        {Object.entries(groupedPlants).map(([buId, buPlants]) => {
          let display: string
          if (row.isAverage) {
            const v = weightedMeanForBu(
              buPlants,
              row.getPlantValue,
              pid => get(pid)?.assets_with_data ?? 0
            )
            display = row.formatFn(v)
          } else {
            const sum = sumForBu(buPlants, pid => row.getPlantValue(pid) ?? 0)
            display = row.formatFn(sum)
          }
          return (
            <td key={buId} className="text-right p-3 border-r text-sm">
              {display}
            </td>
          )
        })}
        {renderGrandTotalPlain(row.formatFn(row.aggregateGrand()))}
      </>
    )
  }

  return (
    <>
      {plants.map(plant => {
        const v = row.getPlantValue(plant.plant_id)
        return (
          <td key={plant.plant_id} className="text-right p-3 border-r text-sm">
            {row.formatFn(v)}
          </td>
        )
      })}
      {renderGrandTotalPlain(row.formatFn(row.aggregateGrand()))}
    </>
  )
}

export function DieselExpansionRows({
  details,
  plants,
  groupedPlants,
  groupByBusinessUnit,
  formatNumber,
  renderGrandTotalPlain,
}: Props) {
  const byPlant = details.byPlantId
  const get = (plantId: string) => byPlant[plantId]

  const rows: MetricRow[] = [
    {
      label: '↳ Litros consumidos',
      caption: 'Métricas operativas; el total superior es costo FIFO.',
      isAverage: false,
      getPlantValue: pid => get(pid)?.total_liters ?? 0,
      formatFn: v => (v != null ? `${formatNumber(v, 0)} L` : '—'),
      aggregateGrand: () =>
        plants.reduce((s, p) => s + (get(p.plant_id)?.total_liters ?? 0), 0),
    },
    {
      label: '↳ L/m³ concreto',
      isAverage: false,
      getPlantValue: pid => {
        const liters = get(pid)?.total_liters ?? 0
        const vol = plants.find(p => p.plant_id === pid)?.volumen_concreto ?? 0
        return vol > 0 ? liters / vol : null
      },
      formatFn: v => (v != null ? `${formatNumber(v, 2)} L/m³` : '—'),
      aggregateGrand: () => {
        const totalLiters = plants.reduce(
          (s, p) => s + (get(p.plant_id)?.total_liters ?? 0),
          0
        )
        const totalVol = plants.reduce((s, p) => s + (p.volumen_concreto ?? 0), 0)
        return totalVol > 0 ? totalLiters / totalVol : null
      },
    },
    {
      label: '↳ L/h promedio flota',
      isAverage: true,
      getPlantValue: pid => get(pid)?.avg_lph_trusted ?? null,
      formatFn: v => (v != null ? `${formatNumber(v, 2)} L/h` : '—'),
      aggregateGrand: () => {
        let weighted = 0
        let totalWeight = 0
        for (const p of plants) {
          const d = get(p.plant_id)
          if (
            d?.avg_lph_trusted != null &&
            Number.isFinite(d.avg_lph_trusted) &&
            d.assets_with_data > 0
          ) {
            weighted += d.avg_lph_trusted * d.assets_with_data
            totalWeight += d.assets_with_data
          }
        }
        return totalWeight > 0 ? weighted / totalWeight : null
      },
    },
    {
      label: '↳ L/km promedio',
      isAverage: true,
      getPlantValue: pid => get(pid)?.avg_lpk ?? null,
      formatFn: v => (v != null ? `${formatNumber(v, 2)} L/km` : '—'),
      aggregateGrand: () => {
        let weighted = 0
        let totalWeight = 0
        for (const p of plants) {
          const d = get(p.plant_id)
          if (d?.avg_lpk != null && Number.isFinite(d.avg_lpk) && d.assets_with_data > 0) {
            weighted += d.avg_lpk * d.assets_with_data
            totalWeight += d.assets_with_data
          }
        }
        return totalWeight > 0 ? weighted / totalWeight : null
      },
    },
    {
      label: '↳ Activos con datos',
      isAverage: false,
      getPlantValue: pid => get(pid)?.assets_with_data ?? 0,
      formatFn: v => (v != null ? String(Math.round(v)) : '—'),
      aggregateGrand: () =>
        plants.reduce((s, p) => s + (get(p.plant_id)?.assets_with_data ?? 0), 0),
    },
  ]

  return (
    <>
      {rows.map((row, idx) => (
        <tr key={row.label} className="bg-muted/10 border-b">
          <td className="sticky left-0 z-10 bg-muted/20 pl-10 p-3 border-r-2 text-sm text-muted-foreground">
            {row.label}
            {idx === 0 && row.caption ? (
              <span className="block text-xs italic mt-1 font-normal">{row.caption}</span>
            ) : null}
          </td>
          {renderCells({
            row,
            plants,
            groupedPlants,
            groupByBusinessUnit,
            get,
            renderGrandTotalPlain,
          })}
        </tr>
      ))}
    </>
  )
}
