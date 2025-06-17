"use client"

import { Badge } from "@/components/ui/badge"
import { Store, Wrench, Building2, HelpCircle } from "lucide-react"
import { PurchaseOrderType } from "@/types/purchase-orders"

interface TypeBadgeProps {
  type: PurchaseOrderType
  showIcon?: boolean
  variant?: "default" | "secondary" | "outline" | "destructive"
  size?: "sm" | "default" | "lg"
  className?: string
}

export function TypeBadge({ 
  type, 
  showIcon = true, 
  variant = "outline",
  size = "default",
  className = ""
}: TypeBadgeProps) {
  const getTypeConfig = (type: PurchaseOrderType) => {
    switch (type) {
      case PurchaseOrderType.DIRECT_PURCHASE:
        return {
          label: "Compra Directa",
          shortLabel: "Directa",
          icon: Store,
          color: "text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100",
          iconColor: "text-blue-600"
        }
      case PurchaseOrderType.DIRECT_SERVICE:
        return {
          label: "Servicio Directo", 
          shortLabel: "Servicio",
          icon: Wrench,
          color: "text-green-700 bg-green-50 border-green-200 hover:bg-green-100",
          iconColor: "text-green-600"
        }
      case PurchaseOrderType.SPECIAL_ORDER:
        return {
          label: "Pedido Especial",
          shortLabel: "Especial",
          icon: Building2,
          color: "text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100",
          iconColor: "text-purple-600"
        }
      default:
        return {
          label: "Desconocido",
          shortLabel: "N/A",
          icon: HelpCircle,
          color: "text-gray-700 bg-gray-50 border-gray-200 hover:bg-gray-100",
          iconColor: "text-gray-600"
        }
    }
  }

  const config = getTypeConfig(type)
  const Icon = config.icon

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    default: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  }

  const iconSizes = {
    sm: "h-3 w-3",
    default: "h-3.5 w-3.5", 
    lg: "h-4 w-4"
  }

  const displayLabel = size === "sm" ? config.shortLabel : config.label

  return (
    <Badge 
      variant={variant}
      className={`
        ${config.color} 
        ${sizeClasses[size]} 
        inline-flex items-center gap-1.5 font-medium
        ${className}
      `}
    >
      {showIcon && (
        <Icon className={`${iconSizes[size]} ${config.iconColor}`} />
      )}
      {displayLabel}
    </Badge>
  )
}

// Utility function to get type display name
export function getTypeDisplayName(type: PurchaseOrderType): string {
  switch (type) {
    case PurchaseOrderType.DIRECT_PURCHASE:
      return "Compra Directa"
    case PurchaseOrderType.DIRECT_SERVICE:
      return "Servicio Directo"
    case PurchaseOrderType.SPECIAL_ORDER:
      return "Pedido Especial"
    default:
      return type
  }
}

// Utility function to get type icon
export function getTypeIcon(type: PurchaseOrderType) {
  switch (type) {
    case PurchaseOrderType.DIRECT_PURCHASE:
      return Store
    case PurchaseOrderType.DIRECT_SERVICE:
      return Wrench
    case PurchaseOrderType.SPECIAL_ORDER:
      return Building2
    default:
      return HelpCircle
  }
}

// Utility function to get type color classes
export function getTypeColors(type: PurchaseOrderType) {
  switch (type) {
    case PurchaseOrderType.DIRECT_PURCHASE:
      return {
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-200",
        icon: "text-blue-600",
        hover: "hover:bg-blue-100"
      }
    case PurchaseOrderType.DIRECT_SERVICE:
      return {
        bg: "bg-green-50",
        text: "text-green-700", 
        border: "border-green-200",
        icon: "text-green-600",
        hover: "hover:bg-green-100"
      }
    case PurchaseOrderType.SPECIAL_ORDER:
      return {
        bg: "bg-purple-50",
        text: "text-purple-700",
        border: "border-purple-200", 
        icon: "text-purple-600",
        hover: "hover:bg-purple-100"
      }
    default:
      return {
        bg: "bg-gray-50",
        text: "text-gray-700",
        border: "border-gray-200",
        icon: "text-gray-600", 
        hover: "hover:bg-gray-100"
      }
  }
} 