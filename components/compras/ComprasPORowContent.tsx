"use client"

import React from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { TableCell } from "@/components/ui/table"
import { TypeBadge } from "@/components/purchase-orders/shared/TypeBadge"
import { WorkflowStageBadge } from "@/components/purchase-orders/shared/WorkflowStageBadge"
import { ExternalLink } from "lucide-react"
import { PurchaseOrderType } from "@/types/purchase-orders"
import type { ApprovalContextItem } from "@/types/purchase-orders"
import type { PurchaseOrderWithWorkOrder } from "./useComprasData"
import { cn } from "@/lib/utils"
import { getWorkOrder, isEnhancedPurchaseOrder, getEnhancedStatusConfig, getUrgencyConfig } from "./po-row-utils"

export interface ComprasPORowContentProps {
  order: PurchaseOrderWithWorkOrder
  approvalCtx: ApprovalContextItem | null
  technicianName: string
  formatCurrency: (amount: string | number | null) => string
  formatDate: (date: string | null | undefined) => string
}

export function ComprasPORowContent({
  order,
  approvalCtx,
  technicianName,
  formatCurrency,
  formatDate,
}: ComprasPORowContentProps) {
  const workOrder = getWorkOrder(order)
  const supplierName =
    isEnhancedPurchaseOrder(order) && order.service_provider
      ? order.service_provider
      : order.supplier || "—"
  const locationLine = workOrder?.assets
    ? `${workOrder.assets.asset_id || workOrder.assets.name || ""}${workOrder.assets.plants ? ` • ${workOrder.assets.plants.name}` : ""}`.trim()
    : ""
  const urgencyConfig = getUrgencyConfig(workOrder?.priority, workOrder?.priority)
  const UrgencyIcon = urgencyConfig.icon

  return (
    <>
      <TableCell className="w-24 px-4 py-3 font-mono text-sm font-medium" onClick={(e) => e.stopPropagation()}>
        <Link
          href={`/compras/${order.id}`}
          className="text-sky-700 hover:underline text-left cursor-pointer"
        >
          {order.order_id}
        </Link>
        {order.is_adjustment && (
          <Badge variant="outline" className="ml-1.5 bg-yellow-100 text-yellow-800 text-xs">
            Ajuste
          </Badge>
        )}
      </TableCell>
      <TableCell className="w-24 px-4 py-3 text-right text-sm font-semibold">
        {formatCurrency(order.total_amount || "0")}
      </TableCell>
      <TableCell className="w-36 px-4 py-3">
        {approvalCtx ? (
          <WorkflowStageBadge
            workflowStage={approvalCtx?.workflowStage || "Verificando..."}
            reason={approvalCtx?.reason}
            responsibleRole={approvalCtx?.responsibleRole}
            canAct={approvalCtx?.canApprove || approvalCtx?.canRecordViability}
            showHelp={true}
          />
        ) : (
          <Badge variant={getEnhancedStatusConfig(order.status || "Pendiente", order.po_type)}>
            {order.status || "Pendiente"}
          </Badge>
        )}
      </TableCell>
      <TableCell className="w-28 px-4 py-3">
        {isEnhancedPurchaseOrder(order) && order.po_type ? (
          <TypeBadge type={order.po_type as PurchaseOrderType} size="sm" />
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="min-w-[8rem] max-w-[10rem] px-4 py-3 truncate text-muted-foreground text-sm" title={supplierName}>
        {supplierName}
      </TableCell>
      <TableCell className="min-w-[9rem] px-4 py-3" onClick={(e) => e.stopPropagation()}>
        {workOrder ? (
          <div className="flex items-center gap-1 flex-wrap">
            <Link
              href={`/ordenes/${workOrder.id}`}
              className="text-sky-700 hover:underline flex items-center gap-1 cursor-pointer text-left"
            >
              {workOrder.order_id}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </Link>
            {locationLine && (
              <span className="text-muted-foreground text-sm">• {locationLine}</span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="w-20 px-4 py-3">
        {workOrder ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium",
              urgencyConfig.variant === "destructive" && "bg-red-50 text-red-600",
              urgencyConfig.variant === "default" && "bg-yellow-50 text-yellow-700",
              urgencyConfig.variant === "secondary" && "bg-green-50 text-green-700"
            )}
          >
            <UrgencyIcon className="h-3 w-3" />
            {urgencyConfig.label}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell
        className="max-w-32 px-4 py-3 truncate text-muted-foreground text-sm"
        title={order.items_preview}
      >
        {order.items_preview || "—"}
      </TableCell>
      <TableCell className="w-28 px-4 py-3 text-muted-foreground text-sm">{technicianName}</TableCell>
      <TableCell className="w-24 px-4 py-3 text-muted-foreground text-sm">
        {formatDate(order.purchase_date)}
      </TableCell>
    </>
  )
}
