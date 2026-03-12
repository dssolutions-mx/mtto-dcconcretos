"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Calendar,
  Edit,
  Eye,
  MoreHorizontal,
  ShoppingCart,
  Trash,
  Wrench,
} from "lucide-react"
import { WorkOrderWithAsset, WorkOrderStatus } from "@/types"
import {
  getStatusVariant,
  getStatusBorderClass,
  getTypeVariant,
  getPriorityVariant,
  getPriorityDotClass,
  getPurchaseOrderStatusVariant,
  getPurchaseOrderStatusClass,
  formatDateRelative,
} from "./work-order-badges"
import { cn } from "@/lib/utils"

export interface WorkOrderCardMobileProps {
  order: WorkOrderWithAsset
  getTechnicianName: (techId: string | null) => string
  getPurchaseOrderStatus: (poId: string | null) => string
  onDeleteOrder: (order: WorkOrderWithAsset) => void
  canEdit?: boolean
  canDelete?: boolean
}

export function WorkOrderCardMobile({
  order,
  getTechnicianName,
  getPurchaseOrderStatus,
  onDeleteOrder,
  canEdit = true,
  canDelete = true,
}: WorkOrderCardMobileProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const techName = getTechnicianName(order.assigned_to)
  const initials = techName !== "No asignado"
    ? techName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "—"

  return (
    <Card
      className={cn(
        "w-full overflow-hidden border-l-4 transition-shadow hover:shadow-md",
        getStatusBorderClass(order.status)
      )}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg font-semibold leading-tight truncate text-foreground">
              {order.asset?.name || "N/A"}
            </CardTitle>
            {order.asset?.asset_id && (
              <p className="text-xs text-muted-foreground mt-0.5">{order.asset.asset_id}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {order.order_id}
              {order.description ? ` · ${order.description}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={getStatusVariant(order.status)} className="text-xs capitalize">
              {order.status || "Pendiente"}
            </Badge>
            <div className="flex items-center gap-1">
              <span
                className={cn("h-1.5 w-1.5 rounded-full", getPriorityDotClass(order.priority))}
                aria-hidden
              />
              <Badge variant={getPriorityVariant(order.priority)} className="text-xs capitalize">
                {order.priority || "Normal"}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Type + incident link */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getTypeVariant(order.type)} className="text-xs">
            {order.type || "N/A"}
          </Badge>
          {order.incident_id && order.asset_id && (
            <Badge variant="outline" className="text-xs" asChild>
              <Link href={`/activos/${order.asset_id}/incidentes`} className="hover:underline">
                Desde incidente
              </Link>
            </Badge>
          )}
        </div>

        {/* Technician with avatar */}
        <div className="flex items-center gap-2 text-sm">
          <Avatar className="h-8 w-8 shrink-0 border border-border">
            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-muted-foreground">{techName}</span>
        </div>

        {/* Date + PO status in one row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {order.planned_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 shrink-0" />
              {formatDateRelative(order.planned_date)}
            </span>
          )}
          {order.purchase_order_id && (
            <span className="flex items-center gap-1.5">
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <Badge
                variant={getPurchaseOrderStatusVariant(getPurchaseOrderStatus(order.purchase_order_id))}
                className={cn(
                  "text-xs",
                  getPurchaseOrderStatusClass(getPurchaseOrderStatus(order.purchase_order_id))
                )}
              >
                OC: {getPurchaseOrderStatus(order.purchase_order_id)}
              </Badge>
            </span>
          )}
        </div>

        {/* Actions: open bottom sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="w-full gap-2">
              <MoreHorizontal className="h-4 w-4" />
              Acciones
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl">
            <SheetHeader>
              <SheetTitle>OT {order.order_id}</SheetTitle>
            </SheetHeader>
            <div className="grid gap-1 py-4">
              <Button variant="ghost" className="justify-start gap-3 h-12" asChild>
                <Link href={`/ordenes/${order.id}`} onClick={() => setSheetOpen(false)}>
                  <Eye className="h-4 w-4" />
                  Ver detalles
                </Link>
              </Button>
              {canEdit && (
                <Button variant="ghost" className="justify-start gap-3 h-12" asChild>
                  <Link href={`/ordenes/${order.id}/editar`} onClick={() => setSheetOpen(false)}>
                    <Edit className="h-4 w-4" />
                    Editar OT
                  </Link>
                </Button>
              )}
              {canEdit && order.status !== WorkOrderStatus.Completed && (
                <Button variant="ghost" className="justify-start gap-3 h-12" asChild>
                  <Link href={`/ordenes/${order.id}/completar`} onClick={() => setSheetOpen(false)}>
                    <Wrench className="h-4 w-4" />
                    Completar OT
                  </Link>
                </Button>
              )}
              {order.purchase_order_id && (
                <Button variant="ghost" className="justify-start gap-3 h-12" asChild>
                  <Link href={`/compras/${order.purchase_order_id}`} onClick={() => setSheetOpen(false)}>
                    <ShoppingCart className="h-4 w-4" />
                    Ver OC
                  </Link>
                </Button>
              )}
              {canDelete && (
                <>
                  <div className="my-2 border-t" />
                  <Button
                    variant="ghost"
                    className="justify-start gap-3 h-12 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => {
                      setSheetOpen(false)
                      onDeleteOrder(order)
                    }}
                  >
                    <Trash className="h-4 w-4" />
                    Eliminar OT
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
  )
}
