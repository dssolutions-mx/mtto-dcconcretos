"use client"

import { useSearchParams } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { PurchaseOrderDetailsMobile } from "@/components/purchase-orders/purchase-order-details-mobile"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ReactNode } from "react"
import { PurchaseOrderType } from "@/types/purchase-orders"
import type { POFulfillmentHints } from "@/components/purchase-orders/workflow/WorkflowStatusDisplay"
import { FileCheck, Package, ShoppingCart, Store, Building2, Wrench } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

function formatCurrency(amount: string | null): string {
  if (!amount) return "$0.00"
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(amount))
}

function formatDate(dateString: string | null, formatStr: string = "PP"): string {
  if (!dateString) return "N/A"
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    return format(date, formatStr, { locale: es })
  } catch {
    return dateString
  }
}

function getFileExtension(url: string): string {
  if (!url) return ""
  return url.split(".").pop()?.toLowerCase() || ""
}

function isImageFile(url: string): boolean {
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(getFileExtension(url))
}

function isPdfFile(url: string): boolean {
  return getFileExtension(url) === "pdf"
}

function getPurchaseOrderTypeInfo(poType: string | null) {
  switch (poType) {
    case PurchaseOrderType.DIRECT_PURCHASE:
      return {
        label: "Compra Directa",
        description: "Ferretería, tienda local",
        icon: Store,
        color: "bg-blue-100 text-blue-700",
      }
    case PurchaseOrderType.DIRECT_SERVICE:
      return {
        label: "Servicio Directo",
        description: "Técnico especialista",
        icon: Wrench,
        color: "bg-green-100 text-green-700",
      }
    case PurchaseOrderType.SPECIAL_ORDER:
      return {
        label: "Pedido Especial",
        description: "Proveedor formal",
        icon: Building2,
        color: "bg-purple-100 text-purple-700",
      }
    default:
      return null
  }
}

function getActionButtons(order: any): ReactNode {
  if (!order) return null
  if (order.po_type) return null
  switch (order.status) {
    case "pending_approval":
      return (
        <>
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/compras/${order.id}/aprobar`}>
              <FileCheck className="mr-2 h-4 w-4" />
              Aprobar Orden
            </Link>
          </Button>
          <Button asChild variant="destructive" className="w-full">
            <Link href={`/compras/${order.id}/rechazar`}>Rechazar Orden</Link>
          </Button>
        </>
      )
    case "approved":
      return (
        <Button asChild className="w-full">
          <Link href={`/compras/${order.id}/pedido`}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Marcar como Pedida
          </Link>
        </Button>
      )
    case "ordered":
      return (
        <Button asChild className="w-full">
          <Link href={`/compras/${order.id}/recibido`}>
            <Package className="mr-2 h-4 w-4" />
            Registrar Recepción
          </Link>
        </Button>
      )
    default:
      return null
  }
}

interface PurchaseOrderDetailsRouterProps {
  order: any
  workOrder: any
  requesterName: string
  approverName: string
  authorizerName?: string | null
  items: any[]
  desktopContent: ReactNode
  fulfillmentHints?: POFulfillmentHints | null
  isViewerCoordinator?: boolean
  coordinatorQuotationUnlocked?: boolean
  /** OCs with same `work_order_id` (for link back to OT multi-OC section) */
  linkedPurchaseOrderCount?: number
}

export function PurchaseOrderDetailsRouter({
  order,
  workOrder,
  requesterName,
  approverName,
  authorizerName,
  items,
  desktopContent,
  fulfillmentHints,
  isViewerCoordinator = false,
  coordinatorQuotationUnlocked = true,
  linkedPurchaseOrderCount = 0,
}: PurchaseOrderDetailsRouterProps) {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const forceDesktop = searchParams.get("view") === "desktop"

  if (isMobile && !forceDesktop) {
    return (
      <PurchaseOrderDetailsMobile
        order={order}
        workOrder={workOrder}
        requesterName={requesterName}
        approverName={approverName}
        authorizerName={authorizerName}
        items={items}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
        getActionButtons={getActionButtons}
        getPurchaseOrderTypeInfo={getPurchaseOrderTypeInfo}
        isImageFile={isImageFile}
        isPdfFile={isPdfFile}
        fulfillmentHints={fulfillmentHints}
        isViewerCoordinator={isViewerCoordinator}
        coordinatorQuotationUnlocked={coordinatorQuotationUnlocked}
        linkedPurchaseOrderCount={linkedPurchaseOrderCount}
      />
    )
  }

  return <>{desktopContent}</>
}
