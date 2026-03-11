"use client"

import React from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { FileText, Package, Wrench } from "lucide-react"
import type { PurchaseOrderWithWorkOrder } from "./useComprasData"
import { getWorkOrder, getItemsList } from "./po-row-utils"
import { ComprasQuotationAccess } from "./ComprasQuotationAccess"

export interface ComprasRowDetailProps {
  order: PurchaseOrderWithWorkOrder
  /** Total number of table columns for colspan */
  colSpan?: number
}

export function ComprasRowDetail({ order, colSpan = 11 }: ComprasRowDetailProps) {
  const workOrder = getWorkOrder(order)
  const itemsList = getItemsList(order.items)
  const hasNotes =
    !!order.notes ||
    !!order.requires_quote ||
    !!(order as { quotation_url?: string }).quotation_url ||
    ((order as { quotation_urls?: unknown[] }).quotation_urls?.length ?? 0) > 0

  return (
    <TableRow className="border-b border-slate-100 bg-slate-50/60 hover:bg-slate-50/70">
      <TableCell colSpan={colSpan} className="p-5" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {itemsList.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 font-medium mb-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Items
              </div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                {itemsList.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {workOrder?.description && (
            <div>
              <div className="flex items-center gap-1.5 font-medium mb-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                Descripción OT
              </div>
              <p className="text-muted-foreground line-clamp-4">{workOrder.description}</p>
            </div>
          )}
          {hasNotes && (
            <div>
              <div className="flex items-center gap-1.5 font-medium mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Notas / Cotización
              </div>
              <div className="space-y-1">
                {order.notes && <p className="text-muted-foreground">{order.notes}</p>}
                {(order.requires_quote ||
                  (order as { quotation_url?: string }).quotation_url ||
                  ((order as { quotation_urls?: unknown[] }).quotation_urls?.length ?? 0) > 0) && (
                  <ComprasQuotationAccess
                    purchaseOrderId={order.id}
                    workOrderId={order.work_order_id}
                    legacyUrl={(order as { quotation_url?: string | null }).quotation_url}
                    quotationUrls={(order as { quotation_urls?: string[] | null }).quotation_urls}
                    requiresQuote={order.requires_quote}
                  >
                    <Button variant="outline" size="sm" className="cursor-pointer">
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Ver cotizaciones
                    </Button>
                  </ComprasQuotationAccess>
                )}
              </div>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
