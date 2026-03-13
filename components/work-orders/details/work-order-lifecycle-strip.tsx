"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { WorkOrderStatus } from "@/types"

export interface WorkOrderLifecycleStripProps {
  status: string | null
  hasPurchaseOrder: boolean
  relatedServiceOrder: { id: string; order_id?: string | null } | null
  incidentId: string | null
  incidentAssetId: string | null
}

export function WorkOrderLifecycleStrip({
  status,
  hasPurchaseOrder,
  relatedServiceOrder,
  incidentId,
  incidentAssetId,
}: WorkOrderLifecycleStripProps) {
  const isCompleted = status === WorkOrderStatus.Completed
  const isInProgress = status === WorkOrderStatus.InProgress

  return (
    <div className="mb-6 space-y-3 no-print">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span
          className={cn(
            !isCompleted && !hasPurchaseOrder && "font-medium text-foreground"
          )}
        >
          Planificado
        </span>
        <span aria-hidden>→</span>
        <span
          className={cn(hasPurchaseOrder && !isCompleted && "font-medium text-foreground")}
        >
          En compra
        </span>
        <span aria-hidden>→</span>
        <span className={cn(isInProgress && "font-medium text-foreground")}>
          En ejecución
        </span>
        <span aria-hidden>→</span>
        <span className={cn(isCompleted && "font-medium text-foreground")}>
          Completado
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {relatedServiceOrder && (
          <Link
            href={`/servicios/${relatedServiceOrder.id}`}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            Este trabajo fue ejecutado: Ver {relatedServiceOrder.order_id || "OS"}
          </Link>
        )}
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
