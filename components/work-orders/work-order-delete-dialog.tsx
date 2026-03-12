"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { WorkOrderWithAsset } from "@/types"

export interface WorkOrderDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderToDelete: WorkOrderWithAsset | null
  onConfirm: () => Promise<void>
  isDeleting: boolean
}

export function WorkOrderDeleteDialog({
  open,
  onOpenChange,
  orderToDelete,
  onConfirm,
  isDeleting,
}: WorkOrderDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Está seguro de eliminar esta orden de trabajo?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción eliminará permanentemente la orden de trabajo{" "}
            <strong>{orderToDelete?.order_id}</strong> y todos sus registros
            relacionados.
          </AlertDialogDescription>
          <div className="space-y-3 pt-2">
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              <li>Historial de mantenimiento</li>
              <li>Problemas de checklist asociados</li>
              <li>Órdenes de servicio relacionadas</li>
              <li>Gastos adicionales</li>
              <li>Órdenes de compra vinculadas</li>
            </ul>
            <div className="font-semibold text-destructive text-sm">
              Esta acción no se puede deshacer.
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
