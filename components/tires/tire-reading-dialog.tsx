"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"

interface TireReadingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: string
  installationId: string
  positionLabel: string
  minTreadMm: number
  onSaved: () => void
}

export function TireReadingDialog({
  open,
  onOpenChange,
  assetId,
  installationId,
  positionLabel,
  minTreadMm,
  onSaved,
}: TireReadingDialogProps) {
  const [loading, setLoading] = useState(false)
  const [treadDepth, setTreadDepth] = useState("")
  const [pressure, setPressure] = useState("")
  const [notes, setNotes] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/assets/${assetId}/tires`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reading",
          reading: {
            installation_id: installationId,
            tread_depth_mm: treadDepth ? Number(treadDepth) : undefined,
            pressure_psi: pressure ? Number(pressure) : undefined,
            notes,
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al guardar lectura")
      }
      setTreadDepth("")
      setPressure("")
      setNotes("")
      onOpenChange(false)
      onSaved()
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
          <DialogTitle>Capturar lectura</DialogTitle>
          <DialogDescription>
            {positionLabel} — profundidad de banda y presión.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="tread">Profundidad (mm)</Label>
              <Input
                id="tread"
                type="number"
                min={0}
                max={30}
                step="0.1"
                value={treadDepth}
                onChange={(e) => setTreadDepth(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Umbral mínimo: {minTreadMm} mm</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pressure">Presión (psi)</Label>
              <Input
                id="pressure"
                type="number"
                min={0}
                max={200}
                step="1"
                value={pressure}
                onChange={(e) => setPressure(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="read-notes">Notas</Label>
            <Textarea
              id="read-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar lectura
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
