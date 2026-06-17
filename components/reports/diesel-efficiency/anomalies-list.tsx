'use client'

import { useState } from 'react'
import { AlertTriangle, TrendingUp, Gauge, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EfficiencyRow } from './types'
import {
  deriveAlertKinds,
  followupKey,
  worstOpenStatus,
  type DieselAlertFollowup,
  type DieselAlertKind,
} from './alert-followups'

type Props = {
  rows: EfficiencyRow[]
  yearMonth: string
  followups: Map<string, DieselAlertFollowup>
  onOpenDrill: (row: EfficiencyRow) => void
  onFollowupUpdated: (followup: DieselAlertFollowup) => void
}

type Reason = {
  label: string
  detail: string
  level: 'critical' | 'warning'
  kind: DieselAlertKind
}

function getReasons(r: EfficiencyRow): Reason[] {
  const reasons: Reason[] = []
  const a = r.anomaly_flags

  if (a.breakpoint_mom_lph) {
    reasons.push({
      kind: 'breakpoint_mom',
      label: 'Salto de consumo detectado',
      detail: 'La eficiencia L/h cambió significativamente respecto al mes anterior. Revisar si cambió la operación o si hay error en datos.',
      level: 'critical',
    })
  }

  if (a.efficiency_tier === 'severe') {
    reasons.push({
      kind: 'efficiency_severe',
      label: 'Consumo muy por encima del umbral de categoría',
      detail: `L/h confiable: ${r.liters_per_hour_trusted?.toFixed(2) ?? '—'} — supera el umbral severo para ${r.equipment_category ?? 'esta categoría'}.`,
      level: 'critical',
    })
  } else if (a.efficiency_tier === 'watch') {
    reasons.push({
      kind: 'efficiency_watch',
      label: 'Consumo elevado — en zona de vigilancia',
      detail: `L/h confiable: ${r.liters_per_hour_trusted?.toFixed(2) ?? '—'} — fuera del rango cómodo para ${r.equipment_category ?? 'esta categoría'}.`,
      level: 'warning',
    })
  }

  if (a.review_consumption_pattern) {
    reasons.push({
      kind: 'consumption_pattern',
      label: 'Patrón atípico de consumo',
      detail: 'El sistema detectó un patrón inusual. Puede indicar cambios en operación, fallas de equipo, o datos incorrectos.',
      level: 'warning',
    })
  }

  if (a.data_quality_tier !== 'ok') {
    reasons.push({
      kind: 'data_quality',
      label: 'Calidad de datos deficiente',
      detail: 'Lecturas de horómetro/odómetro incompletas o inconsistentes distorsionan L/h y L/km.',
      level: a.data_quality_tier === 'severe' ? 'critical' : 'warning',
    })
  }

  if (r.quality_flags.merge_fork_km) {
    reasons.push({
      kind: 'data_quality',
      label: 'Divergencia km: curva fusionada vs. transacciones',
      detail:
        'Los km de la curva (odómetro + checklist) difieren de la suma de kilometers_consumed en más del 25%. Revisa lecturas de odómetro.',
      level: 'warning',
    })
  }

  return reasons
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Pendiente',
  acknowledged: 'En seguimiento',
  resolved: 'Resuelto',
}

function AnomalyCard({
  row,
  yearMonth,
  followups,
  onOpenDrill,
  onFollowupUpdated,
}: {
  row: EfficiencyRow
  yearMonth: string
  followups: Map<string, DieselAlertFollowup>
  onOpenDrill: (row: EfficiencyRow) => void
  onFollowupUpdated: (followup: DieselAlertFollowup) => void
}) {
  const reasons = getReasons(row)
  const hasCritical = reasons.some((r) => r.level === 'critical')
  const assetLabel = [row.assets?.asset_id, row.assets?.name].filter(Boolean).join(' — ')
  const assetId = row.assets?.id
  const kinds = deriveAlertKinds(row)
  const trackStatus = assetId ? worstOpenStatus(assetId, kinds, followups) : null
  const [saving, setSaving] = useState(false)

  const updateStatus = async (status: 'acknowledged' | 'resolved') => {
    if (!assetId || kinds.length === 0) return
    setSaving(true)
    try {
      for (const kind of kinds) {
        const r = await fetch('/api/reports/diesel-efficiency-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId,
            yearMonth,
            alertKind: kind,
            status,
          }),
        })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Error al guardar seguimiento')
        if (j.followup) onFollowupUpdated(j.followup as DieselAlertFollowup)
      }
    } catch {
      // silent — user can retry
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={[
      'bg-white border rounded-lg overflow-hidden',
      hasCritical ? 'border-red-200' : 'border-amber-200',
      trackStatus === 'resolved' ? 'opacity-60' : '',
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
            {trackStatus && (
              <p className="text-[10px] font-mono uppercase tracking-wide text-stone-500 mt-0.5">
                Seguimiento: {STATUS_LABEL[trackStatus] ?? trackStatus}
              </p>
            )}
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
        {reasons.map((reason, i) => {
          const fk = assetId ? followupKey(assetId, reason.kind) : null
          const fu = fk ? followups.get(fk) : undefined
          return (
            <div key={i} className="flex gap-2.5">
              <span className={`text-xs mt-0.5 ${reason.level === 'critical' ? 'text-red-500' : 'text-amber-500'}`}>
                {reason.level === 'critical' ? '✕' : '⚠'}
              </span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-stone-700">{reason.label}</p>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{reason.detail}</p>
                {fu?.status === 'resolved' && (
                  <p className="text-[10px] text-green-700 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Marcado resuelto
                  </p>
                )}
              </div>
            </div>
          )
        })}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-stone-600 hover:text-stone-900 -ml-1"
            onClick={() => onOpenDrill(row)}
          >
            <Gauge className="h-3.5 w-3.5 mr-1.5" />
            Ver análisis completo
          </Button>
          {assetId && trackStatus !== 'resolved' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={saving || trackStatus === 'acknowledged'}
                onClick={() => void updateStatus('acknowledged')}
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Tomar seguimiento'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-green-200 text-green-800 hover:bg-green-50"
                disabled={saving}
                onClick={() => void updateStatus('resolved')}
              >
                Marcar resuelto
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function AnomaliesList({ rows, yearMonth, followups, onOpenDrill, onFollowupUpdated }: Props) {
  const anomalies = rows
    .filter(
      (r) =>
        r.anomaly_flags.efficiency_tier === 'severe' ||
        r.anomaly_flags.efficiency_tier === 'watch' ||
        r.anomaly_flags.breakpoint_mom_lph ||
        r.anomaly_flags.review_consumption_pattern ||
        r.anomaly_flags.data_quality_tier !== 'ok'
    )
    .sort((a, b) => {
      const score = (r: EfficiencyRow) => {
        let s = 0
        const aid = r.assets?.id
        if (aid) {
          const st = worstOpenStatus(aid, deriveAlertKinds(r), followups)
          if (st === 'open' || st == null) s += 5
          if (st === 'acknowledged') s += 2
        }
        if (r.anomaly_flags.efficiency_tier === 'severe') s += 4
        if (r.anomaly_flags.breakpoint_mom_lph) s += 3
        if (r.anomaly_flags.efficiency_tier === 'watch') s += 2
        if (r.anomaly_flags.review_consumption_pattern) s += 1
        return s
      }
      return score(b) - score(a)
    })

  const openCount = anomalies.filter((r) => {
    const aid = r.assets?.id
    if (!aid) return true
    const st = worstOpenStatus(aid, deriveAlertKinds(r), followups)
    return st !== 'resolved'
  }).length

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
        {openCount} activo{openCount !== 1 ? 's' : ''} pendientes de seguimiento — ordenados por severidad
      </p>
      {anomalies.map((r) => (
        <AnomalyCard
          key={r.id}
          row={r}
          yearMonth={yearMonth}
          followups={followups}
          onOpenDrill={onOpenDrill}
          onFollowupUpdated={onFollowupUpdated}
        />
      ))}
    </div>
  )
}
