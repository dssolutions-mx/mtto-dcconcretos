'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AssetTireInstallation, TirePosition } from '@/types/tires'

interface RotationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: string
  installation: AssetTireInstallation | null
  positions: TirePosition[]
  occupiedPositions: string[]
  workOrderId?: string | null
  onRotated: () => void
}

export function RotationDialog({
  open,
  onOpenChange,
  assetId,
  installation,
  positions,
  occupiedPositions,
  workOrderId,
  onRotated,
}: RotationDialogProps) {
  const [loading, setLoading] = useState(false)
  const [toCode, setToCode] = useState('')
  const [notes, setNotes] = useState('')

  const available = positions.filter(
    (p) =>
      p.code !== installation?.position_code && !occupiedPositions.includes(p.code)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!installation || !toCode) return

    const target = positions.find((p) => p.code === toCode)
    if (!target) return

    setLoading(true)
    try {
      const res = await fetch(`/api/assets/${assetId}/tires`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rotate',
          installation_id: installation.id,
          to_position_code: target.code,
          to_position_label: target.label,
          to_axle_number: target.axle,
          notes,
          work_order_id: workOrderId ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al rotar')

      toast.success(`Llanta rotada a ${target.label}`)
      setToCode('')
      setNotes('')
      onOpenChange(false)
      onRotated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al rotar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rotar llanta</DialogTitle>
          <DialogDescription>
            {installation
              ? `Mover de ${installation.position_label} a otra posición del mismo activo.`
              : 'Seleccione una llanta montada.'}
          </DialogDescription>
        </DialogHeader>

        {installation && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Llanta</Label>
              <p className="text-sm font-medium">
                {installation.tire
                  ? `${installation.tire.brand} ${installation.tire.size}`
                  : '—'}
              </p>
            </div>

            <div className="space-y-1">
              <Label>Posición actual</Label>
              <p className="text-sm">{installation.position_label}</p>
            </div>

            <div className="space-y-1">
              <Label>Posición destino</Label>
              <Select value={toCode} onValueChange={setToCode} required>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar posición vacía" />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No hay posiciones vacías
                    </SelectItem>
                  ) : (
                    available.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="rotate-notes">Notas</Label>
              <Textarea
                id="rotate-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Motivo de rotación (opcional)"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !toCode || available.length === 0}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar rotación
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
