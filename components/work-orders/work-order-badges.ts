import {
  WorkOrderStatus,
  MaintenanceType,
  ServiceOrderPriority,
  PurchaseOrderStatus,
} from "@/types"

/** Tailwind classes for status dot (e.g. "bg-green-500") */
export function getStatusDotClass(status: string | null): string {
  switch (status) {
    case WorkOrderStatus.Completed:
      return "bg-green-500"
    case WorkOrderStatus.InProgress:
      return "bg-blue-500"
    case WorkOrderStatus.Pending:
    case WorkOrderStatus.Quoted:
    case WorkOrderStatus.Approved:
      return "bg-slate-400"
    default:
      return "bg-slate-400"
  }
}

/** Tailwind classes for left border by status (e.g. "border-l-green-500") */
export function getStatusBorderClass(status: string | null): string {
  switch (status) {
    case WorkOrderStatus.Completed:
      return "border-l-green-500"
    case WorkOrderStatus.InProgress:
      return "border-l-blue-500"
    case WorkOrderStatus.Pending:
    case WorkOrderStatus.Quoted:
    case WorkOrderStatus.Approved:
      return "border-l-slate-400"
    default:
      return "border-l-slate-400"
  }
}

/** Tailwind classes for priority dot/badge: Critical=red, High=orange, Medium=gray */
export function getPriorityDotClass(priority: string | null): string {
  switch (priority) {
    case ServiceOrderPriority.Critical:
      return "bg-red-500"
    case ServiceOrderPriority.High:
      return "bg-amber-500"
    case ServiceOrderPriority.Medium:
    case ServiceOrderPriority.Low:
    default:
      return "bg-slate-400"
  }
}

export function getPriorityVariant(priority: string | null) {
  switch (priority) {
    case ServiceOrderPriority.Critical:
      return "destructive"
    case ServiceOrderPriority.High:
      return "secondary"
    default:
      return "outline"
  }
}

export function getStatusVariant(status: string | null) {
  switch (status) {
    case WorkOrderStatus.Completed:
      return "default"
    case WorkOrderStatus.InProgress:
      return "secondary"
    case WorkOrderStatus.Pending:
    case WorkOrderStatus.Quoted:
    case WorkOrderStatus.Approved:
      return "outline"
    default:
      return "outline"
  }
}

export function getTypeVariant(type: string | null) {
  switch (type) {
    case MaintenanceType.Preventive:
      return "outline"
    case MaintenanceType.Corrective:
      return "destructive"
    default:
      return "secondary"
  }
}

export function getPurchaseOrderStatusVariant(status: string) {
  switch (status) {
    case PurchaseOrderStatus.PendingApproval:
    case "pending":
    case "Pending":
      return "outline"
    case PurchaseOrderStatus.Approved:
    case "approved":
    case "Approved":
      return "secondary"
    case PurchaseOrderStatus.Validated:
    case "ordered":
    case "Ordered":
      return "default"
    case PurchaseOrderStatus.Received:
    case "received":
    case "Received":
      return "default"
    case PurchaseOrderStatus.Rejected:
    case "rejected":
    case "Rejected":
      return "destructive"
    default:
      return "outline"
  }
}

export function getPurchaseOrderStatusClass(status: string) {
  switch (status) {
    case PurchaseOrderStatus.PendingApproval:
    case "pending":
    case "Pending":
      return "bg-yellow-50 text-yellow-800"
    case PurchaseOrderStatus.Approved:
    case "approved":
    case "Approved":
      return "bg-blue-50 text-blue-800"
    case PurchaseOrderStatus.Validated:
    case "ordered":
    case "Ordered":
      return "bg-indigo-50 text-indigo-800"
    case PurchaseOrderStatus.Received:
    case "received":
    case "Received":
      return "bg-green-100 text-green-800"
    case PurchaseOrderStatus.Rejected:
    case "rejected":
    case "Rejected":
      return "bg-red-50 text-red-800"
    default:
      return ""
  }
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A"
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return dateString
    }
    return new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date)
  } catch (error) {
    console.warn("Error formatting date:", dateString, error)
    return dateString
  }
}

/** Relative date for list UX: "Hoy", "Mañana", "Hace 3 días", or short absolute */
export function formatDateRelative(dateString: string | null): string {
  if (!dateString) return "—"
  try {
    const date = new Date(dateString)
    date.setHours(0, 0, 0, 0)
    if (isNaN(date.getTime())) return dateString
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffMs = date.getTime() - today.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "Hoy"
    if (diffDays === 1) return "Mañana"
    if (diffDays === -1) return "Ayer"
    if (diffDays >= -6 && diffDays <= -2) return `Hace ${Math.abs(diffDays)} días`
    if (diffDays >= 2 && diffDays <= 6) return `En ${diffDays} días`
    return new Intl.DateTimeFormat("es-ES", { month: "short", day: "numeric" }).format(date)
  } catch {
    return dateString
  }
}
