"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  CheckCircle,
  Edit,
  Eye,
  FileText,
  MoreHorizontal,
  ShoppingCart,
  Trash,
  Wrench,
  AlertTriangle,
  CalendarDays,
  ListChecks,
} from "lucide-react"
import { WorkOrderWithAsset, WorkOrderStatus, MaintenanceType } from "@/types"

export interface WorkOrderActionsMenuProps {
  order: WorkOrderWithAsset
  getPurchaseOrderStatus?: (poId: string | null) => string
  onDeleteOrder: (order: WorkOrderWithAsset) => void
  variant: "mobile" | "desktop"
  canEdit?: boolean
  canDelete?: boolean
}

export function WorkOrderActionsMenu({
  order,
  getPurchaseOrderStatus,
  onDeleteOrder,
  variant,
  canEdit = true,
  canDelete = true,
}: WorkOrderActionsMenuProps) {
  const isMobile = variant === "mobile"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Abrir menú</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/ordenes/${order.id}`}>
            <Eye className="mr-2 h-4 w-4" />
            <span>Ver Detalles</span>
          </Link>
        </DropdownMenuItem>
        {!isMobile && (
          <DropdownMenuItem asChild>
            <Link href={`/servicios?workOrderId=${order.id}`}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Ver Servicio</span>
            </Link>
          </DropdownMenuItem>
        )}
        {!isMobile && order.incident_id && order.asset_id && (
          <DropdownMenuItem asChild>
            <Link href={`/activos/${order.asset_id}/incidentes`}>
              <AlertTriangle className="mr-2 h-4 w-4" />
              <span>Incidente</span>
            </Link>
          </DropdownMenuItem>
        )}
        {canEdit && (
          <DropdownMenuItem asChild>
            <Link href={`/ordenes/${order.id}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              <span>Editar OT</span>
            </Link>
          </DropdownMenuItem>
        )}
        {canEdit && !order.purchase_order_id && order.required_parts && !isMobile && (
          <DropdownMenuItem asChild>
            <Link href={`/ordenes/${order.id}/generar-oc`}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              <span>Generar OC</span>
            </Link>
          </DropdownMenuItem>
        )}
        {order.purchase_order_id && (
          <DropdownMenuItem asChild>
            <Link href={`/compras/${order.purchase_order_id}`}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              <span>Ver OC</span>
            </Link>
          </DropdownMenuItem>
        )}
        {!isMobile && (
          <DropdownMenuItem asChild>
            <a href={`/ordenes/${order.id}#checklist`}>
              <ListChecks className="mr-2 h-4 w-4" />
              <span>Ver Checklist</span>
            </a>
          </DropdownMenuItem>
        )}
        {canEdit && order.status !== WorkOrderStatus.Completed && (
          <DropdownMenuItem asChild>
            <Link href={`/ordenes/${order.id}/completar`}>
              <Wrench className="mr-2 h-4 w-4" />
              <span>{isMobile ? "Completar OT" : "Registrar Mantenimiento"}</span>
            </Link>
          </DropdownMenuItem>
        )}
        {canEdit && !isMobile && (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/ordenes/${order.id}/editar`}>
                <CalendarDays className="mr-2 h-4 w-4" />
                <span>Re-Programar</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/ordenes/${order.id}/completar`}>
                <CheckCircle className="mr-2 h-4 w-4" />
                <span>Cambiar Estado</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => onDeleteOrder(order)}
            >
              <Trash className="mr-2 h-4 w-4" />
              <span>Eliminar OT</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
