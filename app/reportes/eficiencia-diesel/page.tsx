'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RefreshCw, ExternalLink, Download, Gauge } from 'lucide-react'

type GrainMode = 'trusted_monthly' | 'sql_monthly' | 'weekly' | 'daily'

type TrustedRow = {
  id: string
  year_month: string
  total_liters: number
  hours_merged: number
  hours_sum_raw: number
  hours_trusted: number
  kilometers_sum_raw: number
  liters_per_hour_trusted: number | null
  liters_per_km: number | null
  concrete_m3: number | null
  liters_per_m3: number | null
  equipment_category: string | null
  quality_flags: Record<string, unknown>
  anomaly_flags: Record<string, unknown>
  assets?: { id: string; asset_id: string | null; name: string | null } | null
}

type BucketRow = Record<string, unknown> & {
  asset_id?: string
  plant_id?: string
  total_liters?: number
  sum_hours_consumed?: number
  sum_km_consumed?: number
  transaction_count?: number
  liters_per_sum_hour?: number | null
  liters_per_sum_km?: number | null
  asset_code?: string | null
  asset_name?: string | null
}

type MeterEvent = {
  source_kind: string | null
  source_id: string
  event_at: string
  hours_reading: number | null
  hours_consumed: number | null
  previous_hours: number | null
  quantity_liters: number | null
}

const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04']

function monthIsoRange(yearMonth: string): { from: string; to: string } {
  const [ys, ms] = yearMonth.split('-')
  const y = Number(ys)
  const m = Number(ms)
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString()
  const to = new Date(Date.UTC(y, m, 1)).toISOString()
  return { from, to }
}

function downloadCsv(filename: string, header: string[], lines: string[][]) {
  const esc = (cell: string | number | null | undefined) => {
    const s = cell == null ? '' : String(cell)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const body = [header.join(','), ...lines.map((row) => row.map(esc).join(','))].join('\n')
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function EficienciaDieselReportContent() {
  const searchParams = useSearchParams()
  const [yearMonth, setYearMonth] = useState('2026-04')
  const [grain, setGrain] = useState<GrainMode>('trusted_monthly')
  const [trustedRows, setTrustedRows] = useState<TrustedRow[]>([])
  const [bucketRows, setBucketRows] = useState<BucketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [meterOpen, setMeterOpen] = useState(false)
  const [meterLabel, setMeterLabel] = useState('')
  const [meterLoading, setMeterLoading] = useState(false)
  const [meterEvents, setMeterEvents] = useState<MeterEvent[]>([])

  useEffect(() => {
    const qm = searchParams.get('yearMonth')
    if (qm && /^\d{4}-\d{2}$/.test(qm)) {
      queueMicrotask(() => setYearMonth(qm))
    }
  }, [searchParams])

  const loadTrusted = useCallback(async () => {
    const r = await fetch(`/api/reports/asset-diesel-efficiency?yearMonth=${encodeURIComponent(yearMonth)}`)
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Error al cargar')
    setTrustedRows(j.rows || [])
  }, [yearMonth])

  const loadBuckets = useCallback(async () => {
    const g = grain === 'sql_monthly' ? 'monthly' : grain === 'weekly' ? 'weekly' : 'daily'
    const r = await fetch(
      `/api/reports/diesel-efficiency-buckets?yearMonth=${encodeURIComponent(yearMonth)}&grain=${g}`
    )
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Error al cargar buckets')
    setBucketRows(j.rows || [])
  }, [yearMonth, grain])

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      if (grain === 'trusted_monthly') {
        await loadTrusted()
        setBucketRows([])
      } else {
        await loadBuckets()
        setTrustedRows([])
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error')
      setTrustedRows([])
      setBucketRows([])
    } finally {
      setLoading(false)
    }
  }, [grain, loadTrusted, loadBuckets])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

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
      setMessage(`Recalculado: ${j.upserted ?? 0} filas. ${(j.errors || []).join('; ')}`)
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error')
    } finally {
      setRecomputing(false)
    }
  }

  const fmt = (n: number | null | undefined, d = 2) =>
    n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toFixed(d)

  const sortedTrusted = useMemo(
    () =>
      [...trustedRows].sort(
        (a, b) => (b.liters_per_hour_trusted || 0) - (a.liters_per_hour_trusted || 0)
      ),
    [trustedRows]
  )

  const sortedBuckets = useMemo(() => {
    const key =
      grain === 'daily' ? 'bucket_day' : grain === 'weekly' ? 'bucket_week' : 'bucket_month'
    return [...bucketRows].sort((a, b) => String(a[key]).localeCompare(String(b[key])))
  }, [bucketRows, grain])

  const openMeterSheet = async (assetId: string, label: string) => {
    setMeterLabel(label)
    setMeterOpen(true)
    setMeterLoading(true)
    setMeterEvents([])
    try {
      const { from, to } = monthIsoRange(yearMonth)
      const r = await fetch(
        `/api/assets/${assetId}/meter-events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      )
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Error')
      setMeterEvents((j.events || []) as MeterEvent[])
    } catch {
      setMeterEvents([])
    } finally {
      setMeterLoading(false)
    }
  }

  const exportCsv = () => {
    if (grain === 'trusted_monthly') {
      downloadCsv(
        `eficiencia-diesel-trusted-${yearMonth}.csv`,
        [
          'year_month',
          'asset_code',
          'asset_name',
          'category',
          'total_liters',
          'hours_merged',
          'hours_sum_raw',
          'hours_trusted',
          'L_h_trusted',
          'L_km',
          'm3',
          'L_m3',
          'data_quality_tier',
          'efficiency_tier',
          'merge_fork',
        ],
        sortedTrusted.map((r) => {
          const q = r.quality_flags as { merge_fork?: boolean }
          const a = r.anomaly_flags as {
            data_quality_tier?: string
            efficiency_tier?: string
          }
          return [
            r.year_month,
            r.assets?.asset_id ?? '',
            r.assets?.name ?? '',
            r.equipment_category ?? '',
            r.total_liters,
            r.hours_merged,
            r.hours_sum_raw,
            r.hours_trusted,
            r.liters_per_hour_trusted ?? '',
            r.liters_per_km ?? '',
            r.concrete_m3 ?? '',
            r.liters_per_m3 ?? '',
            a.data_quality_tier ?? '',
            a.efficiency_tier ?? '',
            q.merge_fork ? 'yes' : 'no',
          ]
        })
      )
    } else {
      const bk =
        grain === 'daily' ? 'bucket_day' : grain === 'weekly' ? 'bucket_week' : 'bucket_month'
      downloadCsv(
        `eficiencia-diesel-sql-${grain}-${yearMonth}.csv`,
        [
          String(bk),
          'plant_id',
          'asset_id',
          'asset_code',
          'asset_name',
          'total_liters',
          'sum_hours_consumed',
          'sum_km_consumed',
          'tx_count',
          'L_h_sum_hours',
          'L_km_sum_km',
        ],
        sortedBuckets.map((r) => [
          String(r[bk] ?? ''),
          String(r.plant_id ?? ''),
          String(r.asset_id ?? ''),
          String(r.asset_code ?? ''),
          String(r.asset_name ?? ''),
          Number(r.total_liters ?? 0),
          Number(r.sum_hours_consumed ?? 0),
          Number(r.sum_km_consumed ?? 0),
          Number(r.transaction_count ?? 0),
          r.liters_per_sum_hour ?? '',
          r.liters_per_sum_km ?? '',
        ])
      )
    }
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Eficiencia diésel</h1>
          <p className="text-muted-foreground max-w-3xl">
            <strong>Mensual confiable</strong>: horas fusionadas primero; si no hay curva, suma de{' '}
            <code className="text-xs">hours_consumed</code> (
            <code className="text-xs">lib/reports/diesel-efficiency-hours-policy.ts</code>).{' '}
            <strong>Diario / semanal / mensual SQL</strong>: vistas{' '}
            <code className="text-xs">diesel_efficiency_bucket_*_mex</code> — denominador = suma de deltas en
            transacciones (no curva fusionada).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/reportes/gerencial">Reporte gerencial</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/diesel/analytics">Analíticas diesel</Link>
          </Button>
          <Button variant="outline" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={loading || (grain === 'trusted_monthly' ? sortedTrusted.length === 0 : sortedBuckets.length === 0)}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={onRecompute} disabled={recomputing}>
            {recomputing ? 'Recalculando…' : 'Recalcular Ene–Abr 2026'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Mes calendario (América/Ciudad de México). Período adicional vía agregación SQL en pestaña de
            granularidad.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="w-48">
            <Label>Mes</Label>
            <Select value={yearMonth} onValueChange={setYearMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-72">
            <Label>Granularidad / fuente</Label>
            <Select value={grain} onValueChange={(v) => setGrain(v as GrainMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trusted_monthly">
                  Mensual — horas confiables (materializado)
                </SelectItem>
                <SelectItem value="sql_monthly">Mensual — suma SQL (transacciones)</SelectItem>
                <SelectItem value="weekly">Semanal — suma SQL</SelectItem>
                <SelectItem value="daily">Diario — suma SQL</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {message && (
        <p className={`text-sm ${message.startsWith('Recalculado') ? 'text-green-700' : 'text-destructive'}`}>
          {message}
        </p>
      )}

      {grain === 'trusted_monthly' ? (
        <Card>
          <CardHeader>
            <CardTitle>Activos (eficiencia mensual)</CardTitle>
            <CardDescription>
              L/h con denominador confiable; banderas de calidad y anomalías. Enlace «Eventos» abre la línea de
              tiempo <code className="text-xs">asset_meter_reading_events</code> del mes.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <p className="text-muted-foreground">Cargando…</p>
            ) : sortedTrusted.length === 0 ? (
              <p className="text-muted-foreground">
                Sin datos para este mes. Ejecute migraciones Supabase y use «Recalcular» o{' '}
                <code className="text-xs">npx tsx scripts/backfill-asset-diesel-efficiency-jan-apr-2026.ts</code>.
              </p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Categoría</th>
                    <th className="py-2 pr-3 text-right">Litros</th>
                    <th className="py-2 pr-3 text-right">h fusionadas</th>
                    <th className="py-2 pr-3 text-right">h suma TX</th>
                    <th className="py-2 pr-3 text-right">h confiables</th>
                    <th className="py-2 pr-3 text-right">L/h</th>
                    <th className="py-2 pr-3 text-right">L/km</th>
                    <th className="py-2 pr-3 text-right">m³</th>
                    <th className="py-2 pr-3 text-right">L/m³</th>
                    <th className="py-2 pr-3">Calidad</th>
                    <th className="py-2 pr-3">Eficiencia</th>
                    <th className="py-2 pr-3">Drill</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTrusted.map((r) => {
                    const q = r.quality_flags as { merge_fork?: boolean }
                    const a = r.anomaly_flags as {
                      data_quality_tier?: string
                      efficiency_tier?: string
                      breakpoint_mom_lph?: boolean
                      review_consumption_pattern?: boolean
                    }
                    const aid = r.assets?.id
                    const label = `${r.assets?.asset_id || ''} ${r.assets?.name || ''}`.trim()
                    return (
                      <tr key={r.id} className="border-b border-border/60">
                        <td className="py-2 pr-3 font-mono">{r.assets?.asset_id || '—'}</td>
                        <td className="py-2 pr-3">{r.assets?.name || '—'}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.equipment_category || '—'}</td>
                        <td className="py-2 pr-3 text-right">{fmt(r.total_liters, 1)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(r.hours_merged, 2)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(r.hours_sum_raw, 2)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(r.hours_trusted, 2)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(r.liters_per_hour_trusted, 3)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(r.liters_per_km, 4)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(r.concrete_m3, 2)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(r.liters_per_m3, 3)}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline">{a.data_quality_tier || '—'}</Badge>
                            {q.merge_fork ? (
                              <Badge variant="secondary" title="Divergencia curva vs suma de hours_consumed">
                                fork
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline">{a.efficiency_tier || '—'}</Badge>
                            {a.breakpoint_mom_lph ? <Badge variant="destructive">MoM</Badge> : null}
                            {a.review_consumption_pattern ? (
                              <Badge variant="secondary" title="Revisar consumo (no implica sustracción)">
                                revisar
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {aid ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => void openMeterSheet(aid, label)}
                                >
                                  <Gauge className="h-3.5 w-3.5 mr-1" />
                                  Eventos
                                </Button>
                                <Button variant="ghost" size="sm" asChild>
                                  <Link href={`/activos/${aid}`}>
                                    <ExternalLink className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button variant="ghost" size="sm" asChild>
                                  <Link href="/diesel/historial">Historial diesel</Link>
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Agregación SQL ({grain === 'sql_monthly' ? 'mensual' : grain === 'weekly' ? 'semanal' : 'diaria'})</CardTitle>
            <CardDescription>
              Suma de litros y de <code className="text-xs">hours_consumed</code> por bucket; L/h = litros / suma
              horas. Útil para contrastar con la curva fusionada del modo mensual confiable.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <p className="text-muted-foreground">Cargando…</p>
            ) : sortedBuckets.length === 0 ? (
              <p className="text-muted-foreground">Sin filas en el bucket para este mes.</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Bucket</th>
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3 text-right">Litros</th>
                    <th className="py-2 pr-3 text-right">h suma</th>
                    <th className="py-2 pr-3 text-right">km suma</th>
                    <th className="py-2 pr-3 text-right">Tx</th>
                    <th className="py-2 pr-3 text-right">L/h</th>
                    <th className="py-2 pr-3">Drill</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBuckets.map((r, idx) => {
                    const bk =
                      grain === 'daily' ? 'bucket_day' : grain === 'weekly' ? 'bucket_week' : 'bucket_month'
                    const aid = r.asset_id as string | undefined
                    return (
                      <tr key={`${String(r[bk])}-${aid}-${idx}`} className="border-b border-border/60">
                        <td className="py-2 pr-3 font-mono text-xs">{String(r[bk] ?? '—')}</td>
                        <td className="py-2 pr-3 font-mono">{r.asset_code || '—'}</td>
                        <td className="py-2 pr-3">{r.asset_name || '—'}</td>
                        <td className="py-2 pr-3 text-right">{fmt(Number(r.total_liters), 1)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(Number(r.sum_hours_consumed), 2)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(Number(r.sum_km_consumed), 2)}</td>
                        <td className="py-2 pr-3 text-right">{Number(r.transaction_count ?? 0)}</td>
                        <td className="py-2 pr-3 text-right">
                          {fmt(r.liters_per_sum_hour != null ? Number(r.liters_per_sum_hour) : null, 3)}
                        </td>
                        <td className="py-2 pr-3">
                          {aid ? (
                            <div className="flex flex-wrap gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() =>
                                  void openMeterSheet(
                                    aid,
                                    `${r.asset_code || ''} ${r.asset_name || ''}`.trim()
                                  )
                                }
                              >
                                <Gauge className="h-3.5 w-3.5 mr-1" />
                                Eventos
                              </Button>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/activos/${aid}`}>
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      <Sheet open={meterOpen} onOpenChange={setMeterOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Eventos de horómetro</SheetTitle>
            <SheetDescription>
              {meterLabel} · {yearMonth} · fuente unificada{' '}
              <code className="text-xs">asset_meter_reading_events</code>
            </SheetDescription>
          </SheetHeader>
          {meterLoading ? (
            <p className="text-sm text-muted-foreground py-4">Cargando eventos…</p>
          ) : meterEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin eventos en el rango.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-right">Lectura h</TableHead>
                  <TableHead className="text-right">h consumidas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meterEvents.map((ev) => (
                  <TableRow key={`${ev.source_kind}-${ev.source_id}`}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(ev.event_at).toLocaleString('es-MX')}
                    </TableCell>
                    <TableCell className="text-xs">{ev.source_kind || '—'}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {ev.hours_reading != null ? fmt(ev.hours_reading, 2) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {ev.hours_consumed != null ? fmt(ev.hours_consumed, 2) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default function EficienciaDieselReportPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-10 px-4 text-muted-foreground">Cargando reporte…</div>
      }
    >
      <EficienciaDieselReportContent />
    </Suspense>
  )
}
