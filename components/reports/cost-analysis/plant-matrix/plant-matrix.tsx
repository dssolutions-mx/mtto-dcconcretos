'use client'

import { useMemo, useState } from 'react'
import type { CostAnalysisPlantRow, CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from '../formatters'
import { PlantDrawer } from './plant-drawer'

type Props = {
  data: CostAnalysisResponse
}

type Col = {
  key: string
  label: string
  /** Where to read the monthly value from a plant row. */
  get: (p: CostAnalysisPlantRow, m: string) => number
  /** true = lower is better (expense) */
  invertDelta?: boolean
  format: (v: number) => string
  type: 'money' | 'percent' | 'number'
}

const COLS: Col[] = [
  { key: 'volumen', label: 'Volumen (m³)', get: (p, m) => p.volume[m] || 0, format: (v) => formatNumber(v, 0), type: 'number' },
  { key: 'ventas', label: 'Ventas', get: (p, m) => (p.ventasTotal[m] || 0) + (p.ingresosBombeoTotal[m] || 0), format: formatCurrencyCompact, type: 'money' },
  { key: 'costoMp', label: 'Costo MP', get: (p, m) => p.costoMpTotal[m] || 0, format: formatCurrencyCompact, type: 'money', invertDelta: true },
  { key: 'diesel', label: 'Diesel', get: (p, m) => p.dieselTotal[m] || 0, format: formatCurrencyCompact, type: 'money', invertDelta: true },
  { key: 'mantto', label: 'Mantto', get: (p, m) => p.manttoTotal[m] || 0, format: formatCurrencyCompact, type: 'money', invertDelta: true },
  { key: 'nomina', label: 'Nómina', get: (p, m) => p.nomina[m] || 0, format: formatCurrencyCompact, type: 'money', invertDelta: true },
  { key: 'otros', label: 'Otros', get: (p, m) => p.otrosIndirectos[m] || 0, format: formatCurrencyCompact, type: 'money', invertDelta: true },
  { key: 'ebitda', label: 'EBITDA', get: (p, m) => p.ebitdaConBombeo[m] || 0, format: formatCurrencyCompact, type: 'money' },
  { key: 'ebitdaPct', label: 'EBITDA %', get: (p, m) => p.ebitdaConBombeoPct[m] || 0, format: (v) => formatPercent(v, 1), type: 'percent' },
]

type SortKey = 'plant' | typeof COLS[number]['key']

export function PlantMatrix({ data }: Props) {
  const { months, byPlant } = data
  const hasMonths = months.length > 0
  const last = hasMonths ? months[months.length - 1] : ''
  const prev = months.length > 1 ? months[months.length - 2] : null
  const [sortKey, setSortKey] = useState<SortKey>('ventas')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<CostAnalysisPlantRow | null>(null)

  const rows = useMemo(() => {
    const withMetrics = byPlant
      .filter(p => hasMonths && ((p.ventasTotal[last] || 0) > 0 || (p.totalCostoOp[last] || 0) > 0))
      .map(p => {
        const cells: Record<string, { current: number; previous: number; delta: number; deltaPct: number | null }> = {}
        for (const col of COLS) {
          const current = col.get(p, last)
          const previous = prev ? col.get(p, prev) : 0
          const delta = current - previous
          const deltaPct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null
          cells[col.key] = { current, previous, delta, deltaPct }
        }
        return { plant: p, cells }
      })

    return withMetrics.sort((a, b) => {
      if (sortKey === 'plant') {
        return sortDir === 'asc'
          ? a.plant.plantCode.localeCompare(b.plant.plantCode)
          : b.plant.plantCode.localeCompare(a.plant.plantCode)
      }
      const av = a.cells[sortKey]?.current || 0
      const bv = b.cells[sortKey]?.current || 0
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [byPlant, last, prev, sortKey, sortDir, hasMonths])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  if (!hasMonths || rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin plantas con actividad en el mes.</p>
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th
                className="sticky left-0 z-10 cursor-pointer bg-muted/60 px-3 py-2 text-left font-medium hover:text-foreground"
                onClick={() => toggleSort('plant')}
              >
                <div className="flex items-center gap-1">
                  Planta
                  {sortKey === 'plant' && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </div>
              </th>
              {COLS.map(c => (
                <th
                  key={c.key}
                  className="cursor-pointer px-3 py-2 text-right font-medium hover:text-foreground"
                  onClick={() => toggleSort(c.key)}
                >
                  <div className="flex items-center justify-end gap-1">
                    {c.label}
                    {sortKey === c.key && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map(r => (
              <tr
                key={r.plant.plantId}
                onClick={() => setSelected(r.plant)}
                className="cursor-pointer transition-colors hover:bg-muted/30"
              >
                <td className="sticky left-0 bg-background px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground tabular-num">{r.plant.plantCode}</span>
                    <span className="truncate font-medium">{r.plant.plantName}</span>
                  </div>
                </td>
                {COLS.map(c => {
                  const cell = r.cells[c.key]
                  const goodDirection = c.invertDelta ? cell.delta < 0 : cell.delta > 0
                  const deltaTone =
                    cell.delta === 0
                      ? 'text-muted-foreground'
                      : goodDirection
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                  return (
                    <td key={c.key} className="px-3 py-2 text-right align-top">
                      <div className="flex flex-col items-end">
                        <span className="font-medium tabular-num">{c.format(cell.current)}</span>
                        {cell.deltaPct !== null ? (
                          <span className={cn('text-[11px] tabular-num', deltaTone)}>
                            {cell.deltaPct > 0 ? '+' : ''}
                            {cell.deltaPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PlantDrawer
        plant={selected}
        onClose={() => setSelected(null)}
        months={months}
      />
    </>
  )
}
