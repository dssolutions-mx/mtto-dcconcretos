"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Save, X, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

interface TransactionEditModalProps {
  transaction: {
    id: string
    transaction_id: string
    transaction_type: string
    quantity_liters: number
    transaction_date: string
    notes: string | null
    previous_balance: number | null
    current_balance: number | null
    cuenta_litros: number | null
    unit_cost?: number | null
    total_cost?: number | null
    supplier_responsible?: string | null
  } | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  isLatestTransaction?: boolean
  warehouseHasMeter?: boolean
}

export function TransactionEditModal({
  transaction,
  isOpen,
  onClose,
  onSuccess,
  isLatestTransaction = false,
  warehouseHasMeter = false
}: TransactionEditModalProps) {
  const [loading, setLoading] = useState(false)
  const [transactionDate, setTransactionDate] = useState("")
  const [transactionTime, setTransactionTime] = useState("")
  const [quantityLiters, setQuantityLiters] = useState("")
  const [cuentaLitros, setCuentaLitros] = useState("")
  const [showQuantityWarning, setShowQuantityWarning] = useState(false)
  // Entry-specific fields
  const [supplierName, setSupplierName] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [notes, setNotes] = useState("")

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Initialize form when transaction changes
  useEffect(() => {
    if (transaction) {
      // Parse UTC timestamp and convert to local timezone for display
      const utcDate = new Date(transaction.transaction_date)
      
      // Get local date components
      const year = utcDate.getFullYear()
      const month = String(utcDate.getMonth() + 1).padStart(2, '0')
      const day = String(utcDate.getDate()).padStart(2, '0')
      const hours = String(utcDate.getHours()).padStart(2, '0')
      const minutes = String(utcDate.getMinutes()).padStart(2, '0')
      
      setTransactionDate(`${year}-${month}-${day}`)
      setTransactionTime(`${hours}:${minutes}`)
      setQuantityLiters(transaction.quantity_liters.toString())
      setCuentaLitros(transaction.cuenta_litros?.toString() || "")
      setShowQuantityWarning(false)
      // Initialize entry fields from transaction notes pattern when type is entry
      if (transaction.transaction_type === 'entry') {
        const rawNotes = transaction.notes || ""
        setNotes(rawNotes.replace(/^Factura:\s*[^|]+\s*\|?\s*/i, '').trim())
        const match = rawNotes.match(/Factura:\s*([^|]+)/i)
        setInvoiceNumber(match ? match[1].trim() : "")
        // Initialize unit cost and supplier from transaction data
        setUnitCost(transaction.unit_cost?.toString() || "")
        setSupplierName(transaction.supplier_responsible || "")
      } else {
        setNotes(transaction.notes || "")
        setInvoiceNumber("")
        setSupplierName("")
        setUnitCost("")
      }
    }
  }, [transaction])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!transaction) return

    try {
      setLoading(true)

      // Validate inputs
      if (!transactionDate || !transactionTime || !quantityLiters) {
        toast.error("Por favor completa todos los campos requeridos")
        return
      }

      const newQuantity = parseFloat(quantityLiters)
      if (isNaN(newQuantity) || newQuantity < 0) {
        toast.error("La cantidad debe ser un número válido mayor o igual a 0")
        return
      }

      // Validate cuenta litros if provided and warehouse has meter
      let newCuentaLitros: number | null = null
      if (warehouseHasMeter && cuentaLitros.trim()) {
        newCuentaLitros = parseFloat(cuentaLitros)
        if (isNaN(newCuentaLitros) || newCuentaLitros < 0) {
          toast.error("La cuenta litros debe ser un número válido mayor o igual a 0")
          return
        }
        
        // Note: We can't validate against previous reading without additional query
        // This validation would need to be done in the database function
      }

      // Check if quantity changed
      const quantityChanged = Math.abs(newQuantity - transaction.quantity_liters) > 0.01
      
      if (quantityChanged && !showQuantityWarning) {
        setShowQuantityWarning(true)
        toast.warning("Cambiar la cantidad afectará todas las transacciones posteriores. Confirma para continuar.")
        return
      }

      // Convert local date/time back to UTC for storage
      const [year, month, day] = transactionDate.split('-').map(Number)
      const [hours, minutes] = transactionTime.split(':').map(Number)
      
      // Create local date and convert to UTC ISO string
      const localDate = new Date(year, month - 1, day, hours, minutes, 0)
      const newDateTime = localDate.toISOString()

      // Call API to update transaction with recalculation
      const { data, error } = await supabase.rpc('update_transaction_with_recalculation', {
        p_transaction_id: transaction.id,
        p_new_quantity: newQuantity,
        p_new_date: newDateTime,
        p_new_cuenta_litros: newCuentaLitros
      })

      if (error) {
        console.error('Error updating transaction:', error)
        toast.error("Error al actualizar la transacción")
        return
      }

      // Check if the RPC returned an error
      if (data && typeof data === 'object' && 'error' in data) {
        console.error('RPC returned error:', data.error)
        toast.error(`Error: ${data.error}`)
        return
      }

      // If entry transaction: update additional fields and notes
      if (transaction.transaction_type === 'entry') {
        const updates: any = {}
        if (unitCost.trim()) updates.unit_cost = parseFloat(unitCost)
        if (unitCost.trim() && quantityLiters.trim()) updates.total_cost = parseFloat(unitCost) * parseFloat(quantityLiters)
        if (supplierName.trim()) updates.supplier_responsible = supplierName.trim()
        // Rebuild notes with optional invoice prefix
        const cleanNotes = notes.trim()
        const finalNotes = invoiceNumber.trim() ? `Factura: ${invoiceNumber.trim()}${cleanNotes ? ' | ' + cleanNotes : ''}` : (cleanNotes || null)
        updates.notes = finalNotes

        const { error: updErr } = await supabase
          .from('diesel_transactions')
          .update(updates)
          .eq('id', transaction.id)

        if (updErr) {
          console.error('Error updating extra fields:', updErr)
          toast.error('Error al guardar proveedor/costos/notas')
          return
        }
      }

      console.log('Transaction update result:', data)
      toast.success("Transacción actualizada correctamente. Balance recalculado.")
      onSuccess()
      onClose()

    } catch (error) {
      console.error('Error updating transaction:', error)
      toast.error("Error al actualizar la transacción")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  if (!transaction) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Editar Transacción
          </DialogTitle>
          <DialogDescription>
            Modifica la fecha, hora y cantidad de la transacción {transaction.transaction_id}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Info */}
          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <div className="text-sm">
              <span className="font-medium">Tipo:</span> {transaction.transaction_type}
            </div>
            <div className="text-sm">
              <span className="font-medium">Balance Anterior:</span> {transaction.previous_balance?.toFixed(1) || 'N/A'}L
            </div>
            <div className="text-sm">
              <span className="font-medium">Balance Actual:</span> {transaction.current_balance?.toFixed(1) || 'N/A'}L
            </div>
            {warehouseHasMeter && (
              <div className="text-sm">
                <span className="font-medium">Cuenta Litros:</span> {transaction.cuenta_litros?.toFixed(0) || 'N/A'}
              </div>
            )}
            {transaction.notes && (
              <div className="text-sm">
                <span className="font-medium">Notas:</span> {transaction.notes}
              </div>
            )}
          </div>

          {/* Quantity Warning */}
          {showQuantityWarning && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium">⚠️ Advertencia</p>
                  <p>Cambiar la cantidad afectará todas las transacciones posteriores y recalculará los balances. Esta acción no se puede deshacer.</p>
                </div>
              </div>
            </div>
          )}

          {/* Date Input */}
          <div className="space-y-2">
            <Label htmlFor="transactionDate">Fecha *</Label>
            <Input
              id="transactionDate"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Time Input */}
          <div className="space-y-2">
            <Label htmlFor="transactionTime">Hora *</Label>
            <Input
              id="transactionTime"
              type="time"
              value={transactionTime}
              onChange={(e) => setTransactionTime(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <Label htmlFor="quantityLiters">Cantidad (Litros) *</Label>
            <Input
              id="quantityLiters"
              type="number"
              step="0.1"
              min="0"
              value={quantityLiters}
              onChange={(e) => {
                setQuantityLiters(e.target.value)
                setShowQuantityWarning(false) // Reset warning when user changes quantity
              }}
              required
              disabled={loading}
              placeholder="0.0"
            />
            <p className="text-xs text-muted-foreground">
              Cambiar la cantidad recalculará todas las transacciones posteriores
            </p>
          </div>

          {/* Cuenta Litros Input - Only for latest transaction and warehouses with meter */}
          {isLatestTransaction && warehouseHasMeter && (
            <div className="space-y-2">
              <Label htmlFor="cuentaLitros">Cuenta Litros</Label>
              <Input
                id="cuentaLitros"
                type="number"
                step="1"
                min="0"
                value={cuentaLitros}
                onChange={(e) => setCuentaLitros(e.target.value)}
                disabled={loading}
                placeholder="Ej: 150000"
              />
              <p className="text-xs text-muted-foreground">
                Solo se puede editar en la transacción más reciente.
              </p>
            </div>
          )}

          {/* Entry-specific fields */}
          {transaction.transaction_type === 'entry' && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="supplierName">Proveedor / Responsable</Label>
                <Input
                  id="supplierName"
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  disabled={loading}
                  placeholder="Ej: Gasolinera Shell"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitCost">Costo por Litro (sin IVA)</Label>
                <Input
                  id="unitCost"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  disabled={loading}
                  placeholder="Ej: 23.50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">Número de Factura (Opcional)</Label>
                <Input
                  id="invoiceNumber"
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  disabled={loading}
                  placeholder="Ej: F-2025-001234"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas (Opcional)</Label>
                <Input
                  id="notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                  placeholder="Observaciones..."
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              variant={showQuantityWarning ? "destructive" : "default"}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {showQuantityWarning ? "Confirmar Cambios" : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
