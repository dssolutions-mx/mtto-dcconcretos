/** Shared utilities for PO row display (desktop table, mobile cards) */
import { AlertCircle, Clock, Info } from "lucide-react"
import type { PurchaseOrderWithWorkOrder } from "./useComprasData"
import { PurchaseOrderType } from "@/types/purchase-orders"
import { PurchaseOrderStatus } from "@/types"

export function getWorkOrder(order: PurchaseOrderWithWorkOrder) {
  return order.work_orders
}

export function isEnhancedPurchaseOrder(order: PurchaseOrderWithWorkOrder): boolean {
  return !!(order.po_type)
}

export function getEnhancedStatusConfig(status: string, poType?: string) {
  if (poType) {
    switch (status) {
      case "Pendiente":
        return "outline"
      case "Aprobado":
        return "secondary"
      case "Pedido":
        return "default"
      case "Recibido":
        return "default"
      case "Rechazado":
        return "destructive"
      default:
        return "outline"
    }
  }
  return getStatusVariant(status)
}

function getStatusVariant(status: string) {
  switch (status) {
    case PurchaseOrderStatus.PendingApproval:
      return "outline"
    case PurchaseOrderStatus.Approved:
      return "secondary"
    case PurchaseOrderStatus.Validated:
    case PurchaseOrderStatus.Received:
      return "default"
    case PurchaseOrderStatus.Rejected:
      return "destructive"
    default:
      return "outline"
  }
}

export function getUrgencyConfig(urgency?: string, priority?: string) {
  const urgencyLevel = urgency || priority || "medium"
  switch (urgencyLevel.toLowerCase()) {
    case "critical":
    case "alta":
    case "high":
      return { variant: "destructive" as const, icon: AlertCircle, label: "Crítica", color: "text-red-600", bgColor: "bg-red-50" }
    case "medium":
    case "media":
      return { variant: "default" as const, icon: Clock, label: "Media", color: "text-yellow-600", bgColor: "bg-yellow-50" }
    case "low":
    case "baja":
      return { variant: "secondary" as const, icon: Info, label: "Baja", color: "text-green-600", bgColor: "bg-green-50" }
    default:
      return { variant: "outline" as const, icon: Clock, label: "Normal", color: "text-gray-600", bgColor: "bg-gray-50" }
  }
}

export function getItemsList(items: unknown): string[] {
  if (!items) return []
  try {
    const itemsArray = typeof items === "string" ? JSON.parse(items) : items
    if (!Array.isArray(itemsArray)) return []
    return itemsArray.map((item: unknown) => {
      if (typeof item === "string") return item
      const o = item as Record<string, unknown>
      return (o.description ?? o.name ?? o.item ?? "Item") as string
    })
  } catch {
    return []
  }
}
