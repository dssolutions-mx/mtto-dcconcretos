"use client"

import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Check, FileText, MoreHorizontal, Package, Shield, ShoppingCart, Trash2, X } from "lucide-react"
import { PurchaseOrderStatus } from "@/types"
import type { ApprovalContextItem } from "@/types/purchase-orders"
import type { PurchaseOrderWithWorkOrder } from "./useComprasData"
import { ComprasQuotationAccess } from "./ComprasQuotationAccess"

export interface ComprasQuickActionsProps {
  order: PurchaseOrderWithWorkOrder
  approvalCtx: ApprovalContextItem | null
  isApproving?: boolean
  onApprove: (order: PurchaseOrderWithWorkOrder) => void
  onReject: (order: PurchaseOrderWithWorkOrder) => void
  onRecordViability: (order: PurchaseOrderWithWorkOrder) => void
  onDelete: (order: PurchaseOrderWithWorkOrder) => void
}

const TOOLTIP_DELAY = 200

export function ComprasQuickActions({
  order,
  approvalCtx,
  isApproving = false,
  onApprove,
  onReject,
  onRecordViability,
  onDelete,
}: ComprasQuickActionsProps) {
  const canShowApproval = approvalCtx?.canApprove || approvalCtx?.canRecordViability
  const canApprove = approvalCtx?.canApprove
  const canRecordViability = approvalCtx?.canRecordViability && !approvalCtx?.canApprove

  return (
    <TooltipProvider delayDuration={TOOLTIP_DELAY}>
      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        {canShowApproval && (
          <>
            {canApprove && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className="h-7 bg-green-600 hover:bg-green-700 cursor-pointer"
                      onClick={() => onApprove(order)}
                      aria-label="Aprobar orden"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Aprobar</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 cursor-pointer"
                      onClick={() => onReject(order)}
                      aria-label="Rechazar orden"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Rechazar</TooltipContent>
                </Tooltip>
              </>
            )}
            {canRecordViability && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="h-7 bg-sky-600 hover:bg-sky-700 cursor-pointer"
                    onClick={() => onRecordViability(order)}
                    disabled={isApproving}
                    aria-label="Registrar viabilidad administrativa"
                  >
                    <Shield className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Registrar viabilidad</TooltipContent>
              </Tooltip>
            )}
          </>
        )}
        <ComprasQuotationAccess
          purchaseOrderId={order.id}
          workOrderId={order.work_order_id}
          legacyUrl={(order as { quotation_url?: string | null }).quotation_url}
          quotationUrls={(order as { quotation_urls?: string[] | null }).quotation_urls}
          requiresQuote={order.requires_quote}
        >
          <Button
            variant="outline"
            size="sm"
            className="h-7 cursor-pointer gap-1"
            aria-label="Ver cotizaciones"
          >
            <FileText className="h-3.5 w-3.5" />
            Cotiz.
          </Button>
        </ComprasQuotationAccess>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Más acciones</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            {order.status === PurchaseOrderStatus.PendingApproval &&
              !order.is_adjustment &&
              canRecordViability && (
                <DropdownMenuItem onClick={() => onRecordViability(order)} disabled={isApproving}>
                  <Shield className="mr-2 h-4 w-4" />
                  Registrar viabilidad
                </DropdownMenuItem>
              )}
            {order.status === PurchaseOrderStatus.Approved && !order.is_adjustment && (
              <DropdownMenuItem asChild>
                <Link href={`/compras/${order.id}/pedido`}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Realizar pedido
                </Link>
              </DropdownMenuItem>
            )}
            {order.status === PurchaseOrderStatus.Validated && !order.is_adjustment && (
              <DropdownMenuItem asChild>
                <Link href={`/compras/${order.id}/recibido`}>
                  <Package className="mr-2 h-4 w-4" />
                  Marcar como recibido
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDelete(order)} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar OC
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  )
}
