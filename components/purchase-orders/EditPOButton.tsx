"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PurchaseOrderEditDialog } from "@/components/purchase-orders/dialogs/PurchaseOrderEditDialog"

interface EditPOButtonProps {
  id: string
  initialData: any
}

export function EditPOButton({ id, initialData }: EditPOButtonProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const refresh = () => router.refresh()
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Editar</Button>
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


