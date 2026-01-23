"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { StockWithDetails } from "@/types/inventory"
import { toast } from "sonner"
import { ArrowRightLeft } from "lucide-react"

interface TransferInventoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stock: StockWithDetails
  warehouses: Array<{ id: string; name: string }>
  onSuccess: () => void
}

export function TransferInventoryDialog({
  open,
  onOpenChange,
  stock,
  warehouses,
  onSuccess
}: TransferInventoryDialogProps) {
  const [toWarehouseId, setToWarehouseId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  const available = stock.current_quantity - stock.reserved_quantity

  const handleSubmit = async () => {
    if (!toWarehouseId) {
      toast.error('Debes seleccionar un almacén destino')
      return
    }

    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }

    if (qty > available) {
      toast.error(`Solo hay ${available} unidades disponibles (${stock.reserved_quantity} reservadas)`)
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/inventory/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part_id: stock.part_id,
          from_warehouse_id: stock.warehouse_id,
          to_warehouse_id: toWarehouseId,
          quantity: qty,
          transfer_date: new Date().toISOString(),
          notes: notes || undefined
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success(`${qty} unidades transferidas exitosamente`)
        onSuccess()
        onOpenChange(false)
        resetForm()
      } else {
        toast.error(result.error || 'Error al transferir stock')
      }
    } catch (error) {
      console.error('Error transferring stock:', error)
      toast.error('Error al transferir stock')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setToWarehouseId("")
    setQuantity("")
    setNotes("")
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm()
      onOpenChange(isOpen)
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir Stock</DialogTitle>
          <DialogDescription>
            Transfiere stock entre almacenes
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Parte</Label>
            <Input value={stock.part?.name || 'N/A'} disabled />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Desde Almacén</Label>
              <Input value={stock.warehouse?.name || 'N/A'} disabled />
            </div>
            <div className="space-y-2">
              <Label>Hacia Almacén *</Label>
              <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar almacén destino" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Stock Actual</Label>
              <Input value={stock.current_quantity} disabled />
            </div>
            <div className="space-y-2">
              <Label>Disponible (no reservado)</Label>
              <Input value={available} disabled />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cantidad a Transferir *</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0.01"
              max={available}
              step="0.01"
              placeholder={`Máximo: ${available}`}
            />
            <p className="text-sm text-muted-foreground">
              Máximo disponible: {available} unidades
            </p>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Razón de la transferencia..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm() }}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !toWarehouseId || !quantity}>
            {loading ? 'Transferiendo...' : 'Confirmar Transferencia'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
