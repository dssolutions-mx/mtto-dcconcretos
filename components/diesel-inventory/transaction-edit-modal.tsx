"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Save, X, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface TransactionEditModalProps {
  transaction: {
    id: string
    transaction_id: string
    transaction_type: string
    quantity_liters: number
    transaction_date: string
    notes: string | null
  } | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function TransactionEditModal({
  transaction,
  isOpen,
  onClose,
  onSuccess
}: TransactionEditModalProps) {
  const [loading, setLoading] = useState(false)
  const [transactionDate, setTransactionDate] = useState("")
  const [transactionTime, setTransactionTime] = useState("")

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Initialize form when transaction changes
  useEffect(() => {
    if (transaction) {
      const date = new Date(transaction.transaction_date)
      setTransactionDate(date.toISOString().split('T')[0])
      setTransactionTime(date.toTimeString().slice(0, 5))
    }
  }, [transaction])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!transaction) return

    try {
      setLoading(true)

      // Validate inputs
      if (!transactionDate || !transactionTime) {
        toast.error("Por favor completa todos los campos")
        return
      }

      // Create new datetime string
      const newDateTime = new Date(transactionDate + 'T' + transactionTime + ':00').toISOString()

      // Update transaction
      const { error } = await supabase
        .from('diesel_transactions')
        .update({
          transaction_date: newDateTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id)

      if (error) {
        console.error('Error updating transaction:', error)
        toast.error("Error al actualizar la transacción")
        return
      }

      toast.success("Fecha de transacción actualizada correctamente")
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Editar Fecha de Transacción
          </DialogTitle>
          <DialogDescription>
            Modifica la fecha y hora de la transacción {transaction.transaction_id}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Info */}
          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <div className="text-sm">
              <span className="font-medium">Tipo:</span> {transaction.transaction_type}
            </div>
            <div className="text-sm">
              <span className="font-medium">Cantidad:</span> {transaction.quantity_liters.toFixed(1)}L
            </div>
            {transaction.notes && (
              <div className="text-sm">
                <span className="font-medium">Notas:</span> {transaction.notes}
              </div>
            )}
          </div>

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
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar Cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
