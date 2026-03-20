"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit, ShoppingCart, CheckCircle } from "lucide-react"
import { WorkOrderStatus } from "@/types"
import { WorkOrderPrintHandler } from "@/components/work-orders/work-order-print-handler"

function getStatusVariant(status: string | null): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case WorkOrderStatus.Completed:
      return "default"
    case WorkOrderStatus.WaitingParts:
      return "secondary"
    case WorkOrderStatus.Pending:
    case WorkOrderStatus.Programmed:
      return "outline"
    default:
      return "outline"
  }
}

export interface WorkOrderDetailsHeaderProps {
  orderId: string
  status: string | null
  workOrderId: string
  /** Target PO ID for "Ver OC Existente" link (when has PO) */
  targetPOId: string | null
  hasPurchaseOrder: boolean
  hasRelatedPOs: boolean
  shouldShowGeneratePO: boolean
  isCompleted: boolean
}

export function WorkOrderDetailsHeader({
  orderId,
  status,
  workOrderId,
  targetPOId,
  hasPurchaseOrder,
  hasRelatedPOs,
  shouldShowGeneratePO,
  isCompleted,
}: WorkOrderDetailsHeaderProps) {
  const hasExistingPO = (hasPurchaseOrder || hasRelatedPOs) && !!targetPOId
  const shouldPrioritizePurchaseFlow = !hasExistingPO && shouldShowGeneratePO && !isCompleted

  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Orden de trabajo
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{orderId}</h1>
          <Badge variant={getStatusVariant(status)} className="capitalize text-sm">
            {status || "Pendiente"}
          </Badge>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2 lg:justify-end">
        {shouldPrioritizePurchaseFlow && (
          <Button asChild>
            <Link href={`/ordenes/${workOrderId}/generar-oc`}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Solicitar refacciones
            </Link>
          </Button>
        )}

        {!shouldPrioritizePurchaseFlow && !isCompleted && (
          <Button asChild>
            <Link href={`/ordenes/${workOrderId}/completar`}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Completar
            </Link>
          </Button>
        )}

        <Button variant="outline" asChild>
          <Link href={`/ordenes/${workOrderId}/editar`}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>

        {hasExistingPO ? (
          <Button variant="outline" asChild>
            <Link href={`/compras/${targetPOId!}`}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Ver OC Existente
            </Link>
          </Button>
        ) : null}

        {!shouldPrioritizePurchaseFlow && !isCompleted && shouldShowGeneratePO && (
          <Button variant="outline" asChild>
            <Link href={`/ordenes/${workOrderId}/generar-oc`}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Solicitar refacciones
            </Link>
          </Button>
        )}

        {shouldPrioritizePurchaseFlow && !isCompleted && (
          <Button variant="outline" asChild>
            <Link href={`/ordenes/${workOrderId}/completar`}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Completar
            </Link>
          </Button>
        )}

        <div className="hidden h-6 w-px bg-border sm:block" />
        <WorkOrderPrintHandler workOrderId={workOrderId} className="sm:px-3" />
      </div>
    </div>
  )
}
