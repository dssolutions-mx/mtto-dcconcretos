'use client'

import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { KpiTile } from './kpi-tile'
import { computeMoM, formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from '../formatters'
import type { ViewMode } from '../filters/view-mode'

type Props = {
  data: CostAnalysisResponse
  viewMode: ViewMode
}

function seriesFrom(map: Record<string, number>, months: string[]): number[] {
  return months.map(m => map[m] || 0)
}

export function CommandCenter({ data, viewMode }: Props) {
  const { months, summary } = data
  if (months.length === 0) return null

  // Latest-month series snapshots
  const lastMonth = months[months.length - 1]
  const volume = summary.totalVolume[lastMonth] || 0

  // Compute the right representation per metric given view mode.
  // For "percentSales" the denominator is ventas_total for the same month.
  const salesLast = summary.ventasTotal[lastMonth] || 0

  const ventasSeries = seriesFrom(summary.ventasTotal, months).map((v, i) => v + (summary.ingresosBombeoTotal[months[i]] || 0))
  const ventasMoM = computeMoM(
    Object.fromEntries(months.map((m, i) => [m, ventasSeries[i]])),
    months
  )

  const volMoM = computeMoM(summary.totalVolume, months)
  const mpMoM = computeMoM(summary.costoMpTotal, months)
  const opMoM = computeMoM(summary.totalCostoOp, months)
  const ebitdaMoM = computeMoM(summary.ebitdaConBombeo, months)
  const spreadMoM = computeMoM(summary.spreadUnitario, months)

  // Formatters based on view mode
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
        subValue={summary.fcPonderada[lastMonth] > 0 ? `f'c ${formatNumber(summary.fcPonderada[lastMonth], 0)} kg/cm²` : undefined}
        delta={volMoM.delta}
        deltaPct={volMoM.deltaPct}
        series={seriesFrom(summary.totalVolume, months)}
        accent="volume"
      />

      <KpiTile
        label="Ventas totales"
        value={ventasDisplay}
        subValue={summary.ingresosBombeoTotal[lastMonth] > 0
          ? `incl. bombeo ${formatCurrencyCompact(summary.ingresosBombeoTotal[lastMonth])}`
          : undefined}
        delta={ventasMoM.delta}
        deltaPct={ventasMoM.deltaPct}
        series={ventasSeries}
        accent="revenue"
      />

      <KpiTile
        label="Costo materia prima"
        value={displayMoney(mpMoM.current)}
        subValue={summary.consumoCemM3[lastMonth] > 0
          ? `${formatNumber(summary.consumoCemM3[lastMonth], 0)} kg cem/m³`
          : undefined}
        delta={mpMoM.delta}
        deltaPct={mpMoM.deltaPct}
        invertDeltaColor
        series={seriesFrom(summary.costoMpTotal, months)}
        accent="material"
      />

      <KpiTile
        label="Spread unitario"
        value={`${formatCurrency(summary.spreadUnitario[lastMonth])}/m³`}
        subValue={salesLast > 0 ? `${formatPercent((summary.spreadUnitario[lastMonth] / (summary.pvUnitario[lastMonth] || 1)) * 100)} del precio` : undefined}
        delta={spreadMoM.delta}
        deltaPct={spreadMoM.deltaPct}
        series={seriesFrom(summary.spreadUnitario, months)}
        accent="indirect"
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
      />

      <KpiTile
        label="EBITDA (incl. bombeo)"
        value={viewMode === 'percentSales'
          ? formatPercent(summary.ebitdaConBombeoPct[lastMonth] || 0)
          : formatCurrency(ebitdaMoM.current)}
        subValue={viewMode !== 'percentSales'
          ? `${formatPercent(summary.ebitdaConBombeoPct[lastMonth] || 0)} margen`
          : volume > 0 ? `${formatCurrency(ebitdaMoM.current / volume)}/m³` : undefined}
        delta={ebitdaMoM.delta}
        deltaPct={ebitdaMoM.deltaPct}
        series={seriesFrom(summary.ebitdaConBombeo, months)}
        accent="margin"
      />
    </div>
  )
}
