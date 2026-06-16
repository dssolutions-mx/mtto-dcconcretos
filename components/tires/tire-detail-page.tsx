'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Loader2, RefreshCw, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { getTireHealthStatus, TIRE_STATUS_VISUALS } from '@/lib/tires/status'
import type {
  AssetTireInstallation,
  Tire,
  TireEvent,
  TireReading,
} from '@/types/tires'

const STATUS_LABELS: Record<string, string> = {
  en_almacen: 'En almacén',
  montada: 'Montada',
  baja: 'Baja',
}

const EVENT_LABELS: Record<string, string> = {
  montaje: 'Montaje',
  desmontaje: 'Desmontaje',
  rotacion: 'Rotación',
  reparacion: 'Reparación',
  renovado: 'Renovado',
  baja: 'Baja',
}

interface TireDetailApiResponse {
  tire: Tire
  active_installation: AssetTireInstallation | null
  active_asset: { id?: string; name?: string; asset_id?: string | null } | null
  installations: AssetTireInstallation[]
  readings: TireReading[]
  events: TireEvent[]
  cost_summary: {
    purchase_cost: number
    event_costs: number
    total_cost: number
    km_traveled: number | null
    cost_per_km: number | null
  }
}

interface TimelineItem {
  id: string
  at: string
  label: string
  detail?: string
  tone: string
}

const EVENT_TONE: Record<string, string> = {
  montaje: 'bg-emerald-500',
  desmontaje: 'bg-slate-400',
  rotacion: 'bg-sky-500',
  reparacion: 'bg-amber-500',
  renovado: 'bg-indigo-500',
  baja: 'bg-red-500',
}

interface TireDetailPageProps {
  tireId: string
}

export function TireDetailPage({ tireId }: TireDetailPageProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<TireDetailApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tires/${tireId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al cargar llanta')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar llanta')
    } finally {
      setLoading(false)
    }
  }, [tireId])

  useEffect(() => {
    load()
  }, [load])

  const timeline = useMemo((): TimelineItem[] => {
    if (!data) return []
    const items: TimelineItem[] = []

    if (data.tire.purchase_date) {
      items.push({
        id: 'purchase',
        at: data.tire.purchase_date,
        label: 'Compra',
        detail: data.tire.purchase_cost
          ? `$${data.tire.purchase_cost.toLocaleString('es-MX')}`
          : undefined,
        tone: 'bg-sky-500',
      })
    }

    for (const inst of data.installations) {
      const asset = (inst as { assets?: { name?: string } | null }).assets ?? null
      items.push({
        id: `mount-${inst.id}`,
        at: inst.installed_at,
        label: inst.removed_at ? 'Montaje (histórico)' : 'Montaje',
        detail: `${asset?.name ?? 'Activo'} · ${inst.position_label}`,
        tone: 'bg-emerald-500',
      })
      if (inst.removed_at) {
        items.push({
          id: `unmount-${inst.id}`,
          at: inst.removed_at,
          label: 'Desmontaje',
          detail: inst.position_label,
          tone: 'bg-slate-400',
        })
      }
    }

    for (const ev of data.events) {
      items.push({
        id: `event-${ev.id}`,
        at: ev.event_at,
        label: EVENT_LABELS[ev.event_type] ?? ev.event_type,
        detail: ev.notes ?? (ev.cost != null ? `$${ev.cost.toLocaleString('es-MX')}` : undefined),
        tone: EVENT_TONE[ev.event_type] ?? 'bg-muted-foreground',
      })
    }

    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [data])

  const treadSeries = useMemo(() => {
    if (!data) return []
    return data.readings
      .filter((r) => r.tread_depth_mm != null)
      .map((r) => ({ at: r.read_at, value: r.tread_depth_mm as number }))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  }, [data])

  const title = data
    ? `${data.tire.brand} ${data.tire.size}${data.tire.serial_number ? ` · DOT …${data.tire.serial_number.slice(-3)}` : ''}`
    : 'Detalle de llanta'

  return (
    <DashboardShell>
      <DashboardHeader heading={title} text="Historial de vida, lecturas y costos.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/activos/llantas">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Inventario
            </Link>
          </Button>
          {data?.active_asset?.id && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/activos/${data.active_asset.id}/llantas`}>Ver en activo</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </DashboardHeader>

      {loading && !data ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{error}</CardContent>
        </Card>
      ) : data ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                data.tire.status === 'montada'
                  ? 'default'
                  : data.tire.status === 'baja'
                    ? 'destructive'
                    : 'secondary'
              }
            >
              {STATUS_LABELS[data.tire.status] ?? data.tire.status}
            </Badge>
            <Badge variant="outline" className="capitalize">{data.tire.condition}</Badge>
            {data.active_installation && (
              <>
                {(() => {
                  const status = getTireHealthStatus(data.active_installation)
                  const visual = TIRE_STATUS_VISUALS[status]
                  return (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
                        visual.badgeClass
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: visual.stroke }} />
                      {visual.label}
                    </span>
                  )
                })()}
                <span className="text-sm text-muted-foreground">
                  {data.active_installation.position_label}
                  {data.active_asset?.name ? ` · ${data.active_asset.name}` : ''}
                </span>
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen de costos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Costo compra</p>
                <p className="font-medium">
                  ${data.cost_summary.purchase_cost.toLocaleString('es-MX')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Costos adicionales</p>
                <p className="font-medium">
                  ${data.cost_summary.event_costs.toLocaleString('es-MX')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total acumulado</p>
                <p className="font-medium">
                  ${data.cost_summary.total_cost.toLocaleString('es-MX')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">$/km</p>
                <p className="font-medium">
                  {data.cost_summary.cost_per_km != null
                    ? `$${data.cost_summary.cost_per_km.toFixed(2)}`
                    : '—'}
                  {data.cost_summary.km_traveled != null && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({data.cost_summary.km_traveled.toFixed(0)} km)
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {treadSeries.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  Tendencia de banda
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TreadSparkline
                  series={treadSeries}
                  minTread={data.tire.min_tread_mm}
                />
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="timeline" className="space-y-4">
            <TabsList>
              <TabsTrigger value="timeline">Historial</TabsTrigger>
              <TabsTrigger value="readings">Lecturas</TabsTrigger>
              <TabsTrigger value="events">Eventos</TabsTrigger>
              <TabsTrigger value="mounts">Montajes</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Historial de vida</CardTitle>
                </CardHeader>
                <CardContent>
                  {timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
                  ) : (
                    <ol className="relative ml-1 space-y-5 border-l border-border pl-6">
                      {timeline.map((item) => (
                        <li key={item.id} className="relative">
                          <span
                            className={cn(
                              'absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-background',
                              item.tone
                            )}
                            aria-hidden
                          />
                          <p className="font-medium leading-tight">{item.label}</p>
                          {item.detail && (
                            <p className="text-sm text-muted-foreground">{item.detail}</p>
                          )}
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {format(new Date(item.at), 'dd MMM yyyy', { locale: es })}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="readings">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Banda (mm)</TableHead>
                        <TableHead>Presión (psi)</TableHead>
                        <TableHead>Posición</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.readings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                            Sin lecturas registradas.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.readings.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              {format(new Date(r.read_at), 'dd MMM yyyy HH:mm', { locale: es })}
                            </TableCell>
                            <TableCell>{r.tread_depth_mm ?? '—'}</TableCell>
                            <TableCell>{r.pressure_psi ?? '—'}</TableCell>
                            <TableCell>{r.position_code ?? '—'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="events">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Costo</TableHead>
                        <TableHead>Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.events.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                            Sin eventos.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.events.map((ev) => (
                          <TableRow key={ev.id}>
                            <TableCell>
                              {format(new Date(ev.event_at), 'dd MMM yyyy', { locale: es })}
                            </TableCell>
                            <TableCell>{EVENT_LABELS[ev.event_type] ?? ev.event_type}</TableCell>
                            <TableCell>
                              {ev.cost != null ? `$${ev.cost.toLocaleString('es-MX')}` : '—'}
                            </TableCell>
                            <TableCell>{ev.notes ?? '—'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mounts">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Posición</TableHead>
                        <TableHead>Montaje</TableHead>
                        <TableHead>Desmontaje</TableHead>
                        <TableHead>Km inicio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.installations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                            Sin historial de montajes.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.installations.map((inst) => (
                          <TableRow key={inst.id}>
                            <TableCell>{inst.position_label}</TableCell>
                            <TableCell>
                              {format(new Date(inst.installed_at), 'dd MMM yyyy', { locale: es })}
                            </TableCell>
                            <TableCell>
                              {inst.removed_at
                                ? format(new Date(inst.removed_at), 'dd MMM yyyy', { locale: es })
                                : 'Activa'}
                            </TableCell>
                            <TableCell>{inst.km_at_install ?? '—'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </DashboardShell>
  )
}

function TreadSparkline({
  series,
  minTread,
}: {
  series: { at: string; value: number }[]
  minTread: number
}) {
  const W = 320
  const H = 90
  const padX = 6
  const padY = 12
  const values = series.map((s) => s.value)
  const maxV = Math.max(...values, minTread + 2)
  const minV = Math.min(...values, minTread, 0)
  const span = maxV - minV || 1
  const x = (i: number) => padX + (i / (series.length - 1)) * (W - padX * 2)
  const y = (v: number) => padY + (1 - (v - minV) / span) * (H - padY * 2)

  const linePath = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(s.value)}`).join(' ')
  const areaPath = `${linePath} L ${x(series.length - 1)} ${H - padY} L ${x(0)} ${H - padY} Z`
  const minY = y(minTread)
  const last = series[series.length - 1]
  const first = series[0]
  const trend = last.value - first.value

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="tabular-num font-medium">{last.value} mm</span>
        <span
          className={cn(
            'tabular-num text-xs',
            trend < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
          )}
        >
          {trend > 0 ? '+' : ''}
          {trend.toFixed(1)} mm desde la primera lectura
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" preserveAspectRatio="none" role="img" aria-label="Tendencia de profundidad de banda">
        <defs>
          <linearGradient id="tread-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--tire-ok))" stopOpacity={0.25} />
            <stop offset="100%" stopColor="hsl(var(--tire-ok))" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Minimum threshold line */}
        <line
          x1={padX}
          y1={minY}
          x2={W - padX}
          y2={minY}
          stroke="hsl(var(--tire-critical))"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.7}
        />
        <path d={areaPath} fill="url(#tread-area)" />
        <path d={linePath} fill="none" stroke="hsl(var(--tire-ok))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(series.length - 1)} cy={y(last.value)} r={3.5} fill="hsl(var(--tire-ok))" stroke="hsl(var(--card))" strokeWidth={1.5} />
      </svg>
      <p className="text-xs text-muted-foreground">
        Línea roja punteada = mínimo permitido ({minTread} mm).
      </p>
    </div>
  )
}
