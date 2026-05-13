'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ExternalLink, Gauge, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { EfficiencyRow, SortKey } from './types'

type Props = {
  rows: EfficiencyRow[]
  prevRows?: EfficiencyRow[]
  onOpenDrill: (row: EfficiencyRow) => void
  yearMonth: string
}

const QUALITY_STRIP: Record<string, string> = {
  ok: '#15803D',
  watch: '#B45309',
  severe: '#B91C1C',
}

const QUALITY_BG: Record<string, string> = {
  ok: '',
  watch: 'bg-amber-50/40',
  severe: 'bg-red-50/50',
}

const TIER_LABEL: Record<string, string> = {
  ok: 'ok',
  watch: 'vigilar',
  severe: 'severo',
  unknown: '—',
}

function SortBtn({
  col,
  active,
  dir,
  onClick,
}: {
  col: SortKey
  active: SortKey
  dir: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-0.5 group">
      {active === col ? (
        dir === 'desc' ? (
          <ChevronDown className="h-3 w-3 text-stone-600" />
        ) : (
          <ChevronUp className="h-3 w-3 text-stone-600" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 text-stone-300 group-hover:text-stone-500" />
      )}
    </button>
  )
}

function QualityPill({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    ok: 'text-green-700 bg-green-50 border-green-200',
    watch: 'text-amber-700 bg-amber-50 border-amber-200',
    severe: 'text-red-700 bg-red-50 border-red-200',
    unknown: 'text-stone-500 bg-stone-50 border-stone-200',
  }
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${colors[tier] ?? colors.unknown}`}
    >
      {TIER_LABEL[tier] ?? tier}
    </span>
  )
}

function MoMDelta({ lph, prevLph }: { lph: number | null; prevLph?: number | null }) {
  if (!lph || !prevLph || prevLph === 0) return <span className="text-stone-300">—</span>
  const pct = ((lph - prevLph) / prevLph) * 100
  const up = pct > 0
  const big = Math.abs(pct) >= 20
  return (
    <span
      className={[
        'tabular-num text-xs font-medium',
        up && big ? 'text-red-600 font-semibold' : up ? 'text-red-500' : 'text-green-700',
      ].join(' ')}
    >
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

export function AssetTable({ rows, prevRows = [], onOpenDrill, yearMonth: _yearMonth }: Props) {
  const prevByAsset = useMemo(() => {
    const m = new Map<string, EfficiencyRow>()
    for (const r of prevRows) {
      if (r.assets?.id) m.set(r.assets.id, r)
    }
    return m
  }, [prevRows])
  const [sortKey, setSortKey] = useState<SortKey>('total_liters')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av: number
      let bv: number
      switch (sortKey) {
        case 'total_liters':
          av = a.total_liters ?? 0
          bv = b.total_liters ?? 0
          break
        case 'liters_per_hour_trusted':
          av = a.liters_per_hour_trusted ?? -1
          bv = b.liters_per_hour_trusted ?? -1
          break
        case 'liters_per_km':
          av = a.liters_per_km ?? -1
          bv = b.liters_per_km ?? -1
          break
        case 'liters_per_m3':
          av = a.liters_per_m3 ?? -1
          bv = b.liters_per_m3 ?? -1
          break
        case 'hours_trusted':
          av = a.hours_trusted ?? 0
          bv = b.hours_trusted ?? 0
          break
        case 'data_quality': {
          const order: Record<string, number> = { severe: 0, watch: 1, ok: 2 }
          av = order[a.anomaly_flags.data_quality_tier] ?? 3
          bv = order[b.anomaly_flags.data_quality_tier] ?? 3
          break
        }
        case 'efficiency': {
          const order: Record<string, number> = { severe: 0, watch: 1, unknown: 2, ok: 3 }
          av = order[a.anomaly_flags.efficiency_tier] ?? 4
          bv = order[b.anomaly_flags.efficiency_tier] ?? 4
          break
        }
        default:
          return 0
      }
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [rows, sortKey, sortDir])

  const hasMixers = rows.some((r) => r.liters_per_m3 != null || r.concrete_m3 != null)

  const fmt = (n: number | null | undefined, d = 2) =>
    n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('es-MX', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    })

  if (rows.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-stone-900/[0.08]">
            <th className="py-2.5 pl-4 pr-2 text-left w-3" />
            <th className="py-2.5 pr-3 text-left">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                Código
              </span>
            </th>
            <th className="py-2.5 pr-3 text-left">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                Nombre
              </span>
            </th>
            <th className="py-2.5 pr-3 text-left">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                Categoría
              </span>
            </th>
            <th className="py-2.5 pr-4 text-right">
              <div className="flex items-center justify-end gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                  Litros
                </span>
                <SortBtn col="total_liters" active={sortKey} dir={sortDir} onClick={() => toggleSort('total_liters')} />
              </div>
            </th>
            <th className="py-2.5 pr-4 text-right">
              <div className="flex items-center justify-end gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                  L/h
                </span>
                <SortBtn col="liters_per_hour_trusted" active={sortKey} dir={sortDir} onClick={() => toggleSort('liters_per_hour_trusted')} />
              </div>
            </th>
            <th className="py-2.5 pr-4 text-right">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                Δ MoM
              </span>
            </th>
            <th className="py-2.5 pr-4 text-right">
              <div className="flex items-center justify-end gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                  L/km
                </span>
                <SortBtn col="liters_per_km" active={sortKey} dir={sortDir} onClick={() => toggleSort('liters_per_km')} />
              </div>
            </th>
            {hasMixers && (
              <>
                <th className="py-2.5 pr-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">L/m³</span>
                    <SortBtn col="liters_per_m3" active={sortKey} dir={sortDir} onClick={() => toggleSort('liters_per_m3')} />
                  </div>
                </th>
                <th className="py-2.5 pr-4 text-right">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Δ m³</span>
                </th>
              </>
            )}
            <th className="py-2.5 pr-3 text-left">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                  Datos
                </span>
                <SortBtn col="data_quality" active={sortKey} dir={sortDir} onClick={() => toggleSort('data_quality')} />
              </div>
            </th>
            <th className="py-2.5 pr-3 text-left">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                  Eficiencia
                </span>
                <SortBtn col="efficiency" active={sortKey} dir={sortDir} onClick={() => toggleSort('efficiency')} />
              </div>
            </th>
            <th className="py-2.5 pr-4 text-right">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                h confiables
              </span>
            </th>
            <th className="py-2.5 pr-4" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const qualityTier = r.anomaly_flags.data_quality_tier
            const effTier = r.anomaly_flags.efficiency_tier
            const aid = r.assets?.id
            const lowQuality = qualityTier === 'severe'
            const prev = aid ? prevByAsset.get(aid) : undefined

            return (
              <tr
                key={r.id}
                className={[
                  'border-b border-stone-900/[0.05] transition-colors hover:bg-stone-50/80',
                  QUALITY_BG[qualityTier] ?? '',
                ].join(' ')}
              >
                {/* Quality confidence strip */}
                <td className="pl-0 pr-2 py-0 w-1">
                  <div
                    className="h-full min-h-[44px] w-[3px] rounded-r-full"
                    style={{ background: QUALITY_STRIP[qualityTier] ?? '#E7E5E4' }}
                  />
                </td>
                <td className="py-2.5 pr-3 font-mono text-xs text-stone-700 font-medium">
                  {r.assets?.asset_id ?? '—'}
                </td>
                <td className="py-2.5 pr-3 text-stone-800 font-medium max-w-[160px] truncate">
                  {r.assets?.name ?? '—'}
                </td>
                <td className="py-2.5 pr-3 text-stone-500 text-xs max-w-[120px] truncate">
                  {r.equipment_category ?? '—'}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-num font-semibold text-stone-800">
                  {fmt(r.total_liters, 0)} L
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <span
                    className={[
                      'tabular-num font-semibold',
                      lowQuality ? 'text-stone-400 italic' : effTier === 'severe' ? 'text-red-700' : effTier === 'watch' ? 'text-amber-700' : 'text-stone-800',
                    ].join(' ')}
                  >
                    {fmt(r.liters_per_hour_trusted, 2)}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <MoMDelta lph={r.liters_per_hour_trusted} prevLph={prev?.liters_per_hour_trusted} />
                </td>
                <td className="py-2.5 pr-4 text-right tabular-num text-stone-600">
                  {fmt(r.liters_per_km, 3)}
                </td>
                {hasMixers && (
                  <>
                    <td className="py-2.5 pr-4 text-right tabular-num text-stone-600">
                      {fmt(r.liters_per_m3, 2)}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <MoMDelta lph={r.liters_per_m3} prevLph={prev?.liters_per_m3} />
                    </td>
                  </>
                )}
                <td className="py-2.5 pr-3">
                  <div className="flex flex-wrap gap-1 items-center">
                    <QualityPill tier={qualityTier} />
                    {r.quality_flags.merge_fork && (
                      <span className="text-[9px] font-semibold text-stone-400 border border-stone-200 rounded px-1 py-0.5">
                        fork
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex flex-wrap gap-1 items-center">
                    <QualityPill tier={effTier} />
                    {r.anomaly_flags.breakpoint_mom_lph && (
                      <span className="text-[9px] font-semibold text-red-600 border border-red-200 rounded px-1 py-0.5">
                        salto
                      </span>
                    )}
                    {r.anomaly_flags.review_consumption_pattern && (
                      <span className="text-[9px] font-semibold text-amber-700 border border-amber-200 rounded px-1 py-0.5">
                        revisar
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 pr-4 text-right tabular-num text-stone-500 text-xs">
                  {fmt(r.hours_trusted, 1)} h
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                      onClick={() => onOpenDrill(r)}
                    >
                      <Gauge className="h-3.5 w-3.5 mr-1.5" />
                      <span className="text-xs">Analizar</span>
                    </Button>
                    {aid && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-stone-400 hover:text-stone-700" asChild>
                        <Link href={`/activos/${aid}`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
