'use client'

import { AlertTriangle, TrendingUp, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EfficiencyRow } from './types'

type Props = {
  rows: EfficiencyRow[]
  onOpenDrill: (row: EfficiencyRow) => void
}

type Reason = {
  label: string
  detail: string
  level: 'critical' | 'warning'
}

function getReasons(r: EfficiencyRow): Reason[] {
  const reasons: Reason[] = []
  const a = r.anomaly_flags

  if (a.breakpoint_mom_lph) {
    reasons.push({
      label: 'Salto de consumo detectado',
      detail: 'La eficiencia L/h cambió significativamente respecto al mes anterior. Revisar si cambió la operación o si hay error en datos.',
      level: 'critical',
    })
  }

  if (a.efficiency_tier === 'severe') {
    reasons.push({
      label: 'Consumo muy por encima del umbral de categoría',
      detail: `L/h confiable: ${r.liters_per_hour_trusted?.toFixed(2) ?? '—'} — supera el umbral severo para ${r.equipment_category ?? 'esta categoría'}.`,
      level: 'critical',
    })
  } else if (a.efficiency_tier === 'watch') {
    reasons.push({
      label: 'Consumo elevado — en zona de vigilancia',
      detail: `L/h confiable: ${r.liters_per_hour_trusted?.toFixed(2) ?? '—'} — fuera del rango cómodo para ${r.equipment_category ?? 'esta categoría'}.`,
      level: 'warning',
    })
  }

  if (a.review_consumption_pattern) {
    reasons.push({
      label: 'Patrón atípico de consumo',
      detail: 'El sistema detectó un patrón inusual. Puede indicar cambios en operación, fallas de equipo, o datos incorrectos.',
      level: 'warning',
    })
  }

  return reasons
}

function AnomalyCard({ row, onOpenDrill }: { row: EfficiencyRow; onOpenDrill: (r: EfficiencyRow) => void }) {
  const reasons = getReasons(row)
  const hasCritical = reasons.some((r) => r.level === 'critical')
  const assetLabel = [row.assets?.asset_id, row.assets?.name].filter(Boolean).join(' — ')

  return (
    <div className={[
      'bg-white border rounded-lg overflow-hidden',
      hasCritical ? 'border-red-200' : 'border-amber-200',
    ].join(' ')}>
      <div className={[
        'px-4 py-3 flex items-center justify-between',
        hasCritical ? 'bg-red-50' : 'bg-amber-50',
      ].join(' ')}>
        <div className="flex items-center gap-2.5">
          <div className={[
            'rounded-full p-1.5',
            hasCritical ? 'bg-red-100' : 'bg-amber-100',
          ].join(' ')}>
            {hasCritical
              ? <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
              : <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
            }
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-800">{assetLabel}</p>
            <p className="text-[11px] text-stone-500">{row.equipment_category ?? 'Sin categoría'} · {row.year_month}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">L/h</p>
            <p className={`tabular-num text-sm font-bold ${hasCritical ? 'text-red-700' : 'text-amber-700'}`}>
              {row.liters_per_hour_trusted?.toFixed(2) ?? '—'}
            </p>
          </div>
          <div className="text-right ml-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Total L</p>
            <p className="tabular-num text-sm font-bold text-stone-700">
              {row.total_liters.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        {reasons.map((reason, i) => (
          <div key={i} className="flex gap-2.5">
            <span className={`text-xs mt-0.5 ${reason.level === 'critical' ? 'text-red-500' : 'text-amber-500'}`}>
              {reason.level === 'critical' ? '✕' : '⚠'}
            </span>
            <div>
              <p className="text-xs font-semibold text-stone-700">{reason.label}</p>
              <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{reason.detail}</p>
            </div>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-8 text-xs text-stone-600 hover:text-stone-900 -ml-1"
          onClick={() => onOpenDrill(row)}
        >
          <Gauge className="h-3.5 w-3.5 mr-1.5" />
          Ver análisis completo
        </Button>
      </div>
    </div>
  )
}

export function AnomaliesList({ rows, onOpenDrill }: Props) {
  const anomalies = rows
    .filter(
      (r) =>
        r.anomaly_flags.efficiency_tier === 'severe' ||
        r.anomaly_flags.efficiency_tier === 'watch' ||
        r.anomaly_flags.breakpoint_mom_lph ||
        r.anomaly_flags.review_consumption_pattern
    )
    .sort((a, b) => {
      const score = (r: EfficiencyRow) => {
        let s = 0
        if (r.anomaly_flags.efficiency_tier === 'severe') s += 4
        if (r.anomaly_flags.breakpoint_mom_lph) s += 3
        if (r.anomaly_flags.efficiency_tier === 'watch') s += 2
        if (r.anomaly_flags.review_consumption_pattern) s += 1
        return s
      }
      return score(b) - score(a)
    })

  if (anomalies.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 mb-4">
          <span className="text-2xl">✓</span>
        </div>
        <p className="text-stone-600 font-medium">Sin anomalías detectadas</p>
        <p className="text-stone-400 text-sm mt-1">
          Todos los activos están dentro de los parámetros esperados para este mes
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-stone-400 uppercase tracking-widest font-medium px-0.5">
        {anomalies.length} activo{anomalies.length !== 1 ? 's' : ''} requieren atención — ordenados por severidad
      </p>
      {anomalies.map((r) => (
        <AnomalyCard key={r.id} row={r} onOpenDrill={onOpenDrill} />
      ))}
    </div>
  )
}
