"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import type { Tire, TirePosition } from "@/types/tires"

interface MountTireDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: string
  workOrderId?: string | null
  positions: TirePosition[]
  occupiedPositions: string[]
  onMounted: () => void
}

export function MountTireDialog({
  open,
  onOpenChange,
  assetId,
  workOrderId,
  positions,
  occupiedPositions,
  onMounted,
}: MountTireDialogProps) {
  const [loading, setLoading] = useState(false)
  const [tires, setTires] = useState<Tire[]>([])
  const [tireId, setTireId] = useState("")
  const [positionCode, setPositionCode] = useState("")
  const [notes, setNotes] = useState("")

  const availablePositions = positions.filter(
    (p) => !occupiedPositions.includes(p.code)
  )

  useEffect(() => {
    if (!open) return
    fetch("/api/tires?status=en_almacen")
      .then((r) => r.json())
      .then((d) => setTires(d.tires ?? []))
      .catch(() => setTires([]))
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const pos = positions.find((p) => p.code === positionCode)
    if (!tireId || !pos) return

    setLoading(true)
    try {
      const res = await fetch(`/api/assets/${assetId}/tires`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tire_id: tireId,
          position_code: pos.code,
          position_label: pos.label,
          axle_number: pos.axle,
          notes,
          work_order_id: workOrderId ?? undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al montar")
      }
      setTireId("")
      setPositionCode("")
      setNotes("")
      onOpenChange(false)
      onMounted()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Montar llanta</DialogTitle>
          <DialogDescription>
            Asignar una llanta del inventario a una posición del activo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
                      {t.brand} {t.size} {t.serial_number ? `(${t.serial_number})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Posición</Label>
            <Select value={positionCode} onValueChange={setPositionCode} required>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar posición" />
              </SelectTrigger>
              <SelectContent>
                {availablePositions.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.label}
                  </SelectItem>
                ))}
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !tireId || !positionCode}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Montar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
