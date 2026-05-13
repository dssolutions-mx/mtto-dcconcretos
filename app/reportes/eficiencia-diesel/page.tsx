'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { RefreshCw, Download, MoreHorizontal, Fuel, Search, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { KpiStrip } from '@/components/reports/diesel-efficiency/kpi-strip'
import { PlantBarStrip } from '@/components/reports/diesel-efficiency/plant-bar-strip'
import { AssetTable } from '@/components/reports/diesel-efficiency/asset-table'
import { DrillSheet } from '@/components/reports/diesel-efficiency/drill-sheet'
import { AnomaliesList } from '@/components/reports/diesel-efficiency/anomalies-list'
import { DataQualityList } from '@/components/reports/diesel-efficiency/data-quality-list'
import type { EfficiencyRow, ViewMode } from '@/components/reports/diesel-efficiency/types'

const MONTHS = ['2026-05', '2026-04', '2026-03', '2026-02', '2026-01']
const MONTHS_LABEL: Record<string, string> = {
  '2026-05': 'Mayo 2026',
  '2026-04': 'Abril 2026',
  '2026-03': 'Marzo 2026',
  '2026-02': 'Febrero 2026',
  '2026-01': 'Enero 2026',
}

function prevMonth(ym: string): string {
  const [ys, ms] = ym.split('-')
  let y = Number(ys)
  let m = Number(ms) - 1
  if (m === 0) { m = 12; y-- }
  return `${y}-${String(m).padStart(2, '0')}`
}

function downloadCsv(filename: string, header: string[], lines: (string | number | null | undefined)[][]) {
  const esc = (cell: string | number | null | undefined) => {
    const s = cell == null ? '' : String(cell)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const body = [header.join(','), ...lines.map((row) => row.map(esc).join(','))].join('\n')
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const VIEW_LABELS: Record<ViewMode, string> = {
  fleet: 'Flota',
  anomalies: 'Revisar consumo',
  quality: 'Calidad de datos',
}

function EficienciaDieselContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [yearMonth, setYearMonth] = useState(() => searchParams.get('mes') ?? '2026-05')
  const [selectedBu, setSelectedBu] = useState<string | null>(null)
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [assetSearch, setAssetSearch] = useState('')
  const [view, setView] = useState<ViewMode>(() => (searchParams.get('vista') as ViewMode) ?? 'fleet')

  const [rows, setRows] = useState<EfficiencyRow[]>([])
  const [prevRows, setPrevRows] = useState<EfficiencyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [lastComputed, setLastComputed] = useState<string | null>(null)

  const [drillRow, setDrillRow] = useState<EfficiencyRow | null>(null)
  const [drillOpen, setDrillOpen] = useState(false)
  const [plantNames, setPlantNames] = useState<Record<string, string>>({})
  const [plants, setPlants] = useState<{ id: string; name: string; business_unit_id: string | null }[]>([])
  const [businessUnits, setBusinessUnits] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/plants').then(r => r.json()),
      fetch('/api/business-units').then(r => r.json()),
    ]).then(([pj, bj]) => {
      const ps: { id: string; name: string; business_unit_id: string | null }[] = pj.plants ?? []
      setPlants(ps)
      const names: Record<string, string> = {}
      for (const p of ps) names[p.id] = p.name
      setPlantNames(names)
      setBusinessUnits(bj.business_units ?? [])
    }).catch(() => {})
  }, [])

  // Sync URL params — do NOT include searchParams in deps, router.replace changes it causing infinite loop
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('mes', yearMonth)
    params.set('vista', view)
    router.replace(`?${params.toString()}`, { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth, view])

  const loadRows = useCallback(async (ym: string): Promise<EfficiencyRow[]> => {
    const r = await fetch(`/api/reports/asset-diesel-efficiency?yearMonth=${encodeURIComponent(ym)}`)
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Error al cargar datos')
    return (j.rows ?? []) as EfficiencyRow[]
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [curr, prev] = await Promise.all([
        loadRows(yearMonth),
        loadRows(prevMonth(yearMonth)),
      ])
      setRows(curr)
      setPrevRows(prev)
      const latest = curr.reduce((max: string | null, r) => {
        if (!r.computed_at) return max
        return !max || r.computed_at > max ? r.computed_at : max
      }, null)
      setLastComputed(latest)
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Error al cargar', ok: false })
      setRows([])
      setPrevRows([])
    } finally {
      setLoading(false)
    }
  }, [yearMonth, loadRows])

  useEffect(() => { void load() }, [load])

  const onRecompute = async () => {
    setRecomputing(true)
    setMessage(null)
    try {
      const r = await fetch('/api/reports/asset-diesel-efficiency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yearMonths: MONTHS, recompute: true }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Error al recalcular')
      setMessage({ text: `Recalculado: ${j.upserted ?? 0} filas actualizadas.`, ok: true })
      await load()
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Error', ok: false })
    } finally {
      setRecomputing(false)
    }
  }

  // Categories in current data
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      if (r.equipment_category) set.add(r.equipment_category)
    }
    return Array.from(set).sort()
  }, [rows])

  // Plant IDs that belong to the selected BU
  const buPlantIds = useMemo(() => {
    if (!selectedBu) return null
    return new Set(plants.filter(p => p.business_unit_id === selectedBu).map(p => p.id))
  }, [selectedBu, plants])

  // Plants that belong to the selected BU (for the plant dropdown)
  const plantsForBu = useMemo(() => {
    if (!selectedBu) return plants
    return plants.filter(p => p.business_unit_id === selectedBu)
  }, [selectedBu, plants])

  const applyFilters = (source: EfficiencyRow[]) => {
    let out = source
    if (buPlantIds) out = out.filter(r => r.plant_id != null && buPlantIds.has(r.plant_id))
    if (selectedPlant) out = out.filter(r => r.plant_id === selectedPlant)
    if (selectedCategory) out = out.filter(r => r.equipment_category === selectedCategory)
    if (assetSearch.trim()) {
      const q = assetSearch.trim().toLowerCase()
      out = out.filter(r =>
        r.assets?.asset_id?.toLowerCase().includes(q) ||
        r.assets?.name?.toLowerCase().includes(q)
      )
    }
    return out
  }

  const filteredRows = useMemo(() => applyFilters(rows), [rows, buPlantIds, selectedPlant, selectedCategory, assetSearch])
  const filteredPrevRows = useMemo(() => applyFilters(prevRows), [prevRows, buPlantIds, selectedPlant, selectedCategory, assetSearch])

  const openDrill = (row: EfficiencyRow) => {
    setDrillRow(row)
    setDrillOpen(true)
  }

  const exportCsv = () => {
    downloadCsv(
      `eficiencia-diesel-${yearMonth}.csv`,
      ['mes', 'codigo', 'nombre', 'categoria', 'litros', 'L_h', 'L_km', 'm3', 'L_m3', 'h_confiables', 'calidad_datos', 'eficiencia', 'salto_MoM', 'revisar'],
      filteredRows.map((r) => [
        r.year_month,
        r.assets?.asset_id ?? '',
        r.assets?.name ?? '',
        r.equipment_category ?? '',
        r.total_liters,
        r.liters_per_hour_trusted ?? '',
        r.liters_per_km ?? '',
        r.concrete_m3 ?? '',
        r.liters_per_m3 ?? '',
        r.hours_trusted,
        r.anomaly_flags.data_quality_tier,
        r.anomaly_flags.efficiency_tier,
        r.anomaly_flags.breakpoint_mom_lph ? 'sí' : 'no',
        r.anomaly_flags.review_consumption_pattern ? 'sí' : 'no',
      ])
    )
  }

  const anomalyCount = filteredRows.filter(
    (r) =>
      r.anomaly_flags.efficiency_tier === 'severe' ||
      r.anomaly_flags.efficiency_tier === 'watch' ||
      r.anomaly_flags.breakpoint_mom_lph ||
      r.anomaly_flags.review_consumption_pattern
  ).length

  const qualityIssueCount = filteredRows.filter(
    (r) => r.anomaly_flags.data_quality_tier !== 'ok' || r.quality_flags.negative_hours_consumed_count > 0
  ).length

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100 border border-amber-200 flex-shrink-0">
              <Fuel className="h-4.5 w-4.5 text-amber-700" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                Eficiencia diésel
              </h1>
              {lastComputed && (
                <p className="text-xs text-stone-400 mt-0.5">
                  Calculado {new Date(lastComputed).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-stone-200 text-stone-600 hover:text-stone-900"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-stone-200 text-stone-600 hover:text-stone-900"
              onClick={exportCsv}
              disabled={filteredRows.length === 0}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar CSV
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-stone-200">
                  <MoreHorizontal className="h-4 w-4 text-stone-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-sm">
                <DropdownMenuItem onClick={() => void onRecompute()} disabled={recomputing}>
                  {recomputing ? 'Recalculando…' : 'Recalcular Ene–May 2026'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Message banner */}
        {message && (
          <div className={[
            'text-sm px-4 py-2.5 rounded-lg border',
            message.ok
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800',
          ].join(' ')}>
            {message.text}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-stone-900/[0.08] rounded-lg">
          {/* Month */}
          <Select value={yearMonth} onValueChange={setYearMonth}>
            <SelectTrigger className="h-8 w-36 text-xs border-stone-200 bg-stone-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">{MONTHS_LABEL[m] ?? m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-5 bg-stone-200" />

          {/* Business unit */}
          <Select value={selectedBu ?? '__all'} onValueChange={v => {
            setSelectedBu(v === '__all' ? null : v)
            setSelectedPlant(null)
          }}>
            <SelectTrigger className="h-8 w-40 text-xs border-stone-200 bg-stone-50">
              <SelectValue placeholder="Unidad negocio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all" className="text-xs">Todas las UNs</SelectItem>
              {businessUnits.map(bu => (
                <SelectItem key={bu.id} value={bu.id} className="text-xs">{bu.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Plant */}
          <Select value={selectedPlant ?? '__all'} onValueChange={v => setSelectedPlant(v === '__all' ? null : v)}>
            <SelectTrigger className="h-8 w-40 text-xs border-stone-200 bg-stone-50">
              <SelectValue placeholder="Planta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all" className="text-xs">Todas las plantas</SelectItem>
              {plantsForBu.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category */}
          <Select value={selectedCategory ?? '__all'} onValueChange={(v) => setSelectedCategory(v === '__all' ? null : v)}>
            <SelectTrigger className="h-8 w-36 text-xs border-stone-200 bg-stone-50">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all" className="text-xs">Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-5 bg-stone-200" />

          {/* Asset search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar activo…"
              value={assetSearch}
              onChange={e => setAssetSearch(e.target.value)}
              className="h-8 pl-7 pr-7 text-xs border border-stone-200 bg-stone-50 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-transparent w-40"
            />
            {assetSearch && (
              <button
                onClick={() => setAssetSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="ml-auto">
            <span className="text-xs text-stone-400 tabular-num">
              {filteredRows.length} activo{filteredRows.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* KPI instrument cluster */}
        {!loading && rows.length > 0 && (
          <KpiStrip
            rows={filteredRows}
            prevRows={filteredPrevRows}
            onFilterAnomaly={() => setView('anomalies')}
            onFilterQuality={() => setView('quality')}
          />
        )}

        {/* Plant breakdown */}
        {!loading && rows.length > 0 && (
          <PlantBarStrip
            rows={filteredRows}
            plantNames={plantNames}
            selectedPlant={selectedPlant}
            onSelectPlant={setSelectedPlant}
          />
        )}

        {/* View tabs */}
        <div className="bg-white border border-stone-900/[0.08] rounded-lg overflow-hidden">
          {/* Tab strip */}
          <div className="flex border-b border-stone-900/[0.08]">
            {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => {
              const badge = v === 'anomalies' ? anomalyCount : v === 'quality' ? qualityIssueCount : null
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={[
                    'flex items-center gap-1.5 px-5 py-3 text-xs font-semibold border-b-2 transition-colors',
                    view === v
                      ? 'border-amber-600 text-amber-700 bg-amber-50/40'
                      : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50',
                  ].join(' ')}
                >
                  {VIEW_LABELS[v]}
                  {badge != null && badge > 0 && (
                    <span className={[
                      'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold',
                      v === 'anomalies' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
                    ].join(' ')}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className={view === 'fleet' ? 'overflow-x-auto' : 'p-5'}>
            {loading ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-stone-400">Cargando datos de eficiencia…</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-3 text-center px-8">
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
                  <Fuel className="h-5 w-5 text-stone-400" />
                </div>
                <div>
                  <p className="font-semibold text-stone-700">Sin datos para {MONTHS_LABEL[yearMonth] ?? yearMonth}</p>
                  <p className="text-sm text-stone-400 mt-1 max-w-md">
                    Primero aplica la migración en Supabase, luego ejecuta el backfill o usa
                    «Recalcular» en el menú ⋯ para calcular las métricas de este mes.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 border-stone-200 text-stone-600"
                  onClick={() => void onRecompute()}
                  disabled={recomputing}
                >
                  {recomputing ? 'Recalculando…' : 'Recalcular ahora'}
                </Button>
              </div>
            ) : view === 'fleet' ? (
              <AssetTable rows={filteredRows} prevRows={filteredPrevRows} onOpenDrill={openDrill} yearMonth={yearMonth} />
            ) : view === 'anomalies' ? (
              <AnomaliesList rows={filteredRows} onOpenDrill={openDrill} />
            ) : (
              <DataQualityList rows={filteredRows} onOpenDrill={openDrill} />
            )}
          </div>
        </div>

      {/* Drill-in sheet */}
      <DrillSheet
        row={drillRow}
        yearMonth={yearMonth}
        open={drillOpen}
        onOpenChange={setDrillOpen}
        onDataChanged={load}
      />
    </div>
  )
}

export default function EficienciaDieselPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center">
          <div className="flex items-center gap-3 text-stone-400">
            <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Cargando eficiencia diésel…</span>
          </div>
        </div>
      }
    >
      <EficienciaDieselContent />
    </Suspense>
  )
}
