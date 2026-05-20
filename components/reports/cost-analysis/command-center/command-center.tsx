'use client'

import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { shiftMonthString } from '@/lib/reports/month-utils'
import type { DrilldownMetric } from '../drilldown/drilldown-types'
import { KpiTile } from './kpi-tile'
import { computeMoM, formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from '../formatters'
import type { ViewMode } from '../filters/view-mode'

type Props = {
  data: CostAnalysisResponse
  viewMode: ViewMode
  focusMonth: string
  onDrilldown?: (metric: DrilldownMetric) => void
}

function seriesFrom(map: Record<string, number>, months: string[]): number[] {
  return months.map(m => map[m] || 0)
}

function momMonthsForFocus(dataMonths: string[], focusMonth: string): string[] {
  const focus = focusMonth.slice(0, 7)
  const prev = shiftMonthString(focus, -1)
  const pair = [prev, focus].filter(m => dataMonths.includes(m))
  if (pair.length >= 2) return pair
  return dataMonths.length > 0 ? dataMonths : [focus]
}

export function CommandCenter({ data, viewMode, focusMonth, onDrilldown }: Props) {
  const { months, summary } = data
  if (months.length === 0) return null

  const focus = focusMonth.slice(0, 7)
  const momMonths = momMonthsForFocus(months, focus)
  const volume = summary.totalVolume[focus] || 0
  const salesLast = summary.ventasTotal[focus] || 0

  const ventasSeries = seriesFrom(summary.ventasTotal, months).map((v, i) => v + (summary.ingresosBombeoTotal[months[i]] || 0))
  const ventasMoM = computeMoM(
    Object.fromEntries(months.map((m, i) => [m, ventasSeries[i] ?? 0])),
    momMonths
  )

  const volMoM = computeMoM(summary.totalVolume, momMonths)
  const mpMoM = computeMoM(summary.costoMpTotal, momMonths)
  const opMoM = computeMoM(summary.totalCostoOp, momMonths)
  const ebitdaMoM = computeMoM(summary.ebitdaConBombeo, momMonths)
  const spreadMoM = computeMoM(summary.spreadUnitario, momMonths)

  const fmtMoney = (n: number) => formatCurrency(n)
  const fmtPerM3 = (n: number) => `${formatCurrency(volume > 0 ? n / volume : 0)}/m³`
  const fmtPct = (n: number) => (salesLast > 0 ? formatPercent((n / salesLast) * 100) : '—')

  const displayMoney = (totalSeriesValue: number, allowPct = true, allowPerM3 = true) => {
    if (viewMode === 'perM3' && allowPerM3) return fmtPerM3(totalSeriesValue)
    if (viewMode === 'percentSales' && allowPct) return fmtPct(totalSeriesValue)
    return fmtMoney(totalSeriesValue)
  }

  const ventasDisplay = viewMode === 'perM3'
    ? `${formatCurrency(volume > 0 ? ventasMoM.current / volume : 0)}/m³`
    : viewMode === 'percentSales'
      ? '100%'
      : formatCurrency(ventasMoM.current)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KpiTile
        label="Volumen concreto"
        value={`${formatNumber(volMoM.current, 0)} m³`}
        subValue={summary.fcPonderada[focus] > 0 ? `f'c ${formatNumber(summary.fcPonderada[focus], 0)} kg/cm²` : undefined}
        delta={volMoM.delta}
        deltaPct={volMoM.deltaPct}
        series={seriesFrom(summary.totalVolume, months)}
        accent="volume"
        onDrilldown={onDrilldown ? () => onDrilldown('volume') : undefined}
      />

      <KpiTile
        label="Ventas totales"
        value={ventasDisplay}
        subValue={summary.ingresosBombeoTotal[focus] > 0
          ? `incl. bombeo ${formatCurrencyCompact(summary.ingresosBombeoTotal[focus])}`
          : undefined}
        delta={ventasMoM.delta}
        deltaPct={ventasMoM.deltaPct}
        series={ventasSeries}
        accent="revenue"
        onDrilldown={onDrilldown ? () => onDrilldown('ventas') : undefined}
      />

      <KpiTile
        label="Costo materia prima"
        value={displayMoney(mpMoM.current)}
        subValue={summary.consumoCemM3[focus] > 0
          ? `${formatNumber(summary.consumoCemM3[focus], 0)} kg cem/m³`
          : undefined}
        delta={mpMoM.delta}
        deltaPct={mpMoM.deltaPct}
        invertDeltaColor
        series={seriesFrom(summary.costoMpTotal, months)}
        accent="material"
        onDrilldown={onDrilldown ? () => onDrilldown('costo_mp') : undefined}
      />

      <KpiTile
        label="Spread unitario"
        value={`${formatCurrency(summary.spreadUnitario[focus])}/m³`}
        subValue={salesLast > 0 ? `${formatPercent((summary.spreadUnitario[focus] / (summary.pvUnitario[focus] || 1)) * 100)} del precio` : undefined}
        delta={spreadMoM.delta}
        deltaPct={spreadMoM.deltaPct}
        series={seriesFrom(summary.spreadUnitario, months)}
        accent="indirect"
        onDrilldown={onDrilldown ? () => onDrilldown('spread') : undefined}
      />

      <KpiTile
        label="Costo operativo"
        value={displayMoney(opMoM.current)}
        subValue={viewMode !== 'absolute' ? undefined : (volume > 0 ? `${formatCurrency(opMoM.current / volume)}/m³` : undefined)}
        delta={opMoM.delta}
        deltaPct={opMoM.deltaPct}
        invertDeltaColor
        series={seriesFrom(summary.totalCostoOp, months)}
        accent="cost"
        emptyReason={opMoM.current === 0 && opMoM.previous > 0 ? 'awaiting-entry' : undefined}
        onDrilldown={onDrilldown ? () => onDrilldown('costo_op') : undefined}
      />

      <KpiTile
        label="EBITDA (incl. bombeo)"
        value={viewMode === 'percentSales'
          ? formatPercent(summary.ebitdaConBombeoPct[focus] || 0)
          : formatCurrency(ebitdaMoM.current)}
        subValue={viewMode !== 'percentSales'
          ? `${formatPercent(summary.ebitdaConBombeoPct[focus] || 0)} margen`
          : volume > 0 ? `${formatCurrency(ebitdaMoM.current / volume)}/m³` : undefined}
        delta={ebitdaMoM.delta}
        deltaPct={ebitdaMoM.deltaPct}
        series={seriesFrom(summary.ebitdaConBombeo, months)}
        accent="margin"
        onDrilldown={onDrilldown ? () => onDrilldown('ebitda') : undefined}
      />
    </div>
  )
}
