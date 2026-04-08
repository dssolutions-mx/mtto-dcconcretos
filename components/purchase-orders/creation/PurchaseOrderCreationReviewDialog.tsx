"use client"

import { Loader2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  PurchaseOrderCreationReviewBody,
  type PurchaseOrderCreationReviewBodyProps,
} from "@/components/purchase-orders/creation/PurchaseOrderCreationReviewBody"

export type PurchaseOrderCreationReviewDialogProps = PurchaseOrderCreationReviewBodyProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isSubmitting: boolean
}

export function PurchaseOrderCreationReviewDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  ...bodyProps
}: PurchaseOrderCreationReviewDialogProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-full"
        >
          <SheetHeader className="shrink-0 border-b px-4 pb-3 pt-4 text-left">
            <SheetTitle>Confirmar creación de orden de compra</SheetTitle>
            <SheetDescription className="sr-only">
              Revise el resumen y confirme para crear la orden de compra en el sistema.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <PurchaseOrderCreationReviewBody {...bodyProps} />
          </div>
          <SheetFooter className="shrink-0 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando…
                </>
              ) : (
                "Confirmar y crear"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar creación de orden de compra</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <PurchaseOrderCreationReviewBody {...bodyProps} />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando…
              </>
            ) : (
              "Confirmar y crear"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
