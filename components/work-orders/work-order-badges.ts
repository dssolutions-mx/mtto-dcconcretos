import {
  WorkOrderStatus,
  MaintenanceType,
  ServiceOrderPriority,
  PurchaseOrderStatus,
} from "@/types"

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
