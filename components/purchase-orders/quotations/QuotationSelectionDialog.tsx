"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PurchaseOrderQuotation, QuotationComparison } from "@/types/purchase-orders"
import { AlertCircle, CheckCircle2, DollarSign, Clock } from "lucide-react"
import { toast } from "sonner"

interface QuotationSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quotation: PurchaseOrderQuotation
  comparison: QuotationComparison
  onConfirm: (quotationId: string, reason: string) => Promise<void>
}

export function QuotationSelectionDialog({
  open,
  onOpenChange,
  quotation,
  comparison,
  onConfirm
}: QuotationSelectionDialogProps) {
  const [selectionReason, setSelectionReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!selectionReason.trim()) {
      setError("La razón de selección es requerida")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onConfirm(quotation.id, selectionReason)
      toast.success("Cotización seleccionada exitosamente")
      setSelectionReason("")
      onOpenChange(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al seleccionar cotización"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate comparison stats
  const otherQuotations = comparison.quotations.filter(q => q.id !== quotation.id)
  const priceDifference = otherQuotations.length > 0
    ? otherQuotations
        .map(q => quotation.quoted_amount - q.quoted_amount)
        .reduce((min, diff) => Math.abs(diff) < Math.abs(min) ? diff : min)
    : 0

  const isLowestPrice = quotation.quoted_amount === comparison.summary.lowest_price
  const isFastestDelivery = quotation.delivery_days === comparison.summary.fastest_delivery

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirmar Selección de Proveedor</DialogTitle>
          <DialogDescription>
            Está a punto de seleccionar esta cotización como proveedor ganador
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected Quotation Summary */}
          <div className="p-4 border rounded-lg bg-green-50 border-green-200">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{quotation.supplier_name}</h3>
                {quotation.supplier?.business_name && (
                  <p className="text-sm text-muted-foreground">{quotation.supplier.business_name}</p>
                )}
              </div>
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Monto Cotizado</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-bold">
                    ${quotation.quoted_amount.toLocaleString('es-MX', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                  {isLowestPrice && (
                    <span className="px-2 py-1 text-xs bg-green-600 text-white rounded">
                      Mejor Precio
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Tiempo de Entrega</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-medium">
                    {quotation.delivery_days ? `${quotation.delivery_days} días` : 'N/A'}
                  </span>
                  {isFastestDelivery && quotation.delivery_days && (
                    <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded">
                      Más Rápido
                    </span>
                  )}
                </div>
              </div>
            </div>

            {quotation.payment_terms && (
              <div className="mt-3">
                <span className="text-sm text-muted-foreground">Condiciones: </span>
                <span className="text-sm font-medium">{quotation.payment_terms}</span>
              </div>
            )}
          </div>

          {/* Comparison Summary */}
          {comparison.quotations.length > 1 && (
            <div className="p-3 border rounded-lg bg-muted/30">
              <p className="text-sm font-medium mb-2">Comparación con otras cotizaciones:</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total comparadas: </span>
                  <span className="font-medium">{comparison.summary.total_quotations}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Diferencia precio: </span>
                  <span className={`font-medium ${priceDifference < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {priceDifference < 0 
                      ? `$${Math.abs(priceDifference).toLocaleString('es-MX')} más bajo`
                      : priceDifference > 0
                      ? `$${priceDifference.toLocaleString('es-MX')} más alto`
                      : 'Mismo precio'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Precio promedio: </span>
                  <span className="font-medium">
                    ${comparison.summary.average_price.toLocaleString('es-MX', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Selection Reason */}
          <div className="space-y-2">
            <Label htmlFor="selection_reason">
              Razón de Selección * <span className="text-muted-foreground text-xs">(requerido)</span>
            </Label>
            <Textarea
              id="selection_reason"
              value={selectionReason}
              onChange={(e) => {
                setSelectionReason(e.target.value)
                setError(null)
              }}
              placeholder="Explique por qué se seleccionó este proveedor sobre los demás. Considere precio, tiempo de entrega, calidad, historial, etc."
              rows={4}
              className={error ? "border-red-500" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Esta información será visible en el proceso de aprobación y quedará registrada en el historial.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Warning */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Una vez confirmada la selección, la orden pasará a "Pendiente de Aprobación" y se notificará al aprobador.
              No podrá cambiar la selección sin rechazar y recrear la orden.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              setSelectionReason("")
              setError(null)
            }}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectionReason.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? "Confirmando..." : "Confirmar Selección"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
