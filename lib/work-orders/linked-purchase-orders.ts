import type { WorkOrderWithAsset } from "@/types"

/** Work order row enriched by `/api/work-orders/list` with linked POs */
export type WorkOrderListRow = WorkOrderWithAsset & {
  linked_purchase_orders?: Array<{ id: string; order_id?: string; status?: string | null }>
}

export function getLinkedPOIdsForWorkOrderRow(order: WorkOrderListRow): string[] {
  const linked = order.linked_purchase_orders ?? []
  if (linked.length > 0) return linked.map((p) => p.id)
  if (order.purchase_order_id) return [order.purchase_order_id as string]
  return []
}

export function ocStatusSummaryForRow(
  order: WorkOrderListRow,
  getPurchaseOrderStatus: (poId: string | null) => string
): string {
  const ids = getLinkedPOIdsForWorkOrderRow(order)
  if (ids.length === 0) return ""
  if (ids.length === 1) return getPurchaseOrderStatus(ids[0])
  const statuses = ids.map((id) => getPurchaseOrderStatus(id))
  const unique = [...new Set(statuses)]
  if (unique.length === 1) return `${unique[0]} (${ids.length} OCs)`
  return `${ids.length} OCs`
}
