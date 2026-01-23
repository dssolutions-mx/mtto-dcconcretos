"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Package, Warehouse } from "lucide-react"
import { ReceivePODialog } from "@/components/inventory/receive-po-dialog"
import { FulfillFromInventoryDialog } from "@/components/inventory/fulfill-po-dialog"
import { Badge } from "@/components/ui/badge"

interface POInventoryActionsProps {
  purchaseOrderId: string
  receivedToInventory?: boolean
  inventoryFulfilled?: boolean
  onSuccess?: () => void
}

export function POInventoryActions({
  purchaseOrderId,
  receivedToInventory = false,
  inventoryFulfilled = false,
  onSuccess
}: POInventoryActionsProps) {
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false)
  const [fulfillDialogOpen, setFulfillDialogOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {receivedToInventory && (
          <Badge variant="default" className="gap-1">
            <Package className="h-3 w-3" />
            Recibido a Inventario
          </Badge>
        )}
        {inventoryFulfilled && (
          <Badge variant="secondary" className="gap-1">
            <Warehouse className="h-3 w-3" />
            Cumplido desde Inventario
          </Badge>
        )}
        {!receivedToInventory && (
          <Button
            variant="outline"
            onClick={() => setReceiveDialogOpen(true)}
          >
            <Package className="mr-2 h-4 w-4" />
            Recibir a Inventario
          </Button>
        )}
        {!inventoryFulfilled && (
          <Button
            variant="outline"
            onClick={() => setFulfillDialogOpen(true)}
          >
            <Warehouse className="mr-2 h-4 w-4" />
            Cumplir desde Inventario
          </Button>
        )}
      </div>
      <ReceivePODialog
        purchaseOrderId={purchaseOrderId}
        open={receiveDialogOpen}
        onOpenChange={setReceiveDialogOpen}
        onSuccess={() => {
          onSuccess?.()
          setReceiveDialogOpen(false)
        }}
      />
      <FulfillFromInventoryDialog
        purchaseOrderId={purchaseOrderId}
        open={fulfillDialogOpen}
        onOpenChange={setFulfillDialogOpen}
        onSuccess={() => {
          onSuccess?.()
          setFulfillDialogOpen(false)
        }}
      />
    </>
  )
}
