'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { isPressureOutOfRange, isTreadLow, resolveMinTreadMm } from '@/lib/tires/positions'
import { formatThresholdSummary } from '@/lib/tires/thresholds-ui'
import { formatTirePrimaryId, formatTireSecondaryDot, formatTireSelectOption } from '@/lib/tires/display'
import {
  getTireHealthStatus,
  treadFraction,
  TIRE_STATUS_VISUALS,
  TREAD_WARNING_MARGIN_MM,
} from '@/lib/tires/status'
import { cn } from '@/lib/utils'
import type { AssetTireInstallation, Tire, TirePosition, TireThresholds } from '@/types/tires'

export type TirePositionSheetMode = 'mount' | 'detail'

interface TirePositionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: TirePositionSheetMode
  position: TirePosition | null
  installation?: AssetTireInstallation | null
  assetId: string
  workOrderId?: string | null
  positions: TirePosition[]
  occupiedPositions: string[]
  isMobile?: boolean
  thresholds?: TireThresholds
  onMounted: () => void
  onReading?: (installation: AssetTireInstallation) => void
  onUnmount?: (installationId: string, retire?: boolean) => void
  onRotate?: (installation: AssetTireInstallation) => void
}

export function TirePositionSheet({
  open,
  onOpenChange,
  mode,
  position,
  installation,
  assetId,
  workOrderId,
  positions,
  occupiedPositions,
  isMobile = false,
  thresholds,
  onMounted,
  onReading,
  onUnmount,
  onRotate,
}: TirePositionSheetProps) {
  if (!position) return null

  const title =
    mode === 'mount'
      ? `Montar llanta en ${position.label}`
      : position.label

  const description =
    mode === 'mount'
      ? 'Seleccione una llanta del almacén para esta posición.'
      : installation?.tire
        ? `${installation.tire.brand} ${installation.tire.size}${formatTirePrimaryId(installation.tire) !== `${installation.tire.brand} ${installation.tire.size}` ? ` · ${formatTirePrimaryId(installation.tire)}` : ''}`
        : undefined

  const body =
    mode === 'mount' ? (
      <MountPositionForm
        assetId={assetId}
        workOrderId={workOrderId}
        position={position}
        positions={positions}
        occupiedPositions={occupiedPositions}
        onSuccess={() => {
          onOpenChange(false)
          onMounted()
        }}
        onCancel={() => onOpenChange(false)}
      />
    ) : (
      <DetailPositionPanel
        installation={installation}
        thresholds={thresholds}
        onReading={onReading}
        onUnmount={onUnmount}
        onRotate={onRotate}
        onClose={() => onOpenChange(false)}
      />
    )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{body}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="mt-4">{body}</div>
      </SheetContent>
    </Sheet>
  )
}

interface MountPositionFormProps {
  assetId: string
  workOrderId?: string | null
  position: TirePosition
  positions: TirePosition[]
  occupiedPositions: string[]
  onSuccess: () => void
  onCancel: () => void
}

function MountPositionForm({
  assetId,
  workOrderId,
  position,
  positions,
  occupiedPositions,
  onSuccess,
  onCancel,
}: MountPositionFormProps) {
  const [loading, setLoading] = useState(false)
  const [tires, setTires] = useState<Tire[]>([])
  const [tireId, setTireId] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetch('/api/tires?status=en_almacen')
      .then((r) => r.json())
      .then((d) => setTires(d.tires ?? []))
      .catch(() => setTires([]))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tireId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/assets/${assetId}/tires`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tire_id: tireId,
          position_code: position.code,
          position_label: position.label,
          axle_number: position.axle,
          notes,
          work_order_id: workOrderId ?? undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al montar')
      }
      setTireId('')
      setNotes('')
      onSuccess()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const availablePositions = positions.filter((p) => !occupiedPositions.includes(p.code))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {tires.length === 0 && (
        <Alert>
          <AlertDescription>
            No hay llantas en almacén.{' '}
            <Link href="/activos/llantas" className="underline">
              Ir a inventario
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <Label>Posición</Label>
        <p className="text-sm font-medium">{position.label}</p>
      </div>

      <div className="space-y-1">
        <Label>Llanta (en almacén)</Label>
        <Select value={tireId} onValueChange={setTireId} required>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar llanta" />
          </SelectTrigger>
          <SelectContent>
            {tires.length === 0 ? (
              <SelectItem value="_none" disabled>
                Sin llantas en almacén
              </SelectItem>
            ) : (
              tires.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {formatTireSelectOption(t)}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="mount-notes">Notas</Label>
        <Textarea
          id="mount-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      {workOrderId && (
        <p className="text-xs text-muted-foreground">
          Se vinculará a la OT {workOrderId.slice(0, 8)}…
        </p>
      )}

      <SheetFooter className="flex-row justify-end gap-2 sm:justify-end px-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || !tireId || availablePositions.length === 0}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Montar
        </Button>
      </SheetFooter>
    </form>
  )
}

interface DetailPositionPanelProps {
  installation?: AssetTireInstallation | null
  thresholds?: TireThresholds
  onReading?: (installation: AssetTireInstallation) => void
  onUnmount?: (installationId: string, retire?: boolean) => void
  onRotate?: (installation: AssetTireInstallation) => void
  onClose: () => void
}

function DetailPositionPanel({
  installation,
  thresholds,
  onReading,
  onUnmount,
  onRotate,
  onClose,
}: DetailPositionPanelProps) {
  if (!installation?.tire) {
    return <p className="text-sm text-muted-foreground">Sin datos de llanta.</p>
  }

  const tire = installation.tire
  const reading = installation.latest_reading
  const minTread = resolveMinTreadMm(tire.min_tread_mm, thresholds)
  const treadCritical = isTreadLow(reading?.tread_depth_mm, minTread)
  const treadWarn =
    reading?.tread_depth_mm != null &&
    !treadCritical &&
    reading.tread_depth_mm <= minTread + TREAD_WARNING_MARGIN_MM
  const pressureBad = isPressureOutOfRange(reading?.pressure_psi, thresholds)
  const status = getTireHealthStatus(installation, thresholds)
  const visual = TIRE_STATUS_VISUALS[status]
  const frac = treadFraction(reading?.tread_depth_mm)
  const primaryId = formatTirePrimaryId(tire)
  const dot = formatTireSecondaryDot(tire)
  const thresholdLine = formatThresholdSummary(thresholds, tire.min_tread_mm)

  return (
    <div className="space-y-4">
      {/* Health banner */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
          visual.badgeClass
        )}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: visual.stroke }} />
        {visual.label}
      </div>

      <p className="text-xs text-muted-foreground leading-snug">{thresholdLine}</p>

      <div className="space-y-2">
        <p className="font-mono text-base font-semibold">{primaryId}</p>
        <p className="text-sm text-muted-foreground">
          {tire.brand} {tire.size}
        </p>
        {dot && (
          <p className="font-mono text-xs text-muted-foreground">DOT / serial: {dot}</p>
        )}
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="capitalize">{tire.condition}</Badge>
          {treadCritical && <Badge variant="destructive">Banda crítica</Badge>}
          {treadWarn && <Badge variant="default">Banda baja</Badge>}
          {pressureBad && <Badge variant="destructive">Presión fuera de rango</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <p className="text-muted-foreground">Banda</p>
          <p className="font-medium tabular-num">
            {reading?.tread_depth_mm != null ? `${reading.tread_depth_mm} mm` : '—'}
          </p>
          {frac != null && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${frac * 100}%`, backgroundColor: visual.stroke }}
              />
            </div>
          )}
        </div>
        <div>
          <p className="text-muted-foreground">Presión</p>
          <p className="font-medium tabular-num">
            {reading?.pressure_psi != null ? `${reading.pressure_psi} psi` : '—'}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-muted-foreground">Montada</p>
          <p className="font-medium">
            {format(new Date(installation.installed_at), 'dd MMM yyyy', { locale: es })}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button className="min-h-11" variant="secondary" asChild>
          <Link href={`/activos/llantas/${tire.id}`}>Ver historial de llanta</Link>
        </Button>
        {onReading && (
          <Button className="min-h-11" onClick={() => onReading(installation)}>
            Registrar lectura
          </Button>
        )}
        {onRotate && (
          <Button className="min-h-11" variant="outline" onClick={() => onRotate(installation)}>
            Rotar a…
          </Button>
        )}
        {onUnmount && (
          <>
            <Button
              className="min-h-11"
              variant="outline"
              onClick={() => onUnmount(installation.id)}
            >
              Desmontar
            </Button>
            <Button
              className="min-h-11"
              variant="destructive"
              onClick={() => onUnmount(installation.id, true)}
            >
              Dar de baja
            </Button>
          </>
        )}
        <Button className="min-h-11" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  )
}
