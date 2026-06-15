'use client'

import Link from 'next/link'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import type {
  DieselOperationalDetails,
  ManttoOperationalDetails,
} from '@/lib/reports/ingresos-gastos-operational-details'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { formatCurrency, formatCurrencyCompact, formatMonthLabel, formatNumber, formatPercent } from '../formatters'
import { DRILLDOWN_LABELS, type DrilldownMetric } from './drilldown-types'

type Props = {
  open: boolean
  metric: DrilldownMetric | null
  focusMonth: string
  onFocusMonthChange: (m: string) => void
  data: CostAnalysisResponse | null
  scopePlantIds: string[]
  operationalLoading: boolean
  operationalError: string | null
  dieselDetails: DieselOperationalDetails | null
  manttoDetails: ManttoOperationalDetails | null
  onClose: () => void
}

export function MetricDrilldownSheet(props: Props) {
  const { data, metric, focusMonth } = props
  const m = focusMonth.slice(0, 7)

  return (
    <Sheet open={props.open} onOpenChange={o => !o && props.onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{metric ? DRILLDOWN_LABELS[metric] : 'Detalle'}</SheetTitle>
          <SheetDescription>
            Desglose para {formatMonthLabel(m)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="drill-month" className="text-xs uppercase tracking-wide text-muted-foreground">
              Mes foco
            </Label>
            <Input
              id="drill-month"
              type="month"
              value={m}
              onChange={e => props.onFocusMonthChange(e.target.value)}
              className="h-8 w-[140px] text-sm"
            />
          </div>

          {props.operationalLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando desglose operativo…
            </div>
          )}

          {props.operationalError && (
            <p className="text-sm text-destructive">{props.operationalError}</p>
          )}

          {data && metric && (
            <DrilldownBody
              metric={metric}
              month={m}
              data={data}
              scopePlantIds={props.scopePlantIds}
              dieselDetails={props.dieselDetails}
              manttoDetails={props.manttoDetails}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DrilldownBody({
  metric,
  month,
  data,
  scopePlantIds,
  dieselDetails,
  manttoDetails,
}: {
  metric: DrilldownMetric
  month: string
  data: CostAnalysisResponse
  scopePlantIds: string[]
  dieselDetails: DieselOperationalDetails | null
  manttoDetails: ManttoOperationalDetails | null
}) {
  const plantRows = data.byPlant
    .filter(p => scopePlantIds.length === 0 || scopePlantIds.includes(p.plantId))
    .map(p => ({
      id: p.plantId,
      code: p.plantCode,
      name: p.plantName,
    }))

  if (metric === 'diesel' && dieselDetails) {
    return (
      <DieselPanel month={month} plants={plantRows} details={dieselDetails} data={data} />
    )
  }
  if (metric === 'mantto') {
    return (
      <ManttoPanel
        month={month}
        data={data}
        plants={plantRows}
        details={manttoDetails}
      />
    )
  }
  if (metric === 'nomina') {
    return <NominaPanel month={month} data={data} />
  }
  if (metric === 'otros') {
    return <OtrosPanel month={month} data={data} />
  }
  if (metric === 'waterfall') {
    return <WaterfallPanel month={month} data={data} />
  }

  return <PlantMetricPanel month={month} data={data} metric={metric} plants={plantRows} />
}

function PlantMetricPanel({
  metric,
  month,
  data,
  plants,
}: {
  metric: DrilldownMetric
  month: string
  data: CostAnalysisResponse
  plants: Array<{ id: string; code: string; name: string }>
}) {
  const rows = data.byPlant
    .filter(p => plants.some(pl => pl.id === p.plantId))
    .map(p => {
      let value = 0
      switch (metric) {
        case 'volume':
          value = p.volume[month] || 0
          break
        case 'ventas':
          value = (p.ventasTotal[month] || 0) + (p.ingresosBombeoTotal[month] || 0)
          break
        case 'costo_mp':
          value = p.costoMpTotal[month] || 0
          break
        case 'spread':
          value = p.spreadUnitario[month] || 0
          break
        case 'costo_op':
          value = p.totalCostoOp[month] || 0
          break
        case 'ebitda':
          value = p.ebitdaConBombeo[month] || 0
          break
        default:
          value = 0
      }
      return { plant: p, value }
    })
    .filter(r => r.value !== 0)
    .sort((a, b) => b.value - a.value)

  const formatValue = (v: number) => {
    if (metric === 'volume') return `${formatNumber(v, 0)} m³`
    if (metric === 'spread') return `${formatCurrency(v)}/m³`
    return formatCurrency(v)
  }

  return (
    <RankedList
      title="Por planta"
      rows={rows.map(r => ({
        key: r.plant.plantId,
        label: `${r.plant.plantCode} · ${r.plant.plantName}`,
        value: formatValue(r.value),
      }))}
      empty="Sin datos por planta en este mes."
    />
  )
}

function DieselPanel({
  month,
  plants,
  details,
  data,
}: {
  month: string
  plants: Array<{ id: string; code: string; name: string }>
  details: DieselOperationalDetails
  data: CostAnalysisResponse
}) {
  const rows = plants
    .map(p => {
      const d = details.byPlantId[p.id]
      if (!d || d.total_liters <= 0) return null
      const volume = data.byPlant.find(bp => bp.plantId === p.id)?.volume[month] ?? 0
      const lpm3 = volume > 0 ? d.total_liters / volume : null
      const lpm3Part = lpm3 != null ? `${formatNumber(lpm3, 2)} L/m³` : null
      const lphPart =
        d.avg_lph_trusted != null ? `${formatNumber(d.avg_lph_trusted, 1)} L/h` : null
      const subParts = [lpm3Part, lphPart, `${d.assets_with_data} activos`].filter(Boolean)
      return {
        key: p.id,
        label: `${p.code} · ${p.name}`,
        value: `${formatNumber(d.total_liters, 0)} L`,
        sub: subParts.join(' · '),
      }
    })
    .filter(Boolean) as Array<{ key: string; label: string; value: string; sub?: string }>

  return (
    <div className="space-y-3">
      <RankedList title={`Diesel · ${formatMonthLabel(month)}`} rows={rows} empty="Sin consumo diesel registrado." />
      <Link
        href="/reportes/eficiencia-diesel"
        className="text-xs font-medium underline-offset-2 hover:underline"
      >
        Ver reporte de eficiencia diesel →
      </Link>
    </div>
  )
}

function ManttoPanel({
  month,
  data,
  plants,
  details,
}: {
  month: string
  data: CostAnalysisResponse
  plants: Array<{ id: string; code: string; name: string }>
  details: ManttoOperationalDetails | null
}) {
  const bucket = data.manttoByType?.[month] || {
    corrective: 0,
    preventive: 0,
    inspection: 0,
    other: 0,
  }
  const diff = data.reconciliation?.manttoTypeDiffByMonth?.[month] ?? 0

  const assets: Array<{ key: string; label: string; value: string; sortAmount: number }> = []
  if (details) {
    for (const p of plants) {
      const pb = details.byPlantId[p.id]
      if (!pb) continue
      for (const a of pb.assets) {
        const amt = a.preventive_cost + a.corrective_cost
        if (amt <= 0) continue
        assets.push({
          key: a.asset_id,
          label: `${a.asset_code} (${p.code})`,
          value: formatCurrencyCompact(amt),
          sortAmount: amt,
        })
      }
      if (pb.unallocated_corrective > 0) {
        assets.push({
          key: `unalloc-${p.id}`,
          label: `Sin activo · ${p.code}`,
          value: formatCurrencyCompact(pb.unallocated_corrective),
          sortAmount: pb.unallocated_corrective,
        })
      }
    }
    assets.sort((a, b) => b.sortAmount - a.sortAmount)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Bucket label="Correctivo" value={bucket.corrective} />
        <Bucket label="Preventivo" value={bucket.preventive} />
        <Bucket label="Inspección" value={bucket.inspection} />
        <Bucket label="Otros" value={bucket.other} />
      </div>
      {Math.abs(diff) > 0.02 && (
        <p className="text-xs text-amber-600">
          Δ vs total P&L: {diff > 0 ? '+' : ''}
          {formatCurrency(diff)} (clasificación PO↔OT independiente)
        </p>
      )}
      <RankedList
        title="Por activo"
        rows={assets.map(({ key, label, value }) => ({ key, label, value }))}
        empty="Sin activos con gasto en este mes."
      />
    </div>
  )
}

function NominaPanel({ month, data }: { month: string; data: CostAnalysisResponse }) {
  const split = data.nominaCashSplit?.[month] || { cash: 0, nonCash: 0 }
  const total = split.cash + split.nonCash
  const depts = data.byDepartment
    .filter(d => d.type === 'nomina')
    .map(d => ({
      key: d.department,
      label: d.department,
      value: formatCurrency(d.monthlyTotals[month] || 0),
    }))
    .filter(d => parseFloat(d.value.replace(/[^0-9.-]/g, '')) !== 0)
    .sort((a, b) => (b.value > a.value ? 1 : -1))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 p-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Efectivo</p>
          <p className="font-semibold tabular-nums">{formatCurrency(split.cash)}</p>
          {total > 0 && (
            <p className="text-xs text-muted-foreground">{formatPercent((split.cash / total) * 100)}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">No efectivo</p>
          <p className="font-semibold tabular-nums">{formatCurrency(split.nonCash)}</p>
          {total > 0 && (
            <p className="text-xs text-muted-foreground">{formatPercent((split.nonCash / total) * 100)}</p>
          )}
        </div>
      </div>
      <RankedList title="Por departamento" rows={depts} empty="Sin nómina en este mes." />
      <Link
        href={`/reportes/gerencial/manual-costs?month=${month}`}
        className="text-xs font-medium underline-offset-2 hover:underline"
      >
        Editar capturas de nómina →
      </Link>
    </div>
  )
}

function OtrosPanel({ month, data }: { month: string; data: CostAnalysisResponse }) {
  const rows = data.byCategory
    .map(c => ({
      key: c.categoryId,
      label: c.categoryName,
      value: formatCurrency(c.monthlyTotals[month] || 0),
    }))
    .filter(r => parseFloat(r.value.replace(/[^0-9.-]/g, '')) !== 0)
    .sort((a, b) => (b.value > a.value ? 1 : -1))

  return <RankedList title="Por categoría" rows={rows} empty="Sin otros indirectos en este mes." />
}

function WaterfallPanel({ month, data }: { month: string; data: CostAnalysisResponse }) {
  const s = data.summary
  const ventas = (s.ventasTotal[month] || 0) + (s.ingresosBombeoTotal[month] || 0)
  const steps: Array<{ label: string; value: number; strong?: boolean }> = [
    { label: 'Ventas + bombeo', value: ventas },
    { label: '(−) Materia prima', value: -(s.costoMpTotal[month] || 0) },
    { label: '(−) Diesel', value: -(s.dieselTotal[month] || 0) },
    { label: '(−) Mantenimiento', value: -(s.manttoTotal[month] || 0) },
    { label: '(−) Nómina', value: -(s.nomina[month] || 0) },
    { label: '(−) Otros indirectos', value: -(s.otrosIndirectos[month] || 0) },
    { label: 'EBITDA', value: s.ebitdaConBombeo[month] || 0, strong: true },
  ]

  return (
    <ul className="divide-y divide-border/50 rounded-lg border border-border/60 text-sm">
      {steps.map(step => (
        <li
          key={step.label}
          className={`flex justify-between gap-2 px-3 py-2 tabular-nums ${step.strong ? 'font-semibold bg-muted/40' : ''}`}
        >
          <span>{step.label}</span>
          <span className={step.value < 0 ? 'text-rose-600' : ''}>{formatCurrency(Math.abs(step.value))}</span>
        </li>
      ))}
    </ul>
  )
}

function Bucket({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{formatCurrency(value)}</p>
    </div>
  )
}

function RankedList({
  title,
  rows,
  empty,
}: {
  title: string
  rows: Array<{ key: string; label: string; value: string; sub?: string }>
  empty: string
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="max-h-[360px] divide-y divide-border/40 overflow-y-auto rounded-lg border border-border/60">
          {rows.map(r => (
            <li key={r.key} className="flex items-baseline justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.label}</p>
                {r.sub && <p className="text-xs text-muted-foreground">{r.sub}</p>}
              </div>
              <span className="flex-shrink-0 font-semibold tabular-nums">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
