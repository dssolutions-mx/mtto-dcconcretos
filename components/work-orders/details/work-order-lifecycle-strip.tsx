"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { WorkOrderStatus } from "@/types"

export interface WorkOrderLifecycleStripProps {
  status: string | null
  hasPurchaseOrder: boolean
  incidentId: string | null
  incidentAssetId: string | null
}

export function WorkOrderLifecycleStrip({
  status,
  hasPurchaseOrder,
  incidentId,
  incidentAssetId,
}: WorkOrderLifecycleStripProps) {
  const isCompleted = status === WorkOrderStatus.Completed
  const isProgrammed = status === WorkOrderStatus.Programmed
  const isWaitingParts = status === WorkOrderStatus.WaitingParts

  return (
    <div className="mb-6 space-y-3 no-print">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className={cn(status === WorkOrderStatus.Pending && "font-medium text-foreground")}>
          Pendiente
        </span>
        <span aria-hidden>→</span>
        <span className={cn(isProgrammed && "font-medium text-foreground")}>
          Programada
        </span>
        <span aria-hidden>→</span>
        <span className={cn(isWaitingParts && "font-medium text-foreground")}>
          Esperando repuestos
        </span>
        <span aria-hidden>→</span>
        <span className={cn(isCompleted && "font-medium text-foreground")}>
          Completada
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {incidentId && incidentAssetId && (
          <Link
            href={`/activos/${incidentAssetId}`}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            Originado por incidente
          </Link>
        )}
      </div>
    </div>
  )
}
