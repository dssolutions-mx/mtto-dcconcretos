"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PurchaseOrderEditDialog } from "@/components/purchase-orders/dialogs/PurchaseOrderEditDialog"
import { Pencil } from "lucide-react"

interface EditPOButtonProps {
  id: string
  initialData: any
  /** When true, renders icon-only button for compact layouts (e.g. mobile header) */
  compact?: boolean
}

export function EditPOButton({ id, initialData, compact }: EditPOButtonProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const refresh = () => router.refresh()
  return (
    <>
      <Button
        variant="secondary"
        size={compact ? "icon" : "default"}
        onClick={() => setOpen(true)}
        aria-label="Editar orden de compra"
      >
        {compact ? <Pencil className="h-4 w-4" /> : "Editar"}
      </Button>
      <PurchaseOrderEditDialog
        open={open}
        onOpenChange={setOpen}
        purchaseOrderId={id}
        initialData={initialData}
        onUpdated={refresh}
      />
    </>
  )
}


