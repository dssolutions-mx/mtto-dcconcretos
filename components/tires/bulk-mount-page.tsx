'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { TireDiagramSvg } from '@/components/tires/tire-diagram-svg'
import { useIsMobile } from '@/hooks/use-mobile'
import { DEFAULT_TIRE_POSITIONS } from '@/lib/tires/positions'
import { getDiagramGeometry } from '@/lib/tires/diagram-geometry'
import type { AssetCoverageRow } from '@/lib/tires/coverage'
import type {
  AssetTireInstallation,
  ResolvedTireLayout,
  Tire,
  TireLayoutTemplateKey,
  TirePosition,
} from '@/types/tires'
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  GripVertical,
  Hand,
  Loader2,
  Package,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TIRE_DRAG = 'tire'
const POSITION_DROP = 'position'

function tireDragId(tireId: string) {
  return `${TIRE_DRAG}:${tireId}`
}

function positionDropId(code: string) {
  return `${POSITION_DROP}:${code}`
}

function parseDragTireId(id: string | number | undefined): string | null {
  if (typeof id !== 'string' || !id.startsWith(`${TIRE_DRAG}:`)) return null
  return id.slice(TIRE_DRAG.length + 1)
}

function parseDropPositionCode(id: string | number | undefined): string | null {
  if (typeof id !== 'string' || !id.startsWith(`${POSITION_DROP}:`)) return null
  return id.slice(POSITION_DROP.length + 1)
}

function normalizeSize(size: string): string {
  return size.replace(/\s+/g, '').toUpperCase()
}

function tireLabel(tire: Tire): string {
  return tire.internal_code || tire.serial_number || `${tire.brand} ${tire.size}`
}

interface AssetTireApiResponse {
  installations?: AssetTireInstallation[]
  layout?: ResolvedTireLayout
  coverage?: { mounted: number; total: number; pct: number }
  asset?: { name?: string }
}

interface BulkMountPageProps {
  initialAssetId?: string | null
}

export function BulkMountPage({ initialAssetId }: BulkMountPageProps) {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [assetLoading, setAssetLoading] = useState(false)
  const [mounting, setMounting] = useState(false)
  const [coverageRows, setCoverageRows] = useState<AssetCoverageRow[]>([])
  const [warehouseTires, setWarehouseTires] = useState<Tire[]>([])
  const [selectedAssetId, setSelectedAssetId] = useState<string>(initialAssetId ?? '')
  const [installations, setInstallations] = useState<AssetTireInstallation[]>([])
  const [layoutPositions, setLayoutPositions] = useState<TirePosition[]>(DEFAULT_TIRE_POSITIONS)
  const [templateKey, setTemplateKey] = useState<TireLayoutTemplateKey>('truck_6x4')
  const [assetCoverage, setAssetCoverage] = useState({ mounted: 0, total: 0, pct: 0 })
  const [assetName, setAssetName] = useState('')
  const [activeDragTire, setActiveDragTire] = useState<Tire | null>(null)
  const [dragOverCode, setDragOverCode] = useState<string | null>(null)
  const [invalidDropCode, setInvalidDropCode] = useState<string | null>(null)
  const [selectedTireId, setSelectedTireId] = useState<string | null>(null)
  const [sizeFilter, setSizeFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [recentlyMounted, setRecentlyMounted] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const fleetProgress = useMemo(() => {
    const total = coverageRows.reduce((sum, r) => sum + r.total_positions, 0)
    const mounted = coverageRows.reduce((sum, r) => sum + r.mounted_count, 0)
    return { total, mounted, pct: total > 0 ? Math.round((mounted / total) * 100) : 0 }
  }, [coverageRows])

  const assetOptions = useMemo(
    () =>
      coverageRows.filter(
        (r) => r.has_layout && r.total_positions > 0 && r.mounted_count < r.total_positions
      ),
    [coverageRows]
  )

  const occupiedCodes = useMemo(
    () =>
      new Set(
        installations.filter((i) => !i.removed_at).map((i) => i.position_code)
      ),
    [installations]
  )

  const mountedTireIds = useMemo(
    () =>
      new Set(
        installations.filter((i) => !i.removed_at).map((i) => i.tire_id)
      ),
    [installations]
  )

  const availableTires = useMemo(() => {
    const q = query.trim().toLowerCase()
    return warehouseTires.filter((t) => {
      if (mountedTireIds.has(t.id)) return false
      if (sizeFilter !== 'all' && normalizeSize(t.size) !== normalizeSize(sizeFilter)) {
        return false
      }
      if (q) {
        const haystack = [t.brand, t.model, t.size, t.serial_number, t.internal_code]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [warehouseTires, mountedTireIds, sizeFilter, query])

  const emptyPositionCodes = useMemo(
    () => layoutPositions.filter((p) => !occupiedCodes.has(p.code)).map((p) => p.code),
    [layoutPositions, occupiedCodes]
  )

  const sizeOptions = useMemo(() => {
    const sizes = new Set(warehouseTires.map((t) => t.size))
    return Array.from(sizes).sort()
  }, [warehouseTires])

  const loadBase = useCallback(async () => {
    setLoading(true)
    try {
      const [coverageRes, tiresRes] = await Promise.all([
        fetch('/api/tires/coverage?status=partial'),
        fetch('/api/tires?status=en_almacen'),
      ])
      const coverageData = await coverageRes.json()
      const tiresData = await tiresRes.json()
      if (coverageRes.ok) {
        setCoverageRows(coverageData.coverage ?? [])
      }
      if (tiresRes.ok) {
        setWarehouseTires(tiresData.tires ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAsset = useCallback(async (assetId: string) => {
    if (!assetId) return
    setAssetLoading(true)
    try {
      const res = await fetch(`/api/assets/${assetId}/tires`)
      const data = (await res.json()) as AssetTireApiResponse
      if (res.ok) {
        setInstallations(data.installations ?? [])
        setLayoutPositions(data.layout?.positions ?? DEFAULT_TIRE_POSITIONS)
        setTemplateKey(data.layout?.template_key ?? 'truck_6x4')
        setAssetCoverage(data.coverage ?? { mounted: 0, total: 0, pct: 0 })
        setAssetName(data.asset?.name ?? '')
      }
    } finally {
      setAssetLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBase()
  }, [loadBase])

  useEffect(() => {
    if (selectedAssetId) {
      loadAsset(selectedAssetId)
    }
  }, [selectedAssetId, loadAsset])

  useEffect(() => {
    if (!selectedAssetId && assetOptions.length > 0) {
      setSelectedAssetId(assetOptions[0].asset_id)
    }
  }, [assetOptions, selectedAssetId])

  const canMountAt = useCallback(
    (positionCode: string, tireId: string) => {
      if (occupiedCodes.has(positionCode)) return false
      if (mountedTireIds.has(tireId)) return false
      return layoutPositions.some((p) => p.code === positionCode)
    },
    [occupiedCodes, mountedTireIds, layoutPositions]
  )

  const mountTire = useCallback(
    async (tireId: string, position: TirePosition) => {
      if (!selectedAssetId || mounting) return
      if (!canMountAt(position.code, tireId)) {
        toast.error('No se puede montar en esa posición')
        return
      }

      const tire = warehouseTires.find((t) => t.id === tireId)
      if (!tire) return

      const optimistic: AssetTireInstallation = {
        id: `temp-${tireId}-${position.code}`,
        tire_id: tireId,
        asset_id: selectedAssetId,
        position_code: position.code,
        position_label: position.label,
        axle_number: position.axle,
        installed_at: new Date().toISOString(),
        removed_at: null,
        km_at_install: null,
        hours_at_install: null,
        km_at_remove: null,
        hours_at_remove: null,
        installed_by: null,
        work_order_id: null,
        notes: null,
        created_at: new Date().toISOString(),
        tire,
      }

      setMounting(true)
      setInstallations((prev) => [...prev, optimistic])
      setSelectedTireId(null)

      try {
        const res = await fetch(`/api/assets/${selectedAssetId}/tires`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tire_id: tireId,
            position_code: position.code,
            position_label: position.label,
            axle_number: position.axle,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al montar')

        toast.success(`Montada en ${position.label}`)
        setRecentlyMounted(position.code)
        setTimeout(() => setRecentlyMounted((prev) => (prev === position.code ? null : prev)), 600)
        await loadAsset(selectedAssetId)
        await loadBase()
      } catch (e) {
        setInstallations((prev) => prev.filter((i) => i.id !== optimistic.id))
        toast.error(e instanceof Error ? e.message : 'Error al montar')
      } finally {
        setMounting(false)
      }
    },
    [selectedAssetId, mounting, canMountAt, warehouseTires, loadAsset, loadBase]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const tireId = parseDragTireId(event.active.id)
    if (!tireId) return
    const tire = warehouseTires.find((t) => t.id === tireId) ?? null
    setActiveDragTire(tire)
  }

  const handleDragOver = (event: { over: { id: string | number } | null; active: { id: string | number } }) => {
    const tireId = parseDragTireId(event.active.id)
    const positionCode = parseDropPositionCode(event.over?.id)
    if (!tireId || !positionCode) {
      setDragOverCode(null)
      setInvalidDropCode(null)
      return
    }
    if (!canMountAt(positionCode, tireId)) {
      setDragOverCode(null)
      setInvalidDropCode(positionCode)
      return
    }
    setInvalidDropCode(null)
    setDragOverCode(positionCode)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const tireId = parseDragTireId(event.active.id)
    const positionCode = parseDropPositionCode(event.over?.id)
    setActiveDragTire(null)
    setDragOverCode(null)
    setInvalidDropCode(null)

    if (!tireId || !positionCode) return
    const position = layoutPositions.find((p) => p.code === positionCode)
    if (!position) return
    void mountTire(tireId, position)
  }

  const diagramGeometry = useMemo(
    () => getDiagramGeometry(templateKey, layoutPositions),
    [templateKey, layoutPositions]
  )

  const handlePositionClick = (position: TirePosition, installation?: AssetTireInstallation) => {
    if (installation || !selectedTireId) return
    void mountTire(selectedTireId, position)
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Montaje masivo"
        text="Arrastre llantas del almacén a las posiciones del diagrama. En móvil: seleccione llanta y toque posición."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/activos/llantas">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Inventario
          </Link>
        </Button>
      </DashboardHeader>

      <Card className="mb-4 overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <ProgressRing pct={fleetProgress.pct} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">Cobertura de flota</span>
                <span className="text-sm tabular-num text-muted-foreground">
                  <span className="font-semibold text-foreground">{fleetProgress.mounted}</span>
                  {' / '}
                  {fleetProgress.total} posiciones
                </span>
              </div>
              <Progress value={fleetProgress.pct} className="h-2.5" />
              <p className="text-xs text-muted-foreground">
                {fleetProgress.total - fleetProgress.mounted} posiciones pendientes en{' '}
                {assetOptions.length} activo{assetOptions.length === 1 ? '' : 's'}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-[480px]" />
          <Skeleton className="h-[480px]" />
        </div>
      ) : assetOptions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay activos con montaje pendiente. Todos tienen cobertura completa o falta
            configurar layouts.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 space-y-1">
              <label className="text-sm font-medium" htmlFor="asset-select">
                Activo
              </label>
              <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                <SelectTrigger id="asset-select">
                  <SelectValue placeholder="Seleccione activo" />
                </SelectTrigger>
                <SelectContent>
                  {assetOptions.map((row) => (
                    <SelectItem key={row.asset_id} value={row.asset_id}>
                      {row.asset_name} ({row.mounted_count}/{row.total_positions})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedAssetId && (
              <Badge variant="outline">
                {assetName}: {assetCoverage.mounted}/{assetCoverage.total} posiciones
              </Badge>
            )}
          </div>

          {selectedTireId && (
            <Alert className="mb-4 border-primary/40 bg-primary/5">
              <Hand className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                Llanta seleccionada —{' '}
                {isMobile
                  ? 'toque una posición resaltada en el diagrama.'
                  : 'arrástrela al diagrama o haga clic en una posición resaltada.'}
              </AlertDescription>
            </Alert>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <Card className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Almacén
                    </span>
                    <Badge variant="secondary" className="tabular-num">
                      {availableTires.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1.5">
                    {isMobile ? (
                      <>
                        <Hand className="h-3.5 w-3.5" />
                        Toque una llanta y luego una posición vacía.
                      </>
                    ) : (
                      <>
                        <GripVertical className="h-3.5 w-3.5" />
                        Arrastre una llanta hacia el diagrama.
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar marca, DOT, ID…"
                      className="pl-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="size-filter">
                      Filtrar por medida
                    </label>
                    <Select value={sizeFilter} onValueChange={setSizeFilter}>
                      <SelectTrigger id="size-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las medidas</SelectItem>
                        {sizeOptions.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="max-h-[520px] flex-1 space-y-2 overflow-y-auto pr-1">
                    {availableTires.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10 text-center">
                        <Package className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          {query || sizeFilter !== 'all'
                            ? 'Ninguna llanta coincide con el filtro.'
                            : 'No hay llantas disponibles en almacén.'}
                        </p>
                      </div>
                    ) : (
                      availableTires.map((tire) =>
                        isMobile ? (
                          <WarehouseTireCard
                            key={tire.id}
                            tire={tire}
                            selected={selectedTireId === tire.id}
                            onSelect={() =>
                              setSelectedTireId((prev) => (prev === tire.id ? null : tire.id))
                            }
                          />
                        ) : (
                          <DraggableWarehouseTireCard
                            key={tire.id}
                            tire={tire}
                            selected={selectedTireId === tire.id}
                            onSelect={() =>
                              setSelectedTireId((prev) => (prev === tire.id ? null : tire.id))
                            }
                          />
                        )
                      )
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CircleDot className="h-4 w-4" />
                    Diagrama — {assetName || 'Activo'}
                  </CardTitle>
                  <CardDescription>
                    Posiciones vacías aceptan montaje. Use teclado: seleccione llanta + clic en posición.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {assetLoading ? (
                    <div className="flex justify-center py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="relative mx-auto max-w-lg">
                      <TireDiagramSvg
                        templateKey={templateKey}
                        positions={layoutPositions}
                        activeInstallations={installations.filter((i) => !i.removed_at)}
                        dragOverPositionCode={dragOverCode}
                        invalidDropPositionCode={invalidDropCode}
                        availablePositionCodes={
                          selectedTireId || activeDragTire ? emptyPositionCodes : undefined
                        }
                        recentlyMountedCode={recentlyMounted}
                        onPositionClick={handlePositionClick}
                      />
                      {!isMobile &&
                        diagramGeometry.tires.map((tireGeom) => {
                          const pos = layoutPositions.find((p) => p.code === tireGeom.code)
                          if (!pos) return null
                          const vb = diagramGeometry.viewBox.split(' ').map(Number)
                          const vbW = vb[2] ?? 400
                          const vbH = vb[3] ?? 450
                          const leftPct = (tireGeom.cx / vbW) * 100
                          const topPct = (tireGeom.cy / vbH) * 100
                          const sizePct = ((tireGeom.r * 2.2) / vbW) * 100
                          return (
                            <DiagramDropZone
                              key={tireGeom.code}
                              position={pos}
                              occupied={occupiedCodes.has(pos.code)}
                              leftPct={leftPct}
                              topPct={topPct}
                              sizePct={sizePct}
                            />
                          )
                        })}
                    </div>
                  )}
                  {mounting && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Montando llanta…
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {!isMobile && (
              <DragOverlay dropAnimation={null}>
                {activeDragTire ? (
                  <div className="flex w-56 -rotate-2 items-start gap-2 rounded-xl border bg-card px-3 py-2.5 shadow-2xl ring-2 ring-primary/40">
                    <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {activeDragTire.brand}
                        {activeDragTire.model ? ` ${activeDragTire.model}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{activeDragTire.size}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {tireLabel(activeDragTire)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            )}
          </DndContext>
        </>
      )}
    </DashboardShell>
  )
}

function TireCardBody({ tire, selected }: { tire: Tire; selected?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-medium">
          {tire.brand}
          {tire.model ? <span className="text-muted-foreground"> {tire.model}</span> : null}
        </p>
        {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-normal">
          {tire.size}
        </Badge>
        <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal capitalize">
          {tire.condition}
        </Badge>
      </div>
      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{tireLabel(tire)}</p>
    </div>
  )
}

function WarehouseTireCard({
  tire,
  selected,
  onSelect,
}: {
  tire: Tire
  selected?: boolean
  onSelect?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-2 rounded-lg border bg-card p-3 text-left transition-all hover:bg-muted/50 active:scale-[0.99]',
        selected && 'border-primary bg-primary/5 ring-2 ring-primary/30'
      )}
    >
      <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <TireCardBody tire={tire} selected={selected} />
    </button>
  )
}

function DraggableWarehouseTireCard({
  tire,
  selected,
  onSelect,
}: {
  tire: Tire
  selected?: boolean
  onSelect?: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: tireDragId(tire.id),
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.()
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={cn(
        'flex cursor-grab items-start gap-2 rounded-lg border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-sm active:cursor-grabbing',
        isDragging && 'opacity-40',
        selected && 'border-primary bg-primary/5 ring-2 ring-primary/30'
      )}
    >
      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <TireCardBody tire={tire} selected={selected} />
    </div>
  )
}

function ProgressRing({ pct, size = 64 }: { pct: number; size?: number }) {
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c
  const tone =
    pct >= 80 ? 'hsl(var(--tire-ok))' : pct >= 40 ? 'hsl(var(--tire-warning))' : 'hsl(var(--primary))'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-num">
        {pct}%
      </span>
    </div>
  )
}

function DiagramDropZone({
  position,
  occupied,
  leftPct,
  topPct,
  sizePct,
}: {
  position: TirePosition
  occupied: boolean
  leftPct: number
  topPct: number
  sizePct: number
}) {
  const { setNodeRef } = useDroppable({
    id: positionDropId(position.code),
    disabled: occupied,
  })

  return (
    <div
      ref={setNodeRef}
      className="absolute rounded-full"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${sizePct}%`,
        aspectRatio: '1',
        transform: 'translate(-50%, -50%)',
      }}
      aria-hidden
    />
  )
}
