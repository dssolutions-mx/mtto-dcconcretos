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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2 } from "lucide-react"
import { getPoPurposeLabelEs } from "@/lib/purchase-orders/creation-workflow-copy"
import type { POPurpose } from "@/types/purchase-orders"

export interface PurchaseOrderCreationReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  isSubmitting: boolean
  /** e.g. Compra directa */
  poTypeLabel: string
  poPurpose: POPurpose | string
  workOrderTypeLabel: string | null
  approvalAmount: number
  totalAmount: number
  inventoryLineCount: number
  purchaseLineCount: number
  workOrderId?: string | null
  workOrderOrderId?: string | null
  workflowHintLines: string[]
  /** Optional soft warning (e.g. intent vs lines alignment). */
  softWarning?: string | null
}

export function PurchaseOrderCreationReviewDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  poTypeLabel,
  poPurpose,
  workOrderTypeLabel,
  approvalAmount,
  totalAmount,
  inventoryLineCount,
  purchaseLineCount,
  workOrderId,
  workOrderOrderId,
  workflowHintLines,
  softWarning,
}: PurchaseOrderCreationReviewDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar creación de la orden</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-foreground">
              <p className="text-muted-foreground">
                Revise el resumen antes de enviar. Al confirmar, se creará la orden con los datos indicados.
              </p>
              <dl className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Tipo de solicitud</dt>
                  <dd className="font-medium text-right">{poTypeLabel}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Propósito (sistema)</dt>
                  <dd className="font-medium text-right">{getPoPurposeLabelEs(poPurpose)}</dd>
                </div>
                {workOrderTypeLabel ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Tipo de OT</dt>
                    <dd className="font-medium text-right">{workOrderTypeLabel}</dd>
                  </div>
                ) : null}
                {workOrderId ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Orden de trabajo</dt>
                    <dd className="font-medium text-right font-mono text-xs">
                      {workOrderOrderId ?? workOrderId.slice(0, 8) + '…'}
                    </dd>
                  </div>
                ) : (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Orden de trabajo</dt>
                    <dd className="font-medium text-right">Independiente</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Partidas (surtido almacén / compra)</dt>
                  <dd className="font-medium text-right">
                    {inventoryLineCount} / {purchaseLineCount}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Monto total (OC)</dt>
                  <dd className="font-medium text-right">
                    ${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Monto de aprobación</dt>
                  <dd className="font-medium text-right">
                    ${approvalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </dd>
                </div>
              </dl>
              {softWarning ? (
                <div className="rounded-lg border border-sky-200/80 bg-sky-50/90 dark:bg-sky-950/25 dark:border-sky-900/40 p-3 text-xs text-sky-950/90 dark:text-sky-100/90">
                  <p className="font-semibold text-sky-900 dark:text-sky-200 mb-1">Aviso</p>
                  <p>{softWarning}</p>
                </div>
              ) : null}
              {workflowHintLines.length > 0 ? (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-900/50 p-3">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-2">
                    Aprobaciones (orientativo, según política actual)
                  </p>
                  <ScrollArea className="max-h-32 pr-2">
                    <ul className="list-disc pl-4 space-y-1 text-xs text-amber-950/90 dark:text-amber-100/90">
                      {workflowHintLines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isSubmitting}>Volver a editar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isSubmitting}
            onClick={(e) => {
              e.preventDefault()
              void onConfirm()
            }}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creando…
              </>
            ) : (
              'Confirmar y crear'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
