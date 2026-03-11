"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ChevronDown, ChevronRight } from "lucide-react"
import { PurchaseOrderStatus } from "@/types"
import type { ApprovalContextItem } from "@/types/purchase-orders"
import type { PurchaseOrderWithWorkOrder } from "./useComprasData"
import { ComprasPORowContent } from "./ComprasPORowContent"
import { ComprasQuickActions } from "./ComprasQuickActions"
import { ComprasRowDetail } from "./ComprasRowDetail"

export interface ComprasTableProps {
  orders: PurchaseOrderWithWorkOrder[]
  approvalContext: Record<string, ApprovalContextItem>
  expandedRows: Set<string>
  onToggleExpand: (id: string) => void
  getTechnicianName: (id: string | null) => string
  formatCurrency: (amount: string | number | null) => string
  formatDate: (date: string | null | undefined) => string
  onQuickApproval: (order: PurchaseOrderWithWorkOrder, action: "approve" | "reject") => void
  onRecordViability: (order: PurchaseOrderWithWorkOrder) => void
  onDelete: (order: PurchaseOrderWithWorkOrder) => void
  isApproving: boolean
}

const TOOLTIP_DELAY = 200

export function ComprasTable({
  orders,
  approvalContext,
  expandedRows,
  onToggleExpand,
  getTechnicianName,
  formatCurrency,
  formatDate,
  onQuickApproval,
  onRecordViability,
  onDelete,
  isApproving,
}: ComprasTableProps) {
  const router = useRouter()

  return (
    <TooltipProvider delayDuration={TOOLTIP_DELAY}>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-slate-100 hover:bg-transparent">
            <TableHead className="w-9 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider" />
            <TableHead className="w-24 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              OC
            </TableHead>
            <TableHead className="w-24 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Monto
            </TableHead>
            <TableHead className="w-36 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Estado
            </TableHead>
            <TableHead className="w-28 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tipo
            </TableHead>
            <TableHead className="min-w-[8rem] px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Proveedor
            </TableHead>
            <TableHead className="min-w-[9rem] px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              OT / Activo
            </TableHead>
            <TableHead className="w-20 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Urgencia
            </TableHead>
            <TableHead className="max-w-32 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Items
            </TableHead>
            <TableHead className="w-28 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Solicitante
            </TableHead>
            <TableHead className="w-24 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Fecha
            </TableHead>
            <TableHead className="min-w-[200px] px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const ctx =
              order.status === PurchaseOrderStatus.PendingApproval && !order.is_adjustment
                ? approvalContext[order.id]
                : null
            const isExpanded = expandedRows.has(order.id)

            return (
              <React.Fragment key={order.id}>
                <TableRow
                  className="cursor-pointer border-b border-slate-100 py-3 hover:bg-muted/50"
                  onClick={() => router.push(`/compras/${order.id}`)}
                >
                  <TableCell
                    className="w-9 px-4 py-3"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleExpand(order.id)
                    }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 cursor-pointer"
                          aria-label={isExpanded ? "Contraer" : "Expandir"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isExpanded ? "Contraer" : "Expandir"}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <ComprasPORowContent
                    order={order}
                    approvalCtx={ctx}
                    technicianName={getTechnicianName(order.requested_by)}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                  />
                  <TableCell className="min-w-[200px] px-4 py-3 text-right">
                    <ComprasQuickActions
                      order={order}
                      approvalCtx={ctx}
                      isApproving={isApproving}
                      onApprove={(o) => onQuickApproval(o, "approve")}
                      onReject={(o) => onQuickApproval(o, "reject")}
                      onRecordViability={onRecordViability}
                      onDelete={onDelete}
                    />
                  </TableCell>
                </TableRow>
                {isExpanded && <ComprasRowDetail order={order} colSpan={12} />}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  )
}
