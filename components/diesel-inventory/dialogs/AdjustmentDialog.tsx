"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AdjustmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { warehouseId: string; physicalCount: number; reason: string }) => Promise<void>
}

export function AdjustmentDialog({ open, onOpenChange, onSubmit }: AdjustmentDialogProps) {
  const [warehouseId, setWarehouseId] = useState("")
  const [physicalCount, setPhysicalCount] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await onSubmit({ warehouseId, physicalCount: Number(physicalCount), reason })
      onOpenChange(false)
      setWarehouseId("")
      setPhysicalCount("")
      setReason("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuste de Inventario</DialogTitle>
          <DialogDescription>Registrar conteo físico y ajuste de diesel</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Almacén</Label>
            <Input value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} placeholder="UUID de almacén" />
          </div>
          <div className="space-y-2">
            <Label>Conteo físico (litros)</Label>
            <Input type="number" value={physicalCount} onChange={(e) => setPhysicalCount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Conteo mensual, evaporación, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !warehouseId || !physicalCount}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


