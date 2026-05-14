'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { AlertCircle, CheckCircle2, AlertTriangle, Pencil, X, Loader2, ChevronDown, ChevronRight, Info, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TransactionEvidenceModal } from '@/components/diesel-inventory/transaction-evidence-modal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { EfficiencyRow, MeterEvent } from './types'
import {
  resolveTrustedOperatingHours,
  resolveTrustedOperatingKilometers,
} from '@/lib/reports/diesel-efficiency-hours-policy'
import {
  buildMergedHoursReadingEventsForAsset,
  mergedHoursWindowDetails,
  type MergedHoursWindowDetails,
} from '@/lib/reports/merged-operating-hours'
import { buildMergedKmReadingEventsForAsset } from '@/lib/reports/merged-operating-km'
import { mexicoCityMonthWindowFromYm } from '@/lib/reports/mexico-city-report-window'

type TrendPoint = {
  month: string
  lph: number | null
  lpk: number | null
  lpm3: number | null
  liters: number
  hours_merged: number
  hours_sum_raw: number
  km_merged: number
  km_sum_raw: number
  km_trusted: number
}

type Props = {
  row: EfficiencyRow | null
  yearMonth: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onDataChanged?: () => void
}

/** Half-open meter/API window aligned with compute-asset-diesel-efficiency-monthly (America/Mexico_City). */
function monthIsoRange(yearMonth: string): { from: string; to: string } {
  const w = mexicoCityMonthWindowFromYm(yearMonth)
  return { from: w.startInclusiveIso, to: w.endExclusiveIso }
}

const SOURCE_LABEL: Record<string, string> = {
  diesel_consumption: 'Carga diésel',
  checklist_completion: 'Checklist',
  asset_field_audit: 'Auditoría',
}

function SourceIcon({ kind }: { kind: string | null }) {
  if (kind === 'diesel_consumption') return <span className="text-amber-600 text-[10px] font-semibold">⛽</span>
  if (kind === 'checklist_completion') return <span className="text-blue-500 text-[10px] font-semibold">✓</span>
  return <span className="text-stone-400 text-[10px]">○</span>
}

function QualityIcon({ event }: { event: MeterEvent }) {
  const hasNull = event.previous_hours == null
  const negative =
    event.hours_consumed != null && event.hours_consumed < 0

  if (negative) {
    return (
      <span title="Horas consumidas negativas — revisar">
        <AlertCircle className="h-3.5 w-3.5 text-red-500 inline" />
      </span>
    )
  }
  if (hasNull && event.source_kind === 'diesel_consumption') {
    return (
      <span title="Sin horómetro previo">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 inline" />
      </span>
    )
  }
  return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 inline" />
}

type EditState = {
  txId: string
  sourceKind: 'diesel_consumption' | 'checklist_completion'
  /** Event date is before the report month — hours do not count toward this month’s total */
  isPriorMonthContext: boolean
  currentReading: number | null
  prevReading: number | null
  newReading: string
  newPrevReading: string
  safeMaxPrev: number | null
  safeMin: number | null
  safeMax: number | null
  saving: boolean
  error: string | null
}

type RemisionEntry = {
  remision_number: string
  fecha: string
  hora_carga: string
  volumen_fabricado: number | null
  cancelled_reason: string | null
}

function EventsTab({
  events,
  loading,
  onRefresh,
  yearMonth,
  remisiones,
}: {
  events: MeterEvent[]
  loading: boolean
  onRefresh: () => void
  yearMonth: string
  remisiones: RemisionEntry[]
}) {
  const [editing, setEditing] = useState<EditState | null>(null)
  const [priorMonthExpanded, setPriorMonthExpanded] = useState(false)
  const [showRemisiones, setShowRemisiones] = useState(false)
  const [evidenceTxId, setEvidenceTxId] = useState<string | null>(null)
  const hasKmEvents = events.some(ev => ev.km_reading != null || ev.previous_km != null)
  const [meterMode, setMeterMode] = useState<'hours' | 'km'>('hours')

  const fmt = (n: number | null | undefined, d = 2) =>
    n == null || !Number.isFinite(Number(n))
      ? '—'
      : Number(n).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d })

  // Determine the month boundary
  const { from: monthStart } = monthIsoRange(yearMonth)
  const monthBoundaryDate = new Date(monthStart)

  const openEdit = (ev: MeterEvent) => {
    setEditing({
      txId: ev.source_id,
      sourceKind: ev.source_kind as 'diesel_consumption' | 'checklist_completion',
      isPriorMonthContext: new Date(ev.event_at) < monthBoundaryDate,
      currentReading: ev.hours_reading,
      prevReading: ev.previous_hours,
      newReading: String(ev.hours_reading ?? ''),
      newPrevReading: String(ev.previous_hours ?? ''),
      safeMaxPrev: null,
      safeMin: null,
      safeMax: null,
      saving: false,
      error: null,
    })
  }

  const saveEdit = async () => {
    if (!editing) return
    const val = parseFloat(editing.newReading)
    if (!Number.isFinite(val) || val < 0) {
      setEditing(e => e ? { ...e, error: 'Lectura de horómetro inválida' } : null)
      return
    }
    const prevVal = editing.newPrevReading.trim() === '' ? null : parseFloat(editing.newPrevReading)
    if (prevVal !== null && !Number.isFinite(prevVal)) {
      setEditing(e => e ? { ...e, error: 'Horómetro previo inválido' } : null)
      return
    }
    setEditing(e => e ? { ...e, saving: true, error: null } : null)
    try {
      const isDiesel = editing.sourceKind === 'diesel_consumption'
      const body: Record<string, unknown> = {
        reason: 'Corrección manual desde reporte de eficiencia',
      }
      if (isDiesel) {
        body.horometer_reading = val
        if (prevVal !== null) body.previous_horometer = prevVal
      } else {
        body.hours_reading = val
        if (prevVal !== null) body.previous_hours = prevVal
      }
      const endpoint = isDiesel
        ? `/api/diesel/transactions/${editing.txId}/meters`
        : `/api/checklists/${editing.txId}/meters`
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setEditing(e => e ? {
          ...e,
          saving: false,
          error: json.error ?? 'Error al guardar',
          safeMaxPrev: json.safe_max_prev ?? e.safeMaxPrev,
          safeMin: json.safe_min ?? e.safeMin,
          safeMax: json.safe_max ?? e.safeMax,
        } : null)
        return
      }
      setEditing(null)
      onRefresh()
    } catch {
      setEditing(e => e ? { ...e, saving: false, error: 'Error de conexión' } : null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 py-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 bg-stone-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-stone-400 text-sm">Sin eventos de horómetro en este mes</p>
      </div>
    )
  }

  const hasContextEvents = events.some(ev => new Date(ev.event_at) < monthBoundaryDate)

  const evidenceEvent =
    evidenceTxId != null
      ? events.find(e => e.source_id === evidenceTxId && e.source_kind === 'diesel_consumption')
      : null
  const evidenceModalSubheader =
    evidenceEvent != null
      ? [
          new Date(evidenceEvent.event_at).toLocaleString('es-MX', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Mexico_City',
          }),
          evidenceEvent.quantity_liters != null
            ? `${Number(evidenceEvent.quantity_liters).toLocaleString('es-MX', { maximumFractionDigits: 0 })} L`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : undefined

  return (
    <div className="space-y-3">
      <TransactionEvidenceModal
        transactionId={evidenceTxId}
        isOpen={evidenceTxId != null}
        onClose={() => setEvidenceTxId(null)}
        headerTitle="Evidencia de la carga"
        subheader={evidenceModalSubheader}
      />

      {/* Context note */}
      {hasContextEvents && (
        <button
          onClick={() => setPriorMonthExpanded(v => !v)}
          className="w-full text-left text-xs bg-stone-50 border border-stone-200 rounded-md px-3 py-2.5 text-stone-600 hover:bg-stone-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Info className="h-3 w-3 text-stone-400 shrink-0" />
              <p className="font-medium text-stone-700">Eventos de mes anterior</p>
            </div>
            {priorMonthExpanded ? <ChevronDown className="h-3.5 w-3.5 text-stone-400" /> : <ChevronRight className="h-3.5 w-3.5 text-stone-400" />}
          </div>
          {!priorMonthExpanded && <p className="text-[10px] text-stone-400 mt-0.5 ml-5">Clic para ver • Sus horas no cuentan hacia este mes</p>}
          {priorMonthExpanded && <p className="text-[10px] text-stone-500 mt-1 ml-5">Sus horas <strong>no cuentan</strong> hacia el total de este mes.</p>}
        </button>
      )}

      {/* Edit panel */}
      {editing && (() => {
        const newR = parseFloat(editing.newReading)
        const newP = editing.newPrevReading.trim() === '' ? null : parseFloat(editing.newPrevReading)
        const deltaH = Number.isFinite(newR) && newP != null && Number.isFinite(newP) ? newR - newP : null
        const deltaOk = deltaH == null || deltaH >= 0
        return (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-800">Corregir transacción de horómetro</p>
                {editing.isPriorMonthContext && (
                  <p className="text-[11px] text-amber-800/90 mt-1.5 leading-snug max-w-md">
                    Fecha anterior al mes de este reporte (contexto). Puedes corregir el horómetro; las horas de este evento no suman al total del mes mostrado, pero sí afectan meses y cargas vinculadas.
                  </p>
                )}
                <p className="text-xs text-stone-500 mt-0.5">
                  Valores originales — previo:&nbsp;
                  <span className="font-mono font-medium">
                    {editing.prevReading != null ? editing.prevReading.toLocaleString('es-MX', { maximumFractionDigits: 1 }) : '—'} h
                  </span>
                  {' · '}lectura:&nbsp;
                  <span className="font-mono font-medium text-red-600">
                    {editing.currentReading != null ? editing.currentReading.toLocaleString('es-MX', { maximumFractionDigits: 1 }) : '—'} h
                  </span>
                </p>
              </div>
              <button onClick={() => setEditing(null)} className="text-stone-400 hover:text-stone-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 block mb-1">
                  Horómetro previo (h)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Vacío = sin cambio"
                  value={editing.newPrevReading}
                  onChange={e => setEditing(s => s ? { ...s, newPrevReading: e.target.value, error: null, safeMaxPrev: null } : null)}
                  className={`w-full h-8 px-3 text-sm font-mono border rounded-md bg-white focus:outline-none focus:ring-2 focus:border-transparent ${editing.safeMaxPrev != null ? 'border-red-300 focus:ring-red-400' : 'border-stone-200 focus:ring-amber-400'}`}
                  disabled={editing.saving}
                />
                {editing.safeMaxPrev != null && (
                  <p className="text-[10px] text-red-600 mt-1">
                    Máx. permitido: <span className="font-mono font-semibold">{editing.safeMaxPrev.toLocaleString('es-MX', { maximumFractionDigits: 1 })} h</span>
                  </p>
                )}
                {editing.safeMin != null && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    Mín. sugerido: <span className="font-mono font-semibold">{editing.safeMin.toLocaleString('es-MX', { maximumFractionDigits: 1 })} h</span>
                  </p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 block mb-1">
                  Lectura actual (h)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editing.newReading}
                  onChange={e => setEditing(s => s ? { ...s, newReading: e.target.value, error: null, safeMax: null, safeMin: null } : null)}
                  className={`w-full h-8 px-3 text-sm font-mono border rounded-md bg-white focus:outline-none focus:ring-2 focus:border-transparent ${editing.safeMax != null ? 'border-red-300 focus:ring-red-400' : 'border-stone-200 focus:ring-amber-500'}`}
                  disabled={editing.saving}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') void saveEdit() }}
                />
                {editing.safeMax != null && (
                  <p className="text-[10px] text-red-600 mt-1">
                    Máx. permitido: <span className="font-mono font-semibold">{editing.safeMax.toLocaleString('es-MX', { maximumFractionDigits: 1 })} h</span>
                  </p>
                )}
              </div>
            </div>

            {/* Live delta preview */}
            <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-mono ${deltaH == null ? 'bg-stone-100 text-stone-400' : deltaOk ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              <span className="font-semibold">Δh =</span>
              <span>{deltaH == null ? '—' : `${deltaH.toLocaleString('es-MX', { maximumFractionDigits: 1 })} h`}</span>
              {!deltaOk && <span className="ml-1">— delta negativo, corrige los valores</span>}
            </div>

            {editing.error && (
              <p className="text-xs text-red-600 font-medium">{editing.error}</p>
            )}

            <div className="flex items-center justify-between">
              <p className="text-[11px] text-stone-400 max-w-xs">
                Al guardar: la transacción siguiente se actualiza automáticamente y el rollup del mes se recalcula.
              </p>
              <Button
                size="sm"
                className="h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0"
                onClick={() => void saveEdit()}
                disabled={editing.saving || !deltaOk}
              >
                {editing.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar corrección'}
              </Button>
            </div>
          </div>
        )
      })()}

      {/* Flat table of events + optional remisiones */}
      {(() => {
        type TableRow =
          | { kind: 'meter'; sortKey: number; isPrior: boolean; ev: MeterEvent }
          | { kind: 'remision'; sortKey: number; isPrior: boolean; rem: RemisionEntry }

        const rows: TableRow[] = [
          ...events.map(ev => ({
            kind: 'meter' as const,
            sortKey: new Date(ev.event_at).getTime(),
            isPrior: new Date(ev.event_at) < monthBoundaryDate,
            ev,
          })),
          ...(showRemisiones ? remisiones.map(rem => ({
            kind: 'remision' as const,
            sortKey: new Date(`${rem.fecha}T${rem.hora_carga}`).getTime(),
            isPrior: new Date(`${rem.fecha}T${rem.hora_carga}`) < monthBoundaryDate,
            rem,
          })) : []),
        ].sort((a, b) => a.sortKey - b.sortKey)

        const visibleRows = rows.filter(r => priorMonthExpanded || !r.isPrior)

        return (
          <div className="space-y-2">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2">
              {hasKmEvents ? (
                <div className="flex items-center gap-0.5 bg-stone-100 rounded-full p-0.5">
                  <button
                    onClick={() => setMeterMode('hours')}
                    className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors ${meterMode === 'hours' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                  >
                    Horas
                  </button>
                  <button
                    onClick={() => setMeterMode('km')}
                    className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors ${meterMode === 'km' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                  >
                    Kilómetros
                  </button>
                </div>
              ) : <div />}
              {remisiones.length > 0 && (
                <button
                  onClick={() => setShowRemisiones(v => !v)}
                  className={`flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors ${showRemisiones ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700'}`}
                >
                  🏗 {showRemisiones ? 'Ocultar remisiones' : `Ver remisiones (${remisiones.length})`}
                </button>
              )}
            </div>

            {/* Table */}
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-900/[0.07]">
                  <th className="text-left py-1.5 pr-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400 w-6"></th>
                  <th className="text-left py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Fecha</th>
                  <th className="text-left py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Origen</th>
                  <th className="text-right py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400">{meterMode === 'km' ? 'Prev. KM' : 'Prev. H'}</th>
                  <th className="text-right py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400">{meterMode === 'km' ? 'Lectura KM' : 'Lectura H'}</th>
                  <th className="text-right py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400">{meterMode === 'km' ? 'Δ KM' : 'Δ H'}</th>
                  <th className="text-right py-1.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Litros</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => {
                  if (row.kind === 'remision') {
                    const rem = row.rem
                    const isCancelled = rem.cancelled_reason != null
                    return (
                      <tr key={`rem-${rem.remision_number}`} className={`border-b border-stone-900/[0.04] ${row.isPrior ? 'opacity-40' : ''} ${isCancelled ? 'opacity-30 line-through' : ''}`}>
                        <td className="py-1.5 pr-2 text-stone-400 text-[11px]">🏗</td>
                        <td className="py-1.5 pr-3 text-stone-500 tabular-num">
                          {new Date(`${rem.fecha}T${rem.hora_carga}`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' })}
                        </td>
                        <td className="py-1.5 pr-3 text-stone-500">Rem. {rem.remision_number}</td>
                        <td className="py-1.5 pr-3 text-right text-stone-400">—</td>
                        <td className="py-1.5 pr-3 text-right text-stone-400">—</td>
                        <td className="py-1.5 pr-3 text-right text-stone-400">—</td>
                        <td className="py-1.5 text-right font-mono font-semibold text-stone-700 tabular-num">
                          {rem.volumen_fabricado != null ? `${rem.volumen_fabricado} m³` : '—'}
                        </td>
                        <td></td>
                      </tr>
                    )
                  }

                  const ev = row.ev
                  const isDieselLoad = ev.source_kind === 'diesel_consumption'
                  const isSuspicious =
                    (ev.hours_consumed != null && (ev.hours_consumed < 0 || ev.hours_consumed > 1000)) ||
                    (ev.hours_reading != null && ev.previous_hours != null && ev.hours_reading - ev.previous_hours > 1000)
                  const isEditing = editing?.txId === ev.source_id
                  const canEdit =
                    ev.source_kind === 'diesel_consumption' || ev.source_kind === 'checklist_completion'
                  return (
                    <tr
                      key={`${ev.source_kind}-${ev.source_id}-${i}`}
                      tabIndex={isDieselLoad ? 0 : undefined}
                      role={isDieselLoad ? 'button' : undefined}
                      title={isDieselLoad ? 'Clic para ver evidencia fotográfica de esta carga' : undefined}
                      onClick={() => {
                        if (isDieselLoad) setEvidenceTxId(ev.source_id)
                      }}
                      onKeyDown={e => {
                        if (!isDieselLoad) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setEvidenceTxId(ev.source_id)
                        }
                      }}
                      className={`border-b border-stone-900/[0.04] ${
                        isEditing ? 'bg-amber-50'
                        : row.isPrior ? 'opacity-45 hover:opacity-100 transition-opacity'
                        : isSuspicious ? 'bg-red-50/40'
                        : 'hover:bg-stone-50/60'
                      } ${isDieselLoad ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:ring-inset' : ''}`}
                    >
                      <td className="py-1.5 pr-2">
                        {row.isPrior ? <span className="text-stone-300 text-[10px]">↑</span> : <QualityIcon event={ev} />}
                      </td>
                      <td className="py-1.5 pr-3 text-stone-500 tabular-num whitespace-nowrap">
                        {new Date(ev.event_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' })}
                      </td>
                      <td className="py-1.5 pr-3">
                        <div className="flex items-center gap-1">
                          <SourceIcon kind={ev.source_kind} />
                          <span className={row.isPrior ? 'text-stone-400' : 'text-stone-700'}>
                            {SOURCE_LABEL[ev.source_kind ?? ''] ?? ev.source_kind ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono tabular-num text-stone-500">
                        {meterMode === 'km'
                          ? (ev.previous_km != null ? fmt(ev.previous_km, 0) : '—')
                          : (ev.previous_hours != null ? fmt(ev.previous_hours, 1) : '—')}
                      </td>
                      <td className={`py-1.5 pr-3 text-right font-mono tabular-num font-semibold ${isSuspicious ? 'text-red-600' : 'text-stone-800'}`}>
                        {meterMode === 'km'
                          ? (ev.km_reading != null ? fmt(ev.km_reading, 0) : '—')
                          : (ev.hours_reading != null ? fmt(ev.hours_reading, 1) : '—')}
                      </td>
                      <td className={`py-1.5 pr-3 text-right font-mono tabular-num ${ev.hours_consumed != null && ev.hours_consumed < 0 ? 'text-red-600 font-bold' : 'text-stone-500'}`}>
                        {meterMode === 'km'
                          ? (ev.km_consumed != null ? fmt(ev.km_consumed, 0) : '—')
                          : (ev.hours_consumed != null ? fmt(ev.hours_consumed, 1) : '—')}
                      </td>
                      <td className="py-1.5 text-right font-mono tabular-num font-semibold text-amber-700">
                        {ev.quantity_liters != null ? fmt(ev.quantity_liters, 0) : '—'}
                      </td>
                      <td className="py-1.5 pl-1">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              openEdit(ev)
                            }}
                            className={`p-1 rounded hover:bg-stone-200 transition-colors ${isSuspicious ? 'text-red-400' : 'text-stone-300 hover:text-stone-600'}`}
                            title={
                              row.isPrior
                                ? 'Corregir horómetro (fecha en mes anterior al del reporte)'
                                : 'Corregir lectura'
                            }
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })()}
    </div>
  )
}

function TrendTab({
  activeYearMonth,
  trendSummaryRow,
  trendSummaryLoading,
  trend,
  loading,
  onShowHorasBreakdown,
  onShowKmBreakdown,
}: {
  activeYearMonth: string
  trendSummaryRow: EfficiencyRow | null
  trendSummaryLoading: boolean
  trend: TrendPoint[]
  loading: boolean
  onShowHorasBreakdown: () => void
  onShowKmBreakdown?: () => void
}) {
  if (loading) {
    return (
      <div className="space-y-3 py-4">
        <div className="h-32 bg-stone-100 rounded animate-pulse" />
        <div className="h-24 bg-stone-100 rounded animate-pulse" />
      </div>
    )
  }

  if (trend.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-stone-400 text-sm">Sin datos históricos disponibles</p>
        <p className="text-stone-300 text-xs mt-1">Se necesitan al menos 2 meses calculados</p>
      </div>
    )
  }

  const hasFork = trend.some(
    (t) => t.hours_merged > 0 && t.hours_sum_raw > 0 && Math.abs(t.hours_merged - t.hours_sum_raw) / t.hours_merged > 0.1
  )

  // Average L/h across months with data
  const lphValues = trend.map(t => t.lph).filter((v): v is number => v != null && v > 0)
  const avgLph = lphValues.length > 0 ? lphValues.reduce((s, v) => s + v, 0) / lphValues.length : null

  const lpm3Values = trend.map(t => t.lpm3).filter((v): v is number => v != null && v > 0 && Number.isFinite(v))
  const avgLpm3 = lpm3Values.length > 0 ? lpm3Values.reduce((s, v) => s + v, 0) / lpm3Values.length : null
  const hasLpm3Trend = lpm3Values.length > 0

  const trendHasKm = trend.some((t) => t.lpk != null && Number(t.lpk) > 0)

  const snap = trendSummaryRow
  const snapHasKm =
    snap != null &&
    ((snap.kilometers_trusted ?? 0) > 0 ||
      (snap.kilometers_merged ?? 0) > 0 ||
      snap.kilometers_sum_raw > 0)

  const summaryStrip =
    snap == null && trendSummaryLoading ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
        <div className="h-[52px] bg-stone-100 rounded-md animate-pulse" />
        <div className="h-[52px] bg-stone-100 rounded-md animate-pulse" />
        <div className="h-[52px] bg-stone-100 rounded-md animate-pulse" />
      </div>
    ) : snap == null ? (
      <p className="text-[11px] text-stone-500 mt-2 px-0.5">
        Sin fila de eficiencia para <span className="font-mono">{activeYearMonth}</span>. Recalcula el mes en el listado
        o revisa que exista consumo diésel para este activo.
      </p>
    ) : (
      <>
        <div
          className={
            snapHasKm ? 'grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2' : 'grid grid-cols-2 gap-2 mt-2'
          }
        >
          <div className="bg-stone-50 border border-stone-900/[0.06] rounded-md px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Litros mes</p>
            <p className="text-sm font-semibold tabular-num text-stone-800 mt-0.5">
              {snap.total_liters.toLocaleString('es-MX', { maximumFractionDigits: 0 })} L
            </p>
          </div>
          <button
            type="button"
            onClick={onShowHorasBreakdown}
            className="bg-stone-50 border border-stone-900/[0.06] rounded-md px-3 py-2 text-left hover:bg-stone-100 hover:border-amber-300 transition-colors group"
          >
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">h fusionadas</p>
              <Info className="h-2.5 w-2.5 text-stone-300 group-hover:text-amber-500 transition-colors" />
            </div>
            <p className="text-sm font-semibold tabular-num text-stone-800 mt-0.5">{snap.hours_merged.toFixed(1)} h</p>
          </button>
          {snapHasKm ? (
            <>
              {onShowKmBreakdown ? (
                <button
                  type="button"
                  onClick={onShowKmBreakdown}
                  className="bg-stone-50 border border-stone-900/[0.06] rounded-md px-3 py-2 text-left hover:bg-stone-100 hover:border-sky-300 transition-colors group"
                >
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">km fusionados</p>
                    <Info className="h-2.5 w-2.5 text-stone-300 group-hover:text-sky-500 transition-colors" />
                  </div>
                  <p className="text-sm font-semibold tabular-num text-stone-800 mt-0.5">
                    {(snap.kilometers_merged ?? 0).toFixed(0)} km
                  </p>
                </button>
              ) : (
                <div className="bg-stone-50 border border-stone-900/[0.06] rounded-md px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">km fusionados</p>
                  <p className="text-sm font-semibold tabular-num text-stone-800 mt-0.5">
                    {(snap.kilometers_merged ?? 0).toFixed(0)} km
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-stone-50 border border-stone-900/[0.06] rounded-md px-3 py-2 sm:col-span-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">h suma TX</p>
              <p className="text-sm font-semibold tabular-num text-stone-800 mt-0.5">{snap.hours_sum_raw.toFixed(1)} h</p>
            </div>
          )}
        </div>
      </>
    )

  return (
    <div className="space-y-5 py-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">L/h por mes</p>
          {avgLph != null && (
            <span className="text-[10px] text-stone-400 font-mono">
              Promedio <span className="font-semibold text-stone-600">{avgLph.toFixed(2)}</span> L/h
            </span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="rgba(28,25,23,0.05)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#A8A29E', fontFamily: 'inherit' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#A8A29E', fontFamily: 'inherit' }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v: unknown, name: unknown) => [
                `${typeof v === 'number' ? v.toFixed(2) : v} L/h`,
                name === 'avg' ? 'Promedio' : 'L/h confiable',
              ] as [string, string]}
              contentStyle={{ fontSize: 11, border: '1px solid rgba(28,25,23,0.1)', borderRadius: 6, boxShadow: 'none', background: '#fff', fontFamily: 'inherit' }}
            />
            <Line
              type="monotone"
              dataKey="lph"
              stroke="#B45309"
              strokeWidth={2}
              dot={{ fill: '#B45309', r: 3 }}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
            {avgLph != null && (
              <Line
                type="monotone"
                dataKey={() => avgLph}
                name="avg"
                stroke="#D6D3D1"
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                activeDot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {hasLpm3Trend && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">L/m³ por mes</p>
            {avgLpm3 != null && (
              <span className="text-[10px] text-stone-400 font-mono">
                Promedio <span className="font-semibold text-stone-600">{avgLpm3.toFixed(2)}</span> L/m³
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke="rgba(28,25,23,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#A8A29E', fontFamily: 'inherit' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#A8A29E', fontFamily: 'inherit' }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [
                  `${typeof v === 'number' ? v.toFixed(2) : v} L/m³`,
                  name === 'avg' ? 'Promedio' : 'L/m³',
                ] as [string, string]}
                contentStyle={{ fontSize: 11, border: '1px solid rgba(28,25,23,0.1)', borderRadius: 6, boxShadow: 'none', background: '#fff', fontFamily: 'inherit' }}
              />
              <Line
                type="monotone"
                dataKey="lpm3"
                stroke="#0F766E"
                strokeWidth={2}
                dot={{ fill: '#0F766E', r: 3 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
              {avgLpm3 != null && (
                <Line
                  type="monotone"
                  dataKey={() => avgLpm3}
                  name="avg"
                  stroke="#D6D3D1"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  dot={false}
                  activeDot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {trendHasKm && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">L/km por mes</p>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={trend} margin={{ top: 0, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke="rgba(28,25,23,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#A8A29E', fontFamily: 'inherit' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#A8A29E', fontFamily: 'inherit' }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v: unknown) => [`${typeof v === 'number' ? v.toFixed(3) : v} L/km`, 'L/km']}
                contentStyle={{ fontSize: 11, border: '1px solid rgba(28,25,23,0.1)', borderRadius: 6, boxShadow: 'none', background: '#fff', fontFamily: 'inherit' }}
              />
              <Line type="monotone" dataKey="lpk" stroke="#0369A1" strokeWidth={2} dot={{ fill: '#0369A1', r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">Litros totales por mes</p>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={trend} margin={{ top: 0, right: 8, bottom: 0, left: -8 }}>
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#A8A29E', fontFamily: 'inherit' }} tickLine={false} axisLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(v: unknown) => [`${typeof v === 'number' ? v.toLocaleString('es-MX') : v} L`, 'Litros']}
              contentStyle={{ fontSize: 11, border: '1px solid rgba(28,25,23,0.1)', borderRadius: 6, boxShadow: 'none', background: '#fff', fontFamily: 'inherit' }}
            />
            <Bar dataKey="liters" fill="#E7E5E4" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {hasFork && (
        <div className="callout-attention text-xs">
          <p className="font-semibold text-amber-800 mb-1">Divergencia curva vs. suma de transacciones (horas)</p>
          <p className="text-amber-700">
            En algunos meses las horas de la curva fusionada y la suma de deltas de transacciones difieren
            más de 10%. Revisa los eventos del mes afectado en la pestaña Eventos.
          </p>
        </div>
      )}

      {summaryStrip}
    </div>
  )
}

function DataQualityTab({ row }: { row: EfficiencyRow }) {
  const q = row.quality_flags
  const a = row.anomaly_flags

  const issues: { label: string; value: string | number; severity: 'ok' | 'watch' | 'severe' }[] = []

  if (q.null_previous_horometer_count > 0) {
    const ratio = q.tx_count > 0 ? q.null_previous_horometer_count / q.tx_count : 0
    issues.push({
      label: 'Transacciones sin horómetro previo',
      value: `${q.null_previous_horometer_count} de ${q.tx_count} (${(ratio * 100).toFixed(0)}%)`,
      severity: ratio > 0.5 ? 'severe' : ratio > 0.15 ? 'watch' : 'ok',
    })
  }

  if (q.negative_hours_consumed_count > 0) {
    issues.push({
      label: 'Deltas de horas negativos',
      value: `${q.negative_hours_consumed_count} transacción(es)`,
      severity: 'severe',
    })
  }

  if (q.merge_fork) {
    issues.push({
      label: 'Divergencia curva fusionada vs. suma TX (horas)',
      value: `Diferencia > 25% entre hours_merged y hours_sum_raw`,
      severity: 'watch',
    })
  }

  const nullKm = q.null_previous_kilometer_count ?? 0
  if (nullKm > 0) {
    const ratio = q.tx_count > 0 ? nullKm / q.tx_count : 0
    issues.push({
      label: 'Transacciones sin odómetro previo',
      value: `${nullKm} de ${q.tx_count} (${(ratio * 100).toFixed(0)}%)`,
      severity: ratio > 0.5 ? 'severe' : ratio > 0.15 ? 'watch' : 'ok',
    })
  }

  const negKm = q.negative_kilometers_consumed_count ?? 0
  if (negKm > 0) {
    issues.push({
      label: 'Deltas de kilómetros negativos',
      value: `${negKm} transacción(es)`,
      severity: 'severe',
    })
  }

  if (q.merge_fork_km) {
    issues.push({
      label: 'Divergencia curva fusionada vs. suma TX (km)',
      value: `Diferencia > 25% entre kilometers_merged y kilometers_sum_raw`,
      severity: 'watch',
    })
  }

  const SEVERITY_STYLE: Record<string, string> = {
    ok: 'border-l-2 border-green-500 bg-green-50/50',
    watch: 'border-l-2 border-amber-500 bg-amber-50/50',
    severe: 'border-l-2 border-red-500 bg-red-50/50',
  }

  const SEVERITY_ICON: Record<string, string> = {
    ok: '✓',
    watch: '⚠',
    severe: '✕',
  }

  return (
    <div className="space-y-3 py-3">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="h-3 w-3 rounded-full"
          style={{
            background:
              a.data_quality_tier === 'ok'
                ? '#15803D'
                : a.data_quality_tier === 'watch'
                ? '#B45309'
                : '#B91C1C',
          }}
        />
        <span className="text-sm font-semibold text-stone-700">
          Calidad de datos: {a.data_quality_tier === 'ok' ? 'Confiable' : a.data_quality_tier === 'watch' ? 'Vigilar' : 'Poco confiable'}
        </span>
      </div>

      {issues.length === 0 ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-stone-500 text-sm">Sin problemas de calidad detectados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
            <div key={issue.label} className={`rounded-md px-3 py-2.5 ${SEVERITY_STYLE[issue.severity]}`}>
              <div className="flex items-start gap-2">
                <span className={`text-xs font-bold mt-0.5 ${issue.severity === 'severe' ? 'text-red-600' : issue.severity === 'watch' ? 'text-amber-600' : 'text-green-600'}`}>
                  {SEVERITY_ICON[issue.severity]}
                </span>
                <div>
                  <p className="text-xs font-semibold text-stone-700">{issue.label}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{issue.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-md bg-stone-50 border border-stone-900/[0.06] px-3 py-3 text-xs text-stone-500 space-y-1">
        <p className="font-semibold text-stone-600 mb-1">¿Cómo corregir datos?</p>
        <p>Abre la pestaña <strong>Eventos</strong> y presiona el ícono de lápiz en cualquier carga de diésel para editar la lectura de horómetro y el horómetro previo. El Δh se calcula en tiempo real y el rollup se recalcula al guardar.</p>
        <p className="text-stone-400 text-[10px] mt-2">
          Lo mismo aplica a <strong>odómetro</strong> y odómetro previo para corregir km y el cálculo de L/km confiable.
        </p>
        <p className="text-stone-400 text-[10px] mt-2">
          Tx: {q.tx_count} · Horómetro nulos: {q.null_previous_horometer_count} · Horas negativas:{' '}
          {q.negative_hours_consumed_count} · Odómetro nulos: {q.null_previous_kilometer_count ?? 0} · Km negativos:{' '}
          {q.negative_kilometers_consumed_count ?? 0}
        </p>
      </div>

      {a.review_consumption_pattern && (
        <div className="callout-attention text-xs mt-3">
          <p className="font-semibold text-amber-800 mb-1">Patrón de consumo a revisar</p>
          <p className="text-amber-700">
            El sistema detectó un patrón atípico en el consumo de este activo. Puede deberse a
            cambios en operación, fallas de equipo, o datos incorrectos. Revisa los eventos
            de este mes antes de tomar acción.
          </p>
        </div>
      )}
    </div>
  )
}

type RemisionRow = {
  remision_number: string
  fecha: string
  hora_carga: string
  volumen_fabricado: number | null
  cancelled_reason: string | null
}

function prevMonth(ym: string): string {
  const [ys, ms] = ym.split('-')
  let y = Number(ys), m = Number(ms) - 1
  if (m === 0) { m = 12; y-- }
  return `${y}-${String(m).padStart(2, '0')}`
}

function nextMonth(ym: string): string {
  const [ys, ms] = ym.split('-')
  let y = Number(ys), m = Number(ms) + 1
  if (m === 13) { m = 1; y++ }
  return `${y}-${String(m).padStart(2, '0')}`
}

export function DrillSheet({ row, yearMonth, open, onOpenChange, onDataChanged }: Props) {
  const [activeYearMonth, setActiveYearMonth] = useState(yearMonth)
  const [events, setEvents] = useState<MeterEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [remisiones, setRemisiones] = useState<RemisionRow[]>([])
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('trend')
  const [showHorasBreakdown, setShowHorasBreakdown] = useState(false)
  const [showKmBreakdown, setShowKmBreakdown] = useState(false)
  const [monthEfficiencyRow, setMonthEfficiencyRow] = useState<EfficiencyRow | null>(null)
  const [monthEfficiencyLoading, setMonthEfficiencyLoading] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect -- sheet month sync, efficiency snapshot, events/trend fetches */
  // Sync activeYearMonth when the parent opens a new sheet or changes month
  useEffect(() => {
    if (open) setActiveYearMonth(yearMonth)
  }, [open, yearMonth])

  useEffect(() => {
    if (!open || !row?.assets?.id) return
    let cancelled = false
    setMonthEfficiencyLoading(true)
    setMonthEfficiencyRow(null)
    fetch(
      `/api/reports/asset-diesel-efficiency?yearMonth=${encodeURIComponent(activeYearMonth)}&assetId=${encodeURIComponent(row.assets.id)}`
    )
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        const rows = (j.rows ?? []) as EfficiencyRow[]
        setMonthEfficiencyRow(rows[0] ?? null)
      })
      .catch(() => {
        if (!cancelled) setMonthEfficiencyRow(null)
      })
      .finally(() => {
        if (!cancelled) setMonthEfficiencyLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, activeYearMonth, row?.assets?.id])

  const fetchEvents = (assetInternalId: string, ym: string) => {
    setEventsLoading(true)
    setEvents([])
    const { from, to } = monthIsoRange(ym)
    const fromMs = new Date(from).getTime()
    // 30-day lookback matches the server's extended window for finding prior-month anchor events
    const extendedFrom = new Date(fromMs - 30 * 24 * 60 * 60 * 1000).toISOString()
    fetch(
      `/api/assets/${assetInternalId}/meter-events?from=${encodeURIComponent(extendedFrom)}&to=${encodeURIComponent(to)}`
    )
      .then((r) => r.json())
      .then((j) => setEvents((j.events ?? []) as MeterEvent[]))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false))
  }

  useEffect(() => {
    if (!open || !row?.assets?.id) return
    fetchEvents(row.assets.id, activeYearMonth)

    const assetCode = row.assets.asset_id
    if (assetCode) {
      const { from, to } = monthIsoRange(activeYearMonth)
      const fromStr = new Date(new Date(from).getTime() - 4 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
      const toStr = to.slice(0, 10)
      fetch(`/api/integrations/cotizador/remisiones?assetId=${encodeURIComponent(assetCode)}&from=${fromStr}&to=${toStr}`)
        .then((r) => r.json())
        .then((j) => setRemisiones((j.remisiones ?? []) as RemisionRow[]))
        .catch(() => setRemisiones([]))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row?.assets?.id, activeYearMonth])

  useEffect(() => {
    if (!open || !row) return
    setTrendLoading(true)
    setTrend([])
    const months: string[] = []
    const [ys, ms] = activeYearMonth.split('-')
    let y = Number(ys)
    let m = Number(ms)
    for (let i = 0; i < 6; i++) {
      months.unshift(`${y}-${String(m).padStart(2, '0')}`)
      m--
      if (m === 0) { m = 12; y-- }
    }
    const assetId = row.assets?.id
    if (!assetId) { setTrendLoading(false); return }
    Promise.all(
      months.map((ym) =>
        fetch(`/api/reports/asset-diesel-efficiency?yearMonth=${ym}&assetId=${assetId}`)
          .then((r) => r.json())
          .then((j) => ({ ym, rows: (j.rows ?? []) as EfficiencyRow[] }))
          .catch(() => ({ ym, rows: [] }))
      )
    ).then((results) => {
      const points: TrendPoint[] = results.map(({ ym, rows }) => {
        const r = rows[0]
        return {
          month: ym.slice(2),
          lph: r?.liters_per_hour_trusted ?? null,
          lpk: r?.liters_per_km ?? null,
          lpm3: r?.liters_per_m3 ?? null,
          liters: r?.total_liters ?? 0,
          hours_merged: r?.hours_merged ?? 0,
          hours_sum_raw: r?.hours_sum_raw ?? 0,
          km_merged: r?.kilometers_merged ?? 0,
          km_sum_raw: r?.kilometers_sum_raw ?? 0,
          km_trusted: r?.kilometers_trusted ?? 0,
        }
      })
      setTrend(points)
    }).finally(() => setTrendLoading(false))
  }, [open, row, activeYearMonth])
  /* eslint-enable react-hooks/set-state-in-effect */

  const headerEfficiency =
    row != null ? monthEfficiencyRow ?? (activeYearMonth === row.year_month ? row : null) : null

  /** Same instant bounds as monthly compute (`mexicoCityMonthWindowFromYm`). */
  const monthInstantBounds = useMemo(() => {
    const { from, to } = monthIsoRange(activeYearMonth)
    return { startMs: new Date(from).getTime(), endMs: new Date(to).getTime() }
  }, [activeYearMonth])

  /** Live merged hours from meter timeline (diesel + checklist only) — matches `computeMergedOperatingHoursByAsset`. */
  const hoursLiveWindow = useMemo((): MergedHoursWindowDetails => {
    const { startMs, endMs } = monthInstantBounds
    const dieselTxs = events
      .filter((e) => e.source_kind === 'diesel_consumption' && e.hours_reading != null)
      .map((e) => ({ transaction_date: e.event_at, horometer_reading: Number(e.hours_reading) }))
    const checklistReadingEvents = events
      .filter((e) => e.source_kind === 'checklist_completion' && e.hours_reading != null)
      .map((e) => ({ ts: new Date(e.event_at).getTime(), val: Number(e.hours_reading) }))
    const curve = buildMergedHoursReadingEventsForAsset({ dieselTxs, checklistReadingEvents })
    return mergedHoursWindowDetails(curve, startMs, endMs)
  }, [events, monthInstantBounds])

  const kmLiveWindow = useMemo((): MergedHoursWindowDetails => {
    const { startMs, endMs } = monthInstantBounds
    const dieselTxs = events
      .filter((e) => e.source_kind === 'diesel_consumption' && e.km_reading != null)
      .map((e) => ({ transaction_date: e.event_at, kilometer_reading: Number(e.km_reading) }))
    const checklistReadingEvents = events
      .filter((e) => e.source_kind === 'checklist_completion' && e.km_reading != null)
      .map((e) => ({ ts: new Date(e.event_at).getTime(), val: Number(e.km_reading) }))
    const curve = buildMergedKmReadingEventsForAsset({ dieselTxs, checklistReadingEvents })
    return mergedHoursWindowDetails(curve, startMs, endMs)
  }, [events, monthInstantBounds])

  const hasHoursCurveInputs = useMemo(
    () =>
      events.some(
        (e) =>
          (e.source_kind === 'diesel_consumption' || e.source_kind === 'checklist_completion') &&
          e.hours_reading != null
      ),
    [events]
  )

  const hasKmCurveInputs = useMemo(
    () =>
      events.some(
        (e) =>
          (e.source_kind === 'diesel_consumption' || e.source_kind === 'checklist_completion') &&
          e.km_reading != null
      ),
    [events]
  )

  /** Drill KPIs follow the live curve once events are loaded (user-facing truth in this sheet). */
  const displayEfficiencyRow = useMemo((): EfficiencyRow | null => {
    if (headerEfficiency == null) return null
    if (eventsLoading) return headerEfficiency
    const out: EfficiencyRow = { ...headerEfficiency }
    const liters = headerEfficiency.total_liters
    if (hasHoursCurveInputs) {
      const mergedH = hoursLiveWindow.hours
      const trustedH = resolveTrustedOperatingHours(mergedH, headerEfficiency.hours_sum_raw).trusted
      const lph =
        trustedH > 0 && liters > 0 ? liters / trustedH : headerEfficiency.liters_per_hour_trusted
      out.hours_merged = mergedH
      out.hours_trusted = trustedH
      out.liters_per_hour_trusted = lph ?? null
    }
    if (hasKmCurveInputs) {
      const mergedK = kmLiveWindow.hours
      const trustedKRes = resolveTrustedOperatingKilometers(mergedK, headerEfficiency.kilometers_sum_raw)
      const lpk =
        trustedKRes.trusted > 0 && liters > 0 ? liters / trustedKRes.trusted : headerEfficiency.liters_per_km
      out.kilometers_merged = mergedK
      out.kilometers_trusted = trustedKRes.trusted
      out.liters_per_km = lpk ?? null
    }
    return out
  }, [
    headerEfficiency,
    eventsLoading,
    hasHoursCurveInputs,
    hasKmCurveInputs,
    hoursLiveWindow,
    kmLiveWindow,
  ])

  const fmtHeaderNum = useCallback((n: number | null | undefined, d: number) =>
    n == null || !Number.isFinite(Number(n))
      ? '—'
      : Number(n).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }), [])

  const dataQualityLabel =
    headerEfficiency == null
      ? '—'
      : headerEfficiency.anomaly_flags.data_quality_tier === 'ok'
        ? 'Confiable'
        : headerEfficiency.anomaly_flags.data_quality_tier === 'watch'
          ? 'Vigilar'
          : 'Revisar'

  const headerKpis = useMemo((): { label: string; value: string; title?: string }[] => {
    const loading = monthEfficiencyLoading && displayEfficiencyRow == null
    const plantM3 = displayEfficiencyRow?.plant_concrete_m3 ?? null
    const litersPerM3Plant =
      plantM3 != null &&
      plantM3 > 0 &&
      displayEfficiencyRow != null &&
      displayEfficiencyRow.total_liters > 0
        ? displayEfficiencyRow.total_liters / plantM3
        : null

    if (loading) {
      return [
        {
          label: 'Total litros',
          value: '…',
        },
        {
          label: 'L/h confiable',
          value: '…',
        },
        {
          label: 'L/m³',
          value: '…',
          title:
            'Litros del mes en MantenPro ÷ m³ de concreto Cotizador para esta unidad (sumado en todas las plantas donde despacha).',
        },
        {
          label: 'm³ Cotizador',
          value: '…',
          title: 'Volumen de concreto atribuido a la unidad en Cotizador para este mes.',
        },
        {
          label: 'L/km',
          value: '…',
        },
        { label: 'Calidad datos', value: '…' },
      ]
    }

    const hasAssetProductionM3 =
      displayEfficiencyRow != null &&
      displayEfficiencyRow.concrete_m3 != null &&
      displayEfficiencyRow.concrete_m3 > 0

    if (hasAssetProductionM3) {
      return [
        {
          label: 'Total litros',
          value:
            displayEfficiencyRow != null
              ? displayEfficiencyRow.total_liters.toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' L'
              : '—',
        },
        {
          label: 'L/h confiable',
          value:
            displayEfficiencyRow?.liters_per_hour_trusted != null
              ? displayEfficiencyRow.liters_per_hour_trusted.toFixed(2)
              : '—',
        },
        {
          label: 'L/m³',
          value:
            displayEfficiencyRow?.liters_per_m3 != null ? fmtHeaderNum(displayEfficiencyRow.liters_per_m3, 2) : '—',
          title:
            'Litros del mes en MantenPro ÷ m³ de concreto Cotizador para esta unidad (sumado en todas las plantas donde despacha).',
        },
        {
          label: 'm³ Cotizador',
          value:
            displayEfficiencyRow?.concrete_m3 != null
              ? fmtHeaderNum(displayEfficiencyRow.concrete_m3, 1) + ' m³'
              : '—',
          title: 'Volumen de concreto atribuido a la unidad en Cotizador para este mes.',
        },
        {
          label: 'L/km',
          value:
            displayEfficiencyRow?.liters_per_km != null ? fmtHeaderNum(displayEfficiencyRow.liters_per_km, 3) : '—',
          title: 'Litros del mes ÷ km confiables (curva fusionada de odómetro + checklist cuando aplica; si no, suma de kilometers_consumed en transacciones).',
        },
        { label: 'Calidad datos', value: dataQualityLabel },
      ]
    }

    const plantM3Title =
      plantM3 != null && plantM3 > 0
        ? `Diesel de este activo en el mes ÷ concreto total de la planta en Cotizador (${fmtHeaderNum(plantM3, 1)} m³). No es eficiencia de producción por unidad.`
        : 'Diesel de este activo ÷ concreto total de la planta en Cotizador (mes). Sin volumen de planta en Cotizador para este mes o la planta no está mapeada.'

    return [
      {
        label: 'Total litros',
        value:
          displayEfficiencyRow != null
            ? displayEfficiencyRow.total_liters.toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' L'
            : '—',
      },
      {
        label: 'L/h confiable',
        value:
          displayEfficiencyRow?.liters_per_hour_trusted != null
            ? displayEfficiencyRow.liters_per_hour_trusted.toFixed(2)
            : '—',
      },
      { label: 'Calidad datos', value: dataQualityLabel },
      {
        label: 'Horas confiables',
        value: displayEfficiencyRow != null ? fmtHeaderNum(displayEfficiencyRow.hours_trusted, 1) + ' h' : '—',
        title: 'Horas operativas usadas para L/h confiable en este mes.',
      },
      {
        label: 'Km totales',
        value:
          displayEfficiencyRow != null
            ? fmtHeaderNum(displayEfficiencyRow.kilometers_trusted, 0) + ' km'
            : '—',
        title:
          'Km confiables usados en L/km (fusionados si la curva tiene datos; si no, suma TX). Suma bruta TX: ' +
          (displayEfficiencyRow != null ? fmtHeaderNum(displayEfficiencyRow.kilometers_sum_raw, 0) + ' km.' : '—'),
      },
      {
        label: 'L/m³ planta',
        value: litersPerM3Plant != null ? fmtHeaderNum(litersPerM3Plant, 2) : '—',
        title: plantM3Title,
      },
    ]
  }, [displayEfficiencyRow, monthEfficiencyLoading, dataQualityLabel, fmtHeaderNum])

  if (!row) return null

  const assetLabel = [row.assets?.asset_id, row.assets?.name].filter(Boolean).join(' — ')
  const isCurrentMonth = activeYearMonth === yearMonth
  const isFutureMonth = activeYearMonth > new Date().toISOString().slice(0, 7)

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[520px] overflow-y-auto flex flex-col gap-0 p-0">
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-900/[0.08] bg-stone-50">
          <SheetHeader>
            <SheetTitle className="text-base font-semibold text-stone-900">
              {assetLabel}
            </SheetTitle>
            <SheetDescription asChild>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs text-stone-500">{row.equipment_category ?? 'Sin categoría'}</span>
                {/* Month navigator */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveYearMonth(prevMonth(activeYearMonth))}
                    className="p-0.5 rounded hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors"
                    title="Mes anterior"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs font-semibold text-stone-700 tabular-num min-w-[4.5rem] text-center">
                    {activeYearMonth}
                  </span>
                  <button
                    onClick={() => setActiveYearMonth(nextMonth(activeYearMonth))}
                    disabled={isFutureMonth}
                    className="p-0.5 rounded hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mes siguiente"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  {!isCurrentMonth && (
                    <button
                      onClick={() => setActiveYearMonth(yearMonth)}
                      className="text-[10px] text-amber-600 hover:text-amber-800 font-medium ml-1 underline underline-offset-2"
                    >
                      volver
                    </button>
                  )}
                </div>
              </div>
            </SheetDescription>
          </SheetHeader>
          {/* KPIs for the selected month (2×3) — driven by efficiency row for activeYearMonth */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {headerKpis.map((stat) => (
              <div
                key={stat.label}
                className="bg-white border border-stone-900/[0.06] rounded-md px-3 py-2"
                title={stat.title}
              >
                <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 leading-none">
                  {stat.label}
                </p>
                <p className="text-sm font-semibold tabular-num text-stone-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 px-6 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-stone-100 p-1 rounded-lg mb-4">
              <TabsTrigger value="trend" className="flex-1 text-xs font-medium">Tendencia</TabsTrigger>
              <TabsTrigger value="events" className="flex-1 text-xs font-medium">Eventos</TabsTrigger>
              <TabsTrigger value="quality" className="flex-1 text-xs font-medium">Calidad</TabsTrigger>
            </TabsList>

            <TabsContent value="trend">
              <TrendTab
                activeYearMonth={activeYearMonth}
                trendSummaryRow={displayEfficiencyRow}
                trendSummaryLoading={monthEfficiencyLoading}
                trend={trend}
                loading={trendLoading}
                onShowHorasBreakdown={() => setShowHorasBreakdown(true)}
                onShowKmBreakdown={(() => {
                  const eff = displayEfficiencyRow
                  if (!eff) return undefined
                  const t = eff.kilometers_trusted ?? 0
                  const m = eff.kilometers_merged ?? 0
                  const s = eff.kilometers_sum_raw ?? 0
                  return t > 0 || m > 0 || s > 0 ? () => setShowKmBreakdown(true) : undefined
                })()}
              />
            </TabsContent>

            <TabsContent value="events">
              <EventsTab
                events={events}
                loading={eventsLoading}
                yearMonth={activeYearMonth}
                remisiones={remisiones}
                onRefresh={() => {
                  if (!row?.assets?.id) return
                  const assetId = row.assets.id
                  fetchEvents(assetId, activeYearMonth)
                  setMonthEfficiencyLoading(true)
                  fetch(
                    `/api/reports/asset-diesel-efficiency?yearMonth=${encodeURIComponent(activeYearMonth)}&assetId=${encodeURIComponent(assetId)}`
                  )
                    .then((r) => r.json())
                    .then((j) => {
                      const rows = (j.rows ?? []) as EfficiencyRow[]
                      setMonthEfficiencyRow(rows[0] ?? null)
                    })
                    .catch(() => {
                      setMonthEfficiencyRow(null)
                    })
                    .finally(() => {
                      setMonthEfficiencyLoading(false)
                    })
                  setTrendLoading(true)
                  const months: string[] = []
                  const [ys, ms] = activeYearMonth.split('-')
                  let y = Number(ys)
                  let m = Number(ms)
                  for (let i = 0; i < 6; i++) {
                    months.unshift(`${y}-${String(m).padStart(2, '0')}`)
                    m--
                    if (m === 0) { m = 12; y-- }
                  }
                  Promise.all(
                    months.map((ym) =>
                      fetch(`/api/reports/asset-diesel-efficiency?yearMonth=${ym}&assetId=${assetId}`)
                        .then((r) => r.json())
                        .then((j) => ({ ym, rows: (j.rows ?? []) as EfficiencyRow[] }))
                        .catch(() => ({ ym, rows: [] }))
                    )
                  )
                    .then((results) => {
                      const points: TrendPoint[] = results.map(({ ym, rows }) => {
                        const r = rows[0]
                        return {
                          month: ym.slice(2),
                          lph: r?.liters_per_hour_trusted ?? null,
                          lpk: r?.liters_per_km ?? null,
                          lpm3: r?.liters_per_m3 ?? null,
                          liters: r?.total_liters ?? 0,
                          hours_merged: r?.hours_merged ?? 0,
                          hours_sum_raw: r?.hours_sum_raw ?? 0,
                          km_merged: r?.kilometers_merged ?? 0,
                          km_sum_raw: r?.kilometers_sum_raw ?? 0,
                          km_trusted: r?.kilometers_trusted ?? 0,
                        }
                      })
                      setTrend(points)
                    })
                    .finally(() => {
                      setTrendLoading(false)
                    })
                  onDataChanged?.()
                }}
              />
            </TabsContent>

            <TabsContent value="quality">
              {monthEfficiencyLoading && headerEfficiency == null ? (
                <div className="space-y-3 py-4">
                  <div className="h-24 bg-stone-100 rounded animate-pulse" />
                  <div className="h-32 bg-stone-100 rounded animate-pulse" />
                </div>
              ) : headerEfficiency != null ? (
                <DataQualityTab row={headerEfficiency} />
              ) : (
                <div className="py-8 text-center text-sm text-stone-500">
                  Sin fila de eficiencia para <span className="font-mono">{activeYearMonth}</span>.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>

    {/* H FUSIONADAS breakdown dialog */}

    <Dialog open={showHorasBreakdown} onOpenChange={setShowHorasBreakdown}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Horas fusionadas — desglose</DialogTitle>
        </DialogHeader>
        {row && (() => {
          const hw = hoursLiveWindow
          const fmtTime = (ts: number) =>
            new Date(ts).toLocaleDateString('es-MX', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Mexico_City',
            })
          const fmtH = (v: number) =>
            v.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

          return (
            <div className="space-y-4 text-xs">
              <p className="text-stone-500">
                Curva oficial (cargas diésel + checklist en banda), misma lógica que el recálculo mensual. Diferencia
                entre primera y última lectura del mes, con interpolación lineal en los límites cuando hay eventos de
                otro mes que acotan el rango.
              </p>
              {!hasHoursCurveInputs && !eventsLoading && (
                <p className="text-amber-800 text-[11px] bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                  No hay lecturas de horas (diésel o checklist) en la ventana de eventos cargada; si ves 0 h, revisa
                  la pestaña Eventos o la fila mensual guardada.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  <p className="text-[10px] text-green-700 font-semibold uppercase tracking-widest">H fusionadas</p>
                  <p className="text-lg font-bold tabular-num text-green-800">{hw.hours.toFixed(1)} h</p>
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-md px-3 py-2">
                  <p className="text-[10px] text-stone-500 font-semibold uppercase tracking-widest">Lecturas en mes</p>
                  <p className="text-lg font-bold tabular-num text-stone-700">{hw.readingsInMonth}</p>
                </div>
              </div>

              {hw.startVal != null && hw.endVal != null && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Límites calculados</p>
                  <div className="bg-stone-50 border border-stone-200 rounded-md px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-stone-400 text-[10px]">
                          Inicio {hw.startIsProrated && <span className="text-blue-500">(prorrateado)</span>}
                        </span>
                        <div className="text-[10px] text-stone-400">
                          {hw.startTs != null ? fmtTime(hw.startTs) : '—'}
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-stone-700">{fmtH(hw.startVal)} h</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                      <div>
                        <span className="text-stone-400 text-[10px]">
                          Fin {hw.endIsProrated && <span className="text-blue-500">(prorrateado)</span>}
                        </span>
                        <div className="text-[10px] text-stone-400">
                          {hw.endTs != null ? fmtTime(hw.endTs) : '—'}
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-stone-700">{fmtH(hw.endVal)} h</span>
                    </div>
                    {hw.lastBefore && hw.startIsProrated && (
                      <div className="pt-1 border-t border-stone-100 text-[10px] text-stone-400">
                        Anclado en: {fmtH(hw.lastBefore.val)} h del {fmtTime(hw.lastBefore.ts)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </DialogContent>
    </Dialog>

    {/* KM FUSIONADOS breakdown dialog — same curve logic as server `merged-operating-km` (800 km/día cap) */}
    <Dialog open={showKmBreakdown} onOpenChange={setShowKmBreakdown}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Km fusionados — desglose</DialogTitle>
        </DialogHeader>
        {row && headerEfficiency && (() => {
          const kw = kmLiveWindow
          const fmtTime = (ts: number) =>
            new Date(ts).toLocaleDateString('es-MX', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Mexico_City',
            })
          const fmtKm = (v: number) =>
            v.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

          return (
            <div className="space-y-4 text-xs">
              <p className="text-stone-500">
                Curva oficial (cargas diésel + checklist en banda), misma lógica que el recálculo mensual (tope ~800
                km/día entre cargas). Interpolación en los límites del mes cuando hay lecturas en meses adyacentes.
              </p>
              {!hasKmCurveInputs && !eventsLoading && (
                <p className="text-amber-800 text-[11px] bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                  No hay lecturas de km (diésel o checklist) en la ventana de eventos cargada; si ves 0 km, revisa
                  Eventos o la fila mensual.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-sky-50 border border-sky-200 rounded-md px-3 py-2">
                  <p className="text-[10px] text-sky-800 font-semibold uppercase tracking-widest">Km fusionados</p>
                  <p className="text-lg font-bold tabular-num text-sky-900">{fmtKm(kw.hours)} km</p>
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-md px-3 py-2">
                  <p className="text-[10px] text-stone-500 font-semibold uppercase tracking-widest">Lecturas en mes</p>
                  <p className="text-lg font-bold tabular-num text-stone-700">{kw.readingsInMonth}</p>
                </div>
              </div>

              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 space-y-1 text-[10px] text-stone-600">
                <p className="font-semibold text-stone-700">Mes {activeYearMonth} — último snapshot en tabla mensual</p>
                <p>
                  <span className="text-stone-500">km fusionados:</span>{' '}
                  <span className="font-mono font-medium text-stone-800">
                    {headerEfficiency.kilometers_merged.toFixed(0)} km
                  </span>
                </p>
                <p>
                  <span className="text-stone-500">km confiables (L/km):</span>{' '}
                  <span className="font-mono font-medium text-stone-800">
                    {headerEfficiency.kilometers_trusted.toFixed(0)} km
                  </span>
                </p>
                <p>
                  <span className="text-stone-500">Suma TX (diagnóstico):</span>{' '}
                  <span className="font-mono font-medium text-stone-800">
                    {headerEfficiency.kilometers_sum_raw.toFixed(0)} km
                  </span>
                </p>
                <p className="text-stone-400 pt-1 border-t border-stone-100">
                  La cifra principal arriba sigue la misma curva que la ficha y el recálculo; la tabla puede quedar
                  desfasada unos segundos hasta que termine el POST tras editar eventos.
                </p>
              </div>

              {kw.startVal != null && kw.endVal != null && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Límites calculados</p>
                  <div className="bg-stone-50 border border-stone-200 rounded-md px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-stone-400 text-[10px]">
                          Inicio {kw.startIsProrated && <span className="text-blue-500">(prorrateado)</span>}
                        </span>
                        <div className="text-[10px] text-stone-400">
                          {kw.startTs != null ? fmtTime(kw.startTs) : '—'}
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-stone-700">{fmtKm(kw.startVal)} km</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                      <div>
                        <span className="text-stone-400 text-[10px]">
                          Fin {kw.endIsProrated && <span className="text-blue-500">(prorrateado)</span>}
                        </span>
                        <div className="text-[10px] text-stone-400">
                          {kw.endTs != null ? fmtTime(kw.endTs) : '—'}
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-stone-700">{fmtKm(kw.endVal)} km</span>
                    </div>
                    {kw.lastBefore && kw.startIsProrated && (
                      <div className="pt-1 border-t border-stone-100 text-[10px] text-stone-400">
                        Anclado en: {fmtKm(kw.lastBefore.val)} km del {fmtTime(kw.lastBefore.ts)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </DialogContent>
    </Dialog>
    </>
  )
}
