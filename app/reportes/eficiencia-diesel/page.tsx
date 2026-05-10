'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, ExternalLink } from 'lucide-react'

type Row = {
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

const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04']

export default function EficienciaDieselReportPage() {
  const [yearMonth, setYearMonth] = useState('2026-04')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const r = await fetch(`/api/reports/asset-diesel-efficiency?yearMonth=${encodeURIComponent(yearMonth)}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Error al cargar')
      setRows(j.rows || [])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [yearMonth])

  useEffect(() => {
    void load()
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

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.liters_per_hour_trusted || 0) - (a.liters_per_hour_trusted || 0)),
    [rows]
  )

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Eficiencia diésel (mensual)</h1>
          <p className="text-muted-foreground">
            Horas confiables = curva horómetro fusionada cuando existe; si no, suma de{' '}
            <code className="text-xs">hours_consumed</code>. Ver política en{' '}
            <code className="text-xs">lib/reports/diesel-efficiency-hours-policy.ts</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/reportes/gerencial">Reporte gerencial</Link>
          </Button>
          <Button variant="outline" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={onRecompute} disabled={recomputing}>
            {recomputing ? 'Recalculando…' : 'Recalcular Ene–Abr 2026'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Mes contable (zona horaria usada en agregación SQL: América/Ciudad de México)</CardDescription>
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
        </CardContent>
      </Card>

      {message && (
        <p className={`text-sm ${message.startsWith('Recalculado') ? 'text-green-700' : 'text-destructive'}`}>
          {message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Activos</CardTitle>
          <CardDescription>L/h con denominador confiable; banderas de calidad y anomalías (JSON)</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-muted-foreground">Cargando…</p>
          ) : sorted.length === 0 ? (
            <p className="text-muted-foreground">
              Sin datos para este mes. Ejecute migraciones Supabase y use «Recalcular» (requiere{' '}
              <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> en el servidor) o{' '}
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
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const q = r.quality_flags as { merge_fork?: boolean }
                  const a = r.anomaly_flags as {
                    data_quality_tier?: string
                    efficiency_tier?: string
                    breakpoint_mom_lph?: boolean
                    review_consumption_pattern?: boolean
                  }
                  const aid = r.assets?.id
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
                        {aid ? (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/activos/${aid}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
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
    </div>
  )
}
