'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { KpiTile } from '@/components/reports/cost-analysis/command-center/kpi-tile'
import { CreateTireDialog } from '@/components/tires/create-tire-dialog'
import { TireEmptyState } from '@/components/tires/tire-empty-state'
import { FleetCoverageTable } from '@/components/tires/fleet-coverage-table'
import { getTireUiRole } from '@/lib/tires/fleet-status'
import type { TireExceptionCounts } from '@/lib/tires/exceptions'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  CircleDot,
  Plus,
  RefreshCw,
  Settings,
  Upload,
} from 'lucide-react'
import type { Tire, TireCostReportRow, TireFleetModuleState } from '@/types/tires'
import type { TireFleetKpis } from '@/lib/tires/fleet-status'
import type { FleetOperationalKpis } from '@/lib/tires/fleet-kpis'

const STATUS_LABELS: Record<string, string> = {
  en_almacen: 'En almacén',
  montada: 'Montada',
  baja: 'Baja',
}

const CHECKLIST_STEPS = [
  { id: 1, label: 'Layouts por modelo', stepKey: 'layouts' },
  { id: 2, label: 'Reglas de identificación (DOT / ID interno)', stepKey: 'id_rules' },
  { id: 3, label: 'Recepción inicial de inventario', stepKey: 'inventory' },
  { id: 4, label: 'Montaje piloto (1 activo)', stepKey: 'pilot' },
] as const

function checklistStatus(
  stepKey: string,
  completedSteps: Set<string>,
  scopeDone: boolean
): 'done' | 'pending' | 'upcoming' {
  if (stepKey === 'layouts') {
    return completedSteps.has('layouts') || completedSteps.has('scope')
      ? completedSteps.has('layouts')
        ? 'done'
        : scopeDone
          ? 'upcoming'
          : 'pending'
      : 'pending'
  }
  if (completedSteps.has(stepKey)) return 'done'
  return 'pending'
}

export function FleetHubPage() {
  const router = useRouter()
  const { profile } = useAuthZustand()
  const tireRole = getTireUiRole(profile?.role)

  const [loading, setLoading] = useState(true)
  const [tires, setTires] = useState<Tire[]>([])
  const [report, setReport] = useState<TireCostReportRow[]>([])
  const [fleetState, setFleetState] = useState<TireFleetModuleState>('empty')
  const [kpis, setKpis] = useState<TireFleetKpis>({
    assetsWithLayout: 0,
    totalRollingAssets: 0,
    positionsDefined: 0,
    warehouseCount: 0,
    mountedCount: 0,
    coveragePct: 0,
  })
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [scopeDone, setScopeDone] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [altOpen, setAltOpen] = useState(false)
  const [alertCounts, setAlertCounts] = useState<TireExceptionCounts>({
    P1: 0,
    P2: 0,
    P3: 0,
    total: 0,
  })
  const [operationalKpis, setOperationalKpis] = useState<FleetOperationalKpis | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tiresRes, reportRes, statusRes, onboardingRes, exceptionsRes, fleetKpisRes] =
        await Promise.all([
        fetch('/api/tires'),
        fetch('/api/tires/report'),
        fetch('/api/tires/fleet-status'),
        fetch('/api/tires/onboarding'),
        fetch('/api/tires/exceptions'),
        fetch('/api/tires/fleet-kpis'),
      ])
      const tiresData = await tiresRes.json()
      const reportData = await reportRes.json()
      const statusData = await statusRes.json()
      const onboardingData = await onboardingRes.json()
      const exceptionsData = await exceptionsRes.json()
      const fleetKpisData = await fleetKpisRes.json()

      if (tiresRes.ok) setTires(tiresData.tires ?? [])
      if (reportRes.ok) setReport(reportData.report ?? [])
      if (statusRes.ok && statusData.status) {
        setFleetState(statusData.status.state)
        setKpis(statusData.status.kpis)
      }
      if (onboardingRes.ok) {
        const done = new Set<string>()
        for (const row of onboardingData.progress ?? []) {
          if (row.completed_at) done.add(row.step)
        }
        setCompletedSteps(done)
        setScopeDone(done.has('scope'))
      }
      if (exceptionsRes.ok) {
        setAlertCounts(
          exceptionsData.counts ?? { P1: 0, P2: 0, P3: 0, total: 0 }
        )
      }
      if (fleetKpisRes.ok) {
        setOperationalKpis(fleetKpisData.kpis ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const showEmptyHub = fleetState === 'empty' && tires.length === 0

  const headerText = showEmptyHub
    ? 'Configure su estrategia de llantas antes de cargar datos.'
    : 'Catálogo global, estado y reporte básico de costo por desgaste.'

  const showAlerts = fleetState === 'partial' || fleetState === 'operational'

  const showOperationalKpis = fleetState === 'partial' || fleetState === 'operational'

  const kpiStrip = useMemo(
    () => (
      <div
        className={`grid gap-3 sm:grid-cols-2 ${
          showOperationalKpis ? 'xl:grid-cols-3 2xl:grid-cols-6' : showAlerts ? 'xl:grid-cols-5' : 'xl:grid-cols-4'
        }`}
      >
        <KpiTile
          label="Activos con layout"
          value={`${kpis.assetsWithLayout} / ${kpis.totalRollingAssets}`}
          accent="volume"
          emptyReason={showEmptyHub ? 'awaiting-entry' : undefined}
        />
        <KpiTile
          label="Posiciones definidas"
          value={String(kpis.positionsDefined)}
          accent="material"
          emptyReason={showEmptyHub ? 'awaiting-entry' : undefined}
        />
        <KpiTile
          label="Llantas en almacén"
          value={String(kpis.warehouseCount)}
          accent="cost"
          emptyReason={showEmptyHub ? 'awaiting-entry' : undefined}
        />
        <KpiTile
          label="Cobertura de flota"
          value={`${kpis.coveragePct}%`}
          accent="margin"
          emptyReason={showEmptyHub ? 'awaiting-entry' : undefined}
        />
        {showAlerts && (
          <KpiTile
            label="Alertas"
            value={String(alertCounts.total)}
            accent="cost"
            onDrilldown={() => router.push('/activos/llantas/excepciones')}
          />
        )}
        {showOperationalKpis && operationalKpis && (
          <>
            <KpiTile
              label="Lecturas 7 días"
              value={`${operationalKpis.readingCoverage7dPct}%`}
              accent="volume"
              emptyReason={
                operationalKpis.totalMounted === 0 ? 'awaiting-entry' : undefined
              }
            />
            <KpiTile
              label="$/km promedio flota"
              value={
                operationalKpis.avgCostPerKm != null
                  ? `$${operationalKpis.avgCostPerKm.toFixed(2)}`
                  : '—'
              }
              accent="margin"
              emptyReason={
                operationalKpis.tiresWithCostData === 0 ? 'awaiting-entry' : undefined
              }
            />
          </>
        )}
      </div>
    ),
    [kpis, showEmptyHub, showAlerts, showOperationalKpis, operationalKpis, alertCounts.total, router]
  )

  return (
    <DashboardShell>
      <DashboardHeader heading="Inventario de llantas" text={headerText}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/activos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Activos
            </Link>
          </Button>
          {tireRole !== 'mechanic' && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/activos/llantas/configuracion">
                  <Settings className="mr-2 h-4 w-4" />
                  Configurar flota
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/activos/llantas/ajustes">
                  Ajustes
                </Link>
              </Button>
            </>
          )}
          {(tireRole === 'supervisor' || tireRole === 'warehouse') && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/activos/llantas/montaje-masivo">
                <CircleDot className="mr-2 h-4 w-4" />
                Montaje masivo
              </Link>
            </Button>
          )}
          {(tireRole === 'supervisor' || tireRole === 'warehouse') && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/activos/llantas/importar">
                <Upload className="mr-2 h-4 w-4" />
                Importar Excel
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          {tireRole !== 'mechanic' && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar llanta
            </Button>
          )}
          {showAlerts && alertCounts.total > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/activos/llantas/excepciones">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Excepciones ({alertCounts.total})
              </Link>
            </Button>
          )}
        </div>
      </DashboardHeader>

      {loading && tires.length === 0 ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[136px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : showEmptyHub ? (
        <div className="space-y-6">
          {kpiStrip}

          {tireRole === 'mechanic' ? (
            <Alert>
              <CircleDot className="h-4 w-4" />
              <AlertDescription>
                Aún no hay llantas configuradas. Pida a su supervisor iniciar la configuración.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <TireEmptyState variant="global" role={tireRole} />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Próximos pasos recomendados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {CHECKLIST_STEPS.map((step) => {
                    const status = checklistStatus(step.stepKey, completedSteps, scopeDone)
                    return (
                      <div
                        key={step.id}
                        className="flex items-center justify-between rounded-lg border px-4 py-3"
                      >
                        <span className="text-sm">
                          {step.id}. {step.label}
                        </span>
                        <Badge
                          variant={status === 'done' ? 'default' : 'outline'}
                          className={
                            status === 'pending'
                              ? 'border-amber-500/50 text-amber-700 dark:text-amber-400'
                              : undefined
                          }
                        >
                          {status === 'done' ? 'Completado' : 'Pendiente'}
                        </Badge>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Collapsible open={altOpen} onOpenChange={setAltOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                    <span className="text-sm text-muted-foreground">
                      Ya tengo llantas en almacén
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${altOpen ? 'rotate-180' : ''}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                      Registrar llanta individual
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/compras">Importar desde recepción de OC</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/activos/llantas/importar">Importar Excel (plantilla)</Link>
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {fleetState === 'partial' && (
            <Alert>
              <AlertDescription>
                Cobertura incompleta — {kpis.coveragePct}% de posiciones ocupadas.{' '}
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => router.push('/activos/llantas/configuracion')}
                >
                  Continuar configuración
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {kpiStrip}

          <Tabs defaultValue="resumen" className="space-y-4">
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              {(fleetState === 'partial' || fleetState === 'operational') && (
                <>
                  <TabsTrigger value="cobertura">Cobertura por activo</TabsTrigger>
                  <TabsTrigger value="costos">Costos / KPIs</TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="resumen" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Catálogo ({tires.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marca / Medida</TableHead>
                    <TableHead>DOT</TableHead>
                    <TableHead>Condición</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Costo compra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tires.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No hay llantas registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tires.map((t) => (
                      <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <Link href={`/activos/llantas/${t.id}`} className="hover:underline">
                            {t.brand} {t.size}
                            {t.model ? ` · ${t.model}` : ''}
                          </Link>
                        </TableCell>
                        <TableCell>{t.serial_number ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{t.condition}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              t.status === 'montada'
                                ? 'default'
                                : t.status === 'baja'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {STATUS_LABELS[t.status] ?? t.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {t.purchase_cost != null
                            ? `$${t.purchase_cost.toLocaleString('es-MX')}`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reporte de costo y desgaste</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Llanta</TableHead>
                    <TableHead>Activo actual</TableHead>
                    <TableHead>Banda (mm)</TableHead>
                    <TableHead>Km recorridos</TableHead>
                    <TableHead>Costo total</TableHead>
                    <TableHead>$/km</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Sin datos para el reporte.
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.map((row) => (
                      <TableRow key={row.tire_id}>
                        <TableCell>
                          <Link href={`/activos/llantas/${row.tire_id}`} className="hover:underline">
                            {row.brand} {row.size}
                            {row.serial_number ? ` (${row.serial_number})` : ''}
                          </Link>
                        </TableCell>
                        <TableCell>{row.asset_name ?? '—'}</TableCell>
                        <TableCell>{row.current_tread_mm ?? '—'}</TableCell>
                        <TableCell>
                          {row.km_traveled != null ? row.km_traveled.toFixed(0) : '—'}
                        </TableCell>
                        <TableCell>${row.total_cost.toLocaleString('es-MX')}</TableCell>
                        <TableCell>
                          {row.cost_per_km != null ? `$${row.cost_per_km.toFixed(2)}` : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
            </TabsContent>

            {(fleetState === 'partial' || fleetState === 'operational') && (
              <TabsContent value="cobertura">
                <Card>
                  <CardHeader>
                    <CardTitle>Cobertura por activo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FleetCoverageTable />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {(fleetState === 'partial' || fleetState === 'operational') && (
              <TabsContent value="costos" className="space-y-4">
                {operationalKpis && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <KpiTile
                      label="Lecturas últimos 7 días"
                      value={`${operationalKpis.mountedWithRecentReading}/${operationalKpis.totalMounted} (${operationalKpis.readingCoverage7dPct}%)`}
                      accent="volume"
                    />
                    <KpiTile
                      label="$/km promedio"
                      value={
                        operationalKpis.avgCostPerKm != null
                          ? `$${operationalKpis.avgCostPerKm.toFixed(2)}`
                          : '—'
                      }
                      accent="margin"
                    />
                    <KpiTile
                      label="En almacén"
                      value={String(operationalKpis.warehouseCount)}
                      accent="cost"
                    />
                  </div>
                )}
                <Card>
                  <CardHeader>
                    <CardTitle>Reporte de costo y desgaste</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Llanta</TableHead>
                          <TableHead>Activo actual</TableHead>
                          <TableHead>Banda (mm)</TableHead>
                          <TableHead>Km recorridos</TableHead>
                          <TableHead>Costo total</TableHead>
                          <TableHead>$/km</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                              Sin datos para el reporte.
                            </TableCell>
                          </TableRow>
                        ) : (
                          report.map((row) => (
                            <TableRow key={row.tire_id}>
                              <TableCell>
                                <Link href={`/activos/llantas/${row.tire_id}`} className="hover:underline">
                                  {row.brand} {row.size}
                                  {row.serial_number ? ` (${row.serial_number})` : ''}
                                </Link>
                              </TableCell>
                              <TableCell>{row.asset_name ?? '—'}</TableCell>
                              <TableCell>{row.current_tread_mm ?? '—'}</TableCell>
                              <TableCell>
                                {row.km_traveled != null ? row.km_traveled.toFixed(0) : '—'}
                              </TableCell>
                              <TableCell>${row.total_cost.toLocaleString('es-MX')}</TableCell>
                              <TableCell>
                                {row.cost_per_km != null ? `$${row.cost_per_km.toFixed(2)}` : '—'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}

      <CreateTireDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
    </DashboardShell>
  )
}
