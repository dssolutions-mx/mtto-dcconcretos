"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { StockWithDetails } from "@/types/inventory"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"

interface StockAdjustmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stock: StockWithDetails
  onSuccess: () => void
}

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  stock,
  onSuccess
}: StockAdjustmentDialogProps) {
  const [physicalCount, setPhysicalCount] = useState(stock.current_quantity.toString())
  const [adjustmentReason, setAdjustmentReason] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  const adjustment = parseFloat(physicalCount) - stock.current_quantity
  const isLargeDiscrepancy = Math.abs(adjustment) > (stock.current_quantity * 0.2)

  const handleSubmit = async () => {
    if (!adjustmentReason) {
      toast.error('Debes seleccionar una razón para el ajuste')
      return
    }

    if (parseFloat(physicalCount) < 0) {
      toast.error('La cantidad física no puede ser negativa')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/inventory/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_id: stock.id,
          physical_count: parseFloat(physicalCount),
          adjustment_reason: adjustmentReason,
          adjustment_date: new Date().toISOString(),
          notes: notes || undefined
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success(`Stock ajustado por ${adjustment > 0 ? '+' : ''}${adjustment.toFixed(2)} unidades`)
        onSuccess()
        onOpenChange(false)
        resetForm()
      } else {
        toast.error(result.error || 'Error al ajustar stock')
      }
    } catch (error) {
      console.error('Error adjusting stock:', error)
      toast.error('Error al ajustar stock')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setPhysicalCount(stock.current_quantity.toString())
    setAdjustmentReason("")
    setNotes("")
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm()
      onOpenChange(isOpen)
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar Stock</DialogTitle>
          <DialogDescription>
            Ajusta el stock después de un conteo físico
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cantidad en Sistema</Label>
              <Input value={stock.current_quantity} disabled />
            </div>
            <div className="space-y-2">
              <Label>Cantidad Física *</Label>
              <Input
                type="number"
                value={physicalCount}
                onChange={(e) => setPhysicalCount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ajuste</Label>
            <Input
              value={adjustment > 0 ? `+${adjustment.toFixed(2)}` : adjustment.toFixed(2)}
              disabled
              className={adjustment < 0 ? "text-red-600" : "text-green-600"}
            />
          </div>
          {isLargeDiscrepancy && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Discrepancia grande detectada ({Math.abs(adjustment / stock.current_quantity * 100).toFixed(1)}%). 
                Por favor verifica el conteo físico.
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Razón del Ajuste *</Label>
            <Select value={adjustmentReason} onValueChange={setAdjustmentReason}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar razón" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="physical_count">Conteo Físico</SelectItem>
                <SelectItem value="damage_loss">Daño/Pérdida</SelectItem>
                <SelectItem value="found_stock">Stock Encontrado</SelectItem>
                <SelectItem value="measurement_error">Error de Medición</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales sobre el ajuste..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm() }}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !adjustmentReason}>
            {loading ? 'Guardando...' : 'Confirmar Ajuste'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
