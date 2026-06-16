'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { CreateTireDialog } from '@/components/tires/create-tire-dialog'
import { MountTireDialog } from '@/components/tires/mount-tire-dialog'
import { TireReadingDialog } from '@/components/tires/tire-reading-dialog'
import { TirePositionMap } from '@/components/tires/tire-position-map'
import { TireDiagramSvg } from '@/components/tires/tire-diagram-svg'
import { tireBodyTypeFromCategory } from '@/lib/tires/diagram-geometry'
import {
  TirePositionSheet,
  type TirePositionSheetMode,
} from '@/components/tires/tire-position-sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { TireEmptyState } from '@/components/tires/tire-empty-state'
import { RotationDialog } from '@/components/tires/rotation-dialog'
import { getTireUiRole, type AssetTireSubState } from '@/lib/tires/fleet-status'
import { findOrphanedPositionCodes } from '@/lib/tires/coverage'
import { DEFAULT_MIN_TREAD_MM, DEFAULT_TIRE_POSITIONS, PRESSURE_RANGE_PSI } from '@/lib/tires/positions'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { ArrowLeft, CircleDot, Loader2, Plus, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type {
  AssetTireInstallation,
  ResolvedTireLayout,
  TireEvent,
  TireLayoutTemplateKey,
  TirePosition,
  TireThresholds,
} from '@/types/tires'

interface AssetTiresPageProps {
  assetId: string
  assetName?: string
}

interface AssetTireApiResponse {
  asset?: {
    model_id?: string | null
    model?: { id?: string; name?: string; category?: string | null } | null
  }
  installations?: AssetTireInstallation[]
  events?: TireEvent[]
  layout?: ResolvedTireLayout & { has_explicit_layout?: boolean }
  warehouse_tire_count?: number
  asset_sub_state?: AssetTireSubState
  coverage?: { mounted: number; total: number; pct: number }
}

export function AssetTiresPageClient({ assetId, assetName }: AssetTiresPageProps) {
  const searchParams = useSearchParams()
  const workOrderId = searchParams.get('workOrderId')
  const { profile } = useAuthZustand()
  const tireRole = getTireUiRole(profile?.role)
  const isMobile = useIsMobile()

  const [loading, setLoading] = useState(true)
  const [installations, setInstallations] = useState<AssetTireInstallation[]>([])
  const [events, setEvents] = useState<TireEvent[]>([])
  const [subState, setSubState] = useState<AssetTireSubState>('complete')
  const [warehouseCount, setWarehouseCount] = useState(0)
  const [coverage, setCoverage] = useState({ mounted: 0, total: 0, pct: 0 })
  const [modelId, setModelId] = useState<string | null>(null)
  const [modelName, setModelName] = useState<string | undefined>()
  const [modelCategory, setModelCategory] = useState<string | null>(null)
  const [layoutReady, setLayoutReady] = useState(true)
  const [layoutPositions, setLayoutPositions] = useState<TirePosition[]>(DEFAULT_TIRE_POSITIONS)
  const [templateKey, setTemplateKey] = useState<TireLayoutTemplateKey>('truck_6x4')
  const [createOpen, setCreateOpen] = useState(false)
  const [mountOpen, setMountOpen] = useState(false)
  const [readingInst, setReadingInst] = useState<AssetTireInstallation | null>(null)
  const [applyingLayout, setApplyingLayout] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<TirePositionSheetMode>('mount')
  const [selectedPosition, setSelectedPosition] = useState<TirePosition | null>(null)
  const [selectedInstallation, setSelectedInstallation] =
    useState<AssetTireInstallation | null>(null)
  const [rotateInst, setRotateInst] = useState<AssetTireInstallation | null>(null)
  const [fleetThresholds, setFleetThresholds] = useState<TireThresholds>({
    min_tread_mm: DEFAULT_MIN_TREAD_MM,
    pressure_min_psi: PRESSURE_RANGE_PSI.min,
    pressure_max_psi: PRESSURE_RANGE_PSI.max,
    days_without_reading: 14,
  })
  const positionDeepLinkHandled = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tiresRes, settingsRes] = await Promise.all([
        fetch(`/api/assets/${assetId}/tires`),
        fetch('/api/tires/settings'),
      ])
      const data = (await tiresRes.json()) as AssetTireApiResponse
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        if (settingsData.settings?.thresholds) {
          setFleetThresholds((prev) => ({ ...prev, ...settingsData.settings.thresholds }))
        }
      }
      if (tiresRes.ok) {
        setInstallations(data.installations ?? [])
        setEvents(data.events ?? [])
        setSubState(data.asset_sub_state ?? 'complete')
        setWarehouseCount(data.warehouse_tire_count ?? 0)
        setCoverage(data.coverage ?? { mounted: 0, total: 0, pct: 0 })
        setModelId(data.asset?.model_id ?? null)
        setModelName(data.asset?.model?.name)
        setModelCategory(data.asset?.model?.category ?? null)
        setLayoutReady(data.layout?.has_explicit_layout ?? false)
        setLayoutPositions(data.layout?.positions ?? DEFAULT_TIRE_POSITIONS)
        setTemplateKey(data.layout?.template_key ?? 'truck_6x4')
      }
    } finally {
      setLoading(false)
    }
  }, [assetId])

  useEffect(() => {
    load()
  }, [load])

  const active = installations.filter((i) => !i.removed_at)
  const history = installations.filter((i) => i.removed_at)
  const occupied = active.map((i) => i.position_code)
  const orphanedPositions = findOrphanedPositionCodes(occupied, layoutPositions)

  const handlePositionClick = (
    position: TirePosition,
    installation?: AssetTireInstallation
  ) => {
    setSelectedPosition(position)
    setSelectedInstallation(installation ?? null)
    if (installation) {
      setSheetMode('detail')
      setSheetOpen(true)
      return
    }
    if (subState === 'no-layout' || subState === 'no-stock') return
    setSheetMode('mount')
    setSheetOpen(true)
  }

  useEffect(() => {
    const positionCode = searchParams.get('position')
    if (positionDeepLinkHandled.current || !positionCode || loading || layoutPositions.length === 0) {
      return
    }
    const position = layoutPositions.find((p) => p.code === positionCode)
    if (!position) return
    positionDeepLinkHandled.current = true
    const installation = active.find((i) => i.position_code === positionCode)
    handlePositionClick(position, installation)
  }, [searchParams, loading, layoutPositions, active, subState])

  const handleApplyModelLayout = async () => {
    if (!modelId) {
      toast.error('Este activo no tiene modelo asignado')
      return
    }
    setApplyingLayout(true)
    try {
      const getRes = await fetch(`/api/equipment-models/${modelId}/tire-layout`)
      const getData = await getRes.json()
      if (!getRes.ok) throw new Error(getData.error || 'Error al consultar layout')

      if (!getData.layout) {
        const res = await fetch(`/api/equipment-models/${modelId}/tire-layout`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template_key: 'truck_6x4', positions: [] }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al aplicar layout')
      }

      toast.success('Layout del modelo aplicado')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al aplicar layout')
    } finally {
      setApplyingLayout(false)
    }
  }

  const handleUnmount = async (installationId: string, retire = false) => {
    if (!confirm(retire ? '¿Dar de baja esta llanta?' : '¿Desmontar esta llanta?')) return
    const res = await fetch(`/api/assets/${assetId}/tires`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'unmount',
        installation_id: installationId,
        retire_tire: retire,
        work_order_id: workOrderId ?? undefined,
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error || 'Error')
      return
    }
    setSheetOpen(false)
    load()
  }

  const emptyVariant =
    subState === 'no-layout'
      ? 'asset-no-layout'
      : subState === 'no-stock'
        ? 'asset-no-stock'
        : subState === 'ready-to-mount'
          ? 'asset-ready-to-mount'
          : subState === 'partial'
            ? 'asset-partial'
            : null

  const showSetupEmpty = emptyVariant != null && subState !== 'complete'

  return (
    <DashboardShell>
      <DashboardHeader
        heading={assetName ? `Llantas — ${assetName}` : 'Llantas del activo'}
        text={
          workOrderId
            ? `Vinculado a OT ${workOrderId.slice(0, 8)}… — montajes y eventos se registrarán en la orden.`
            : coverage.total > 0
              ? `${coverage.mounted}/${coverage.total} posiciones · ${coverage.pct}% cobertura`
              : 'Mapa de posiciones, lecturas de banda/presión e historial de montajes.'
        }
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/activos/${assetId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al activo
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          {tireRole !== 'mechanic' && (
            <>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva llanta
              </Button>
              <Button
                size="sm"
                onClick={() => setMountOpen(true)}
                disabled={subState === 'no-layout' || subState === 'no-stock'}
              >
                <CircleDot className="mr-2 h-4 w-4" />
                Montar llanta
              </Button>
            </>
          )}
        </div>
      </DashboardHeader>

      {loading && installations.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {tireRole === 'mechanic' && !layoutReady && (
            <Alert>
              <AlertDescription>
                Aún no hay llantas configuradas para este activo. Pida a su supervisor iniciar la
                configuración.
              </AlertDescription>
            </Alert>
          )}

          {orphanedPositions.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                Hay llantas montadas en posiciones que ya no existen en el layout actual:{' '}
                {orphanedPositions.join(', ')}. Actualice el layout del modelo o desmonte esas
                llantas.
                {modelId && (
                  <>
                    {' '}
                    <Link href={`/modelos/${modelId}?tab=tires`} className="underline">
                      Editar layout del modelo
                    </Link>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {showSetupEmpty && emptyVariant && (
            <TireEmptyState
              variant={emptyVariant}
              role={tireRole}
              assetName={assetName}
              modelName={modelName}
              mountedCount={coverage.mounted}
              totalPositions={coverage.total}
              warehouseCount={warehouseCount}
              onPrimaryAction={
                subState === 'no-layout'
                  ? handleApplyModelLayout
                  : subState === 'ready-to-mount' || subState === 'partial'
                    ? () => setMountOpen(true)
                    : undefined
              }
              primaryHref={
                subState === 'no-stock' ? '/activos/llantas' : undefined
              }
            />
          )}

          {subState === 'no-layout' && applyingLayout && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {(subState === 'complete' || subState === 'partial' || subState === 'ready-to-mount') && (
            <Tabs defaultValue="diagram" className="space-y-4">
              <TabsList>
                <TabsTrigger value="diagram">Diagrama</TabsTrigger>
                <TabsTrigger value="table">Vista tabla</TabsTrigger>
                <TabsTrigger value="active">Montadas ({active.length})</TabsTrigger>
                <TabsTrigger value="history">Historial</TabsTrigger>
                <TabsTrigger value="events">Eventos</TabsTrigger>
              </TabsList>

              <TabsContent value="diagram">
                <Card>
                  <CardHeader>
                    <CardTitle>Diagrama del vehículo</CardTitle>
                    <CardDescription>
                      Vista superior interactiva. Toque una posición vacía para montar o una
                      ocupada para ver detalle y acciones.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TireDiagramSvg
                      templateKey={templateKey}
                      positions={layoutPositions}
                      activeInstallations={active}
                      bodyType={tireBodyTypeFromCategory(modelCategory, templateKey)}
                      thresholds={fleetThresholds}
                      selectedPositionCode={selectedPosition?.code}
                      onPositionClick={handlePositionClick}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="table">
                <Card>
                  <CardHeader>
                    <CardTitle>Vista tabla</CardTitle>
                    <CardDescription>
                      Listado en cuadrícula. Las celdas en ámbar indican alerta de banda o
                      presión.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TirePositionMap
                      positions={layoutPositions}
                      activeInstallations={active}
                      thresholds={fleetThresholds}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="active">
                <Card>
                  <CardHeader>
                    <CardTitle>Llantas montadas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Posición</TableHead>
                          <TableHead>Llanta</TableHead>
                          <TableHead>Última lectura</TableHead>
                          <TableHead>Montaje</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {active.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                              No hay llantas montadas.
                            </TableCell>
                          </TableRow>
                        ) : (
                          active.map((inst) => (
                            <TableRow key={inst.id}>
                              <TableCell>{inst.position_label}</TableCell>
                              <TableCell>
                                {inst.tire ? `${inst.tire.brand} ${inst.tire.size}` : '—'}
                              </TableCell>
                              <TableCell>
                                {inst.latest_reading ? (
                                  <span>
                                    {inst.latest_reading.tread_depth_mm ?? '—'} mm /{' '}
                                    {inst.latest_reading.pressure_psi != null
                                      ? `${inst.latest_reading.pressure_psi} psi`
                                      : inst.needs_pressure_reading
                                        ? 'presión pendiente'
                                        : '—'}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Sin lectura</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {format(new Date(inst.installed_at), 'dd MMM yyyy', {
                                  locale: es,
                                })}
                              </TableCell>
                              <TableCell className="space-x-1 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setReadingInst(inst)}
                                >
                                  Lectura
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUnmount(inst.id)}
                                >
                                  Desmontar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleUnmount(inst.id, true)}
                                >
                                  Baja
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <CardTitle>Historial de montajes</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Posición</TableHead>
                          <TableHead>Llanta</TableHead>
                          <TableHead>Periodo</TableHead>
                          <TableHead>Km</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                              Sin historial de desmontajes.
                            </TableCell>
                          </TableRow>
                        ) : (
                          history.map((inst) => {
                            const km =
                              inst.km_at_install != null && inst.km_at_remove != null
                                ? inst.km_at_remove - inst.km_at_install
                                : null
                            return (
                              <TableRow key={inst.id}>
                                <TableCell>{inst.position_label}</TableCell>
                                <TableCell>
                                  {inst.tire ? `${inst.tire.brand} ${inst.tire.size}` : '—'}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(inst.installed_at), 'dd/MM/yy', { locale: es })}
                                  {' — '}
                                  {inst.removed_at
                                    ? format(new Date(inst.removed_at), 'dd/MM/yy', { locale: es })
                                    : '—'}
                                </TableCell>
                                <TableCell>{km != null ? `${km.toFixed(0)} km` : '—'}</TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="events">
                <Card>
                  <CardHeader>
                    <CardTitle>Eventos recientes</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Notas</TableHead>
                          <TableHead>Costo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                              Sin eventos registrados.
                            </TableCell>
                          </TableRow>
                        ) : (
                          events.map((ev) => (
                            <TableRow key={ev.id}>
                              <TableCell>
                                {format(new Date(ev.event_at), 'dd MMM yyyy HH:mm', {
                                  locale: es,
                                })}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{ev.event_type}</Badge>
                              </TableCell>
                              <TableCell>{ev.notes ?? '—'}</TableCell>
                              <TableCell>
                                {ev.cost != null ? `$${ev.cost.toLocaleString('es-MX')}` : '—'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}

      <TirePositionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        position={selectedPosition}
        installation={selectedInstallation}
        assetId={assetId}
        workOrderId={workOrderId}
        positions={layoutPositions}
        occupiedPositions={occupied}
        isMobile={isMobile}
        thresholds={fleetThresholds}
        onMounted={load}
        onReading={(inst) => {
          setSheetOpen(false)
          setReadingInst(inst)
        }}
        onUnmount={handleUnmount}
        onRotate={(inst) => {
          setRotateInst(inst)
          setSheetOpen(false)
        }}
      />

      <RotationDialog
        open={!!rotateInst}
        onOpenChange={(o) => !o && setRotateInst(null)}
        assetId={assetId}
        installation={rotateInst}
        positions={layoutPositions}
        occupiedPositions={occupied}
        workOrderId={workOrderId}
        onRotated={load}
      />

      <CreateTireDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <MountTireDialog
        open={mountOpen}
        onOpenChange={setMountOpen}
        assetId={assetId}
        workOrderId={workOrderId}
        positions={layoutPositions}
        occupiedPositions={occupied}
        onMounted={load}
      />
      {readingInst && readingInst.tire && (
        <TireReadingDialog
          open={!!readingInst}
          onOpenChange={(o) => !o && setReadingInst(null)}
          assetId={assetId}
          installationId={readingInst.id}
          positionLabel={readingInst.position_label}
          minTreadMm={readingInst.tire.min_tread_mm}
          onSaved={load}
        />
      )}
    </DashboardShell>
  )
}
