"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Package, CheckCircle2, AlertCircle } from "lucide-react"
import { ReserveInventoryDialog } from "@/components/inventory/reserve-inventory-dialog"
import { Badge } from "@/components/ui/badge"

interface WOInventoryActionsProps {
  workOrderId: string
  inventoryReserved?: boolean
  status?: string
  onSuccess?: () => void
}

export function WOInventoryActions({
  workOrderId,
  inventoryReserved = false,
  status,
  onSuccess
}: WOInventoryActionsProps) {
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false)

  // Only allow reservation for active work orders
  const canReserve = status && !['completed', 'cancelled'].includes(status.toLowerCase())

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {inventoryReserved && (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Partes Reservadas
          </Badge>
        )}
        {canReserve && !inventoryReserved && (
          <Button
            variant="outline"
            onClick={() => setReserveDialogOpen(true)}
          >
            <Package className="mr-2 h-4 w-4" />
            Reservar Partes del Inventario
          </Button>
        )}
        {!canReserve && !inventoryReserved && (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Orden {status === 'completed' ? 'completada' : 'cancelada'}
          </Badge>
        )}
      </div>
      <ReserveInventoryDialog
        workOrderId={workOrderId}
        open={reserveDialogOpen}
        onOpenChange={setReserveDialogOpen}
        onSuccess={() => {
          onSuccess?.()
          setReserveDialogOpen(false)
        }}
      />
    </>
  )
}
