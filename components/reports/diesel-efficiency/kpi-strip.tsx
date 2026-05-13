'use client'

import type { EfficiencyRow } from './types'

type Props = {
  rows: EfficiencyRow[]
  prevRows: EfficiencyRow[]
  onFilterAnomaly: () => void
  onFilterQuality: () => void
}

function delta(curr: number, prev: number): { pct: number; up: boolean } | null {
  if (prev === 0) return null
  const pct = ((curr - prev) / prev) * 100
  return { pct, up: pct > 0 }
}

function KpiGauge({
  label,
  value,
  unit,
  delta: d,
  onClick,
  accent,
}: {
  label: string
  value: string
  unit: string
  delta?: { pct: number; up: boolean } | null
  onClick?: () => void
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={[
        'group flex flex-col gap-0.5 px-5 py-3 border-r border-stone-900/[0.07] last:border-r-0',
        'text-left transition-colors duration-100',
        onClick ? 'hover:bg-stone-100/70 cursor-pointer' : 'cursor-default',
        accent ? 'bg-amber-50/60' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="text-[10px] font-medium uppercase tracking-widest text-stone-400 leading-none">
        {label}
      </span>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="tabular-num text-[22px] font-semibold leading-none text-stone-900 tracking-tight">
          {value}
        </span>
        <span className="text-[11px] text-stone-400 font-medium">{unit}</span>
      </div>
      {d != null && (
        <span
          className={[
            'text-[11px] font-medium tabular-num mt-0.5',
            d.up ? 'text-red-600' : 'text-green-700',
          ].join(' ')}
        >
          {d.up ? '▲' : '▼'} {Math.abs(d.pct).toFixed(1)}% vs mes anterior
        </span>
      )}
    </button>
  )
}

export function KpiStrip({ rows, prevRows, onFilterAnomaly, onFilterQuality }: Props) {
  const totalL = rows.reduce((s, r) => s + (r.total_liters ?? 0), 0)
  const prevTotalL = prevRows.reduce((s, r) => s + (r.total_liters ?? 0), 0)

  const lphRows = rows.filter(
    (r) =>
      r.liters_per_hour_trusted != null &&
      r.anomaly_flags.data_quality_tier !== 'severe'
  )
  const avgLph =
    lphRows.length > 0
      ? lphRows.reduce((s, r) => s + (r.liters_per_hour_trusted ?? 0), 0) / lphRows.length
      : null

  const anomalyCount = rows.filter(
    (r) =>
      r.anomaly_flags.efficiency_tier === 'severe' ||
      r.anomaly_flags.breakpoint_mom_lph ||
      r.anomaly_flags.review_consumption_pattern
  ).length

  const severeQualityCount = rows.filter(
    (r) => r.anomaly_flags.data_quality_tier === 'severe'
  ).length

  const assetsWithData = rows.length

  const fmt = (n: number | null, d = 1) =>
    n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d })

  const lDelta = delta(totalL, prevTotalL)

  return (
    <div className="flex flex-wrap divide-x divide-stone-900/[0.07] border border-stone-900/[0.08] rounded-lg bg-white overflow-hidden">
      <KpiGauge
        label="Total litros"
        value={fmt(totalL, 0)}
        unit="L"
        delta={lDelta}
      />
      <KpiGauge
        label="L/h promedio flota"
        value={avgLph != null ? fmt(avgLph, 2) : '—'}
        unit="L/h"
      />
      <KpiGauge
        label="Activos con datos"
        value={String(assetsWithData)}
        unit="activos"
      />
      <KpiGauge
        label="Revisar consumo"
        value={String(anomalyCount)}
        unit={anomalyCount === 1 ? 'activo' : 'activos'}
        onClick={anomalyCount > 0 ? onFilterAnomaly : undefined}
        accent={anomalyCount > 0}
      />
      <KpiGauge
        label="Datos sin confianza"
        value={String(severeQualityCount)}
        unit={severeQualityCount === 1 ? 'activo' : 'activos'}
        onClick={severeQualityCount > 0 ? onFilterQuality : undefined}
        accent={severeQualityCount > 0}
      />
    </div>
  )
}
