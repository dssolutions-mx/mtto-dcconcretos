'use client'

import { AlertCircle, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EfficiencyRow } from './types'

type Props = {
  rows: EfficiencyRow[]
  onOpenDrill: (row: EfficiencyRow) => void
}

function QualityScore(row: EfficiencyRow): number {
  const q = row.quality_flags
  const a = row.anomaly_flags
  let score = 0
  if (a.data_quality_tier === 'severe') score += 100
  if (a.data_quality_tier === 'watch') score += 50
  if (q.negative_hours_consumed_count > 0) score += q.negative_hours_consumed_count * 10
  if ((q.negative_kilometers_consumed_count ?? 0) > 0) score += (q.negative_kilometers_consumed_count ?? 0) * 10
  if (q.null_previous_horometer_count > 0) score += q.null_previous_horometer_count * 5
  if ((q.null_previous_kilometer_count ?? 0) > 0) score += (q.null_previous_kilometer_count ?? 0) * 5
  if (q.merge_fork) score += 20
  if (q.merge_fork_km) score += 20
  return score
}

function QualityRow({ row, onOpenDrill }: { row: EfficiencyRow; onOpenDrill: (r: EfficiencyRow) => void }) {
  const q = row.quality_flags
  const a = row.anomaly_flags
  const assetLabel = [row.assets?.asset_id, row.assets?.name].filter(Boolean).join(' — ')
  const nullRatio = q.tx_count > 0 ? q.null_previous_horometer_count / q.tx_count : 0
  const nullKmRatio = q.tx_count > 0 ? (q.null_previous_kilometer_count ?? 0) / q.tx_count : 0
  const isSevere = a.data_quality_tier === 'severe'

  return (
    <div className={[
      'flex items-center gap-4 px-4 py-3 bg-white border rounded-lg',
      isSevere ? 'border-red-200' : 'border-amber-200',
    ].join(' ')}>
      {/* Left quality strip */}
      <div
        className="self-stretch w-[3px] rounded-full flex-shrink-0"
        style={{ background: isSevere ? '#B91C1C' : '#B45309' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-stone-800 truncate">{assetLabel}</p>
            <p className="text-[11px] text-stone-500">{row.equipment_category ?? 'Sin categoría'}</p>
          </div>
          <span className={[
            'flex-shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border',
            isSevere
              ? 'text-red-700 bg-red-50 border-red-200'
              : 'text-amber-700 bg-amber-50 border-amber-200',
          ].join(' ')}>
            {isSevere ? 'Severo' : 'Vigilar'}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {q.null_previous_horometer_count > 0 && (
            <span className="text-xs text-stone-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />
              {q.null_previous_horometer_count}/{q.tx_count} tx sin horómetro previo ({(nullRatio * 100).toFixed(0)}%)
            </span>
          )}
          {q.negative_hours_consumed_count > 0 && (
            <span className="text-xs text-red-600 flex items-center gap-1 font-medium">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              {q.negative_hours_consumed_count} delta(s) negativos
            </span>
          )}
          {q.merge_fork && (
            <span className="text-xs text-stone-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-stone-400 flex-shrink-0" />
              Divergencia horas: curva vs. suma TX
            </span>
          )}
          {(q.null_previous_kilometer_count ?? 0) > 0 && (
            <span className="text-xs text-stone-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />
              {q.null_previous_kilometer_count}/{q.tx_count} tx sin odómetro previo ({(nullKmRatio * 100).toFixed(0)}%)
            </span>
          )}
          {(q.negative_kilometers_consumed_count ?? 0) > 0 && (
            <span className="text-xs text-red-600 flex items-center gap-1 font-medium">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              {q.negative_kilometers_consumed_count} delta(s) km negativos
            </span>
          )}
          {q.merge_fork_km && (
            <span className="text-xs text-stone-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-stone-400 flex-shrink-0" />
              Divergencia km: curva vs. suma TX
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="flex-shrink-0 h-8 text-xs text-stone-600 hover:text-stone-900"
        onClick={() => onOpenDrill(row)}
      >
        <Gauge className="h-3.5 w-3.5 mr-1" />
        Ver
      </Button>
    </div>
  )
}

export function DataQualityList({ rows, onOpenDrill }: Props) {
  const problematic = rows
    .filter(
      (r) =>
        r.anomaly_flags.data_quality_tier !== 'ok' ||
        r.quality_flags.negative_hours_consumed_count > 0 ||
        (r.quality_flags.negative_kilometers_consumed_count ?? 0) > 0
    )
    .sort((a, b) => QualityScore(b) - QualityScore(a))

  if (problematic.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 mb-4">
          <span className="text-2xl">✓</span>
        </div>
        <p className="text-stone-600 font-medium">Datos de calidad confiable</p>
        <p className="text-stone-400 text-sm mt-1">
          Todos los activos tienen lecturas coherentes de horómetro y odómetro para este mes
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-stone-400 uppercase tracking-widest font-medium px-0.5">
        {problematic.length} activo{problematic.length !== 1 ? 's' : ''} con datos incompletos — ordenados por impacto
      </p>
      <div className="callout-attention text-xs mb-4">
        <p className="font-semibold text-amber-800 mb-1">¿Cómo afectan estos problemas?</p>
        <p className="text-amber-700">
          Las lecturas faltantes o incorrectas distorsionan los cálculos de L/h.
          Corrige el horómetro previo en la transacción de diésel afectada y usa «Recalcular»
          para actualizar las métricas.
        </p>
      </div>
      {problematic.map((r) => (
        <QualityRow key={r.id} row={r} onOpenDrill={onOpenDrill} />
      ))}
    </div>
  )
}
