"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Package, ShoppingCart, User } from "lucide-react"
import { WorkOrderWithAsset } from "@/types"
import { getStatusVariant, getTypeVariant, getPriorityVariant, getPurchaseOrderStatusVariant, getPurchaseOrderStatusClass, formatDate } from "./work-order-badges"
import { WorkOrderActionsMenu } from "./work-order-actions-menu"

export interface WorkOrderCardMobileProps {
  order: WorkOrderWithAsset
  getTechnicianName: (techId: string | null) => string
  getPurchaseOrderStatus: (poId: string | null) => string
  onDeleteOrder: (order: WorkOrderWithAsset) => void
}

export function WorkOrderCardMobile({
  order,
  getTechnicianName,
  getPurchaseOrderStatus,
  onDeleteOrder,
}: WorkOrderCardMobileProps) {
  return (
    <Card className="w-full h-fit hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold truncate">
              {order.order_id}
            </CardTitle>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {order.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusVariant(order.status)} className="shrink-0">
              {order.status || "Pendiente"}
            </Badge>
            <WorkOrderActionsMenu
              order={order}
              getPurchaseOrderStatus={getPurchaseOrderStatus}
              onDeleteOrder={onDeleteOrder}
              variant="mobile"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Asset Info */}
        <div className="flex items-center gap-2 text-sm">
          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {order.asset?.name || "N/A"}
            </p>
            {order.asset?.asset_id && (
              <p className="text-xs text-muted-foreground">
                ID: {order.asset.asset_id}
              </p>
            )}
          </div>
        </div>

        {/* Type and Priority */}
        <div className="flex gap-2 flex-wrap items-center">
          <Badge variant={getTypeVariant(order.type)} className="text-xs">
            {order.type || "N/A"}
          </Badge>
          <Badge variant={getPriorityVariant(order.priority)} className="text-xs">
            {order.priority || "Normal"}
          </Badge>
          {order.incident_id && order.asset_id && (
            <Badge variant="outline" className="text-xs" asChild>
              <Link href={`/activos/${order.asset_id}/incidentes`} className="hover:underline">
                Desde incidente
              </Link>
            </Badge>
          )}
        </div>

        {/* Technician */}
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">{getTechnicianName(order.assigned_to)}</span>
        </div>

        {/* Date */}
        {order.planned_date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{formatDate(order.planned_date)}</span>
          </div>
        )}

        {/* Purchase Order Status */}
        {order.purchase_order_id && (
          <div className="flex items-center gap-2 text-sm">
            <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
            <Badge
              variant={getPurchaseOrderStatusVariant(getPurchaseOrderStatus(order.purchase_order_id))}
              className={`text-xs ${getPurchaseOrderStatusClass(getPurchaseOrderStatus(order.purchase_order_id))}`}
            >
              OC: {getPurchaseOrderStatus(order.purchase_order_id)}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
