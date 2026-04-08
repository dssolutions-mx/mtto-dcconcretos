"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { getPoPurposeLabelEs } from "@/lib/purchase-orders/creation-workflow-copy"
import type { POPurpose } from "@/types/purchase-orders"

export type PurchaseOrderCreationReviewBodyProps = {
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
  softWarning?: string | null
}

export function PurchaseOrderCreationReviewBody({
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
}: PurchaseOrderCreationReviewBodyProps) {
  return (
    <div className="space-y-3 text-left text-sm text-foreground">
      <p className="text-muted-foreground">
        La orden se guarda en el sistema solo cuando pulse{" "}
        <span className="font-medium text-foreground">Confirmar y crear</span> abajo. Si
        cierra esta ventana antes, no se creará la orden.
      </p>
      <dl className="grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Tipo de solicitud</dt>
          <dd className="text-right font-medium">{poTypeLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Propósito (sistema)</dt>
          <dd className="text-right font-medium">{getPoPurposeLabelEs(poPurpose)}</dd>
        </div>
        {workOrderTypeLabel ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Tipo de OT</dt>
            <dd className="text-right font-medium">{workOrderTypeLabel}</dd>
          </div>
        ) : null}
        {workOrderId ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Orden de trabajo</dt>
            <dd className="text-right font-mono text-xs font-medium">
              {workOrderOrderId ?? workOrderId.slice(0, 8) + "…"}
            </dd>
          </div>
        ) : (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Orden de trabajo</dt>
            <dd className="text-right font-medium">Independiente</dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Partidas (surtido almacén / compra)</dt>
          <dd className="text-right font-medium">
            {inventoryLineCount} / {purchaseLineCount}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Monto total (OC)</dt>
          <dd className="text-right font-medium">
            ${totalAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Monto de aprobación</dt>
          <dd className="text-right font-medium">
            ${approvalAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </dd>
        </div>
      </dl>
      {softWarning ? (
        <div className="rounded-lg border border-sky-200/80 bg-sky-50/90 p-3 text-xs text-sky-950/90 dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-100/90">
          <p className="mb-1 font-semibold text-sky-900 dark:text-sky-200">Aviso</p>
          <p>{softWarning}</p>
        </div>
      ) : null}
      {workflowHintLines.length > 0 ? (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="mb-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
            Aprobaciones (orientativo, según política actual)
          </p>
          <ScrollArea className="max-h-32 pr-2">
            <ul className="list-disc space-y-1 pl-4 text-xs text-amber-950/90 dark:text-amber-100/90">
              {workflowHintLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      ) : null}
    </div>
  )
}
