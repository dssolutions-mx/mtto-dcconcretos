/**
 * Centralized work order status configuration for tabs and filters.
 * Only 2 operational tabs: Pendientes (all not completed) | Completadas.
 */

import { WorkOrderStatus } from "@/types"

/** Tab id → status values. */
export const WORK_ORDER_TAB_STATUS_MAP: Record<string, string[]> = {
  all: [],
  pending: [
    WorkOrderStatus.Pending,
    WorkOrderStatus.Programmed,
    WorkOrderStatus.WaitingParts,
  ],
  completed: [WorkOrderStatus.Completed],
}

/** Valid tab ids */
export const VALID_TAB_IDS = ["all", "pending", "completed"] as const

/** Legacy statuses that map to pending tab */
const LEGACY_PENDING = ['Cotizada', 'Aprobada', 'En ejecución', 'En Progreso', 'Esperando Partes', 'pendiente', 'en_progreso']

export function normalizeTab(tabFromUrl: string | null): string {
  if (!tabFromUrl) return "all"
  if (tabFromUrl === "approved" || tabFromUrl === "inprogress") return "pending"
  return VALID_TAB_IDS.includes(tabFromUrl as (typeof VALID_TAB_IDS)[number]) ? tabFromUrl : "all"
}

export function isPendingStatus(status: string | null): boolean {
  if (!status) return false
  return [WorkOrderStatus.Pending, WorkOrderStatus.Programmed, WorkOrderStatus.WaitingParts, ...LEGACY_PENDING].includes(status)
}

export function getStatusesForTab(tabId: string): string[] {
  return WORK_ORDER_TAB_STATUS_MAP[tabId] ?? []
}

/** Ribbon + tabs: Pendientes | Completadas */
export const WORK_ORDER_TAB_CONFIG = [
  { id: "pending", label: "Pendientes", statuses: WORK_ORDER_TAB_STATUS_MAP.pending },
  { id: "completed", label: "Completadas", statuses: [WorkOrderStatus.Completed] },
] as const

export function countByStatusSegment(
  orders: Array<{ status: string | null }>,
  segmentId: string
): number {
  if (segmentId === "all") return orders.length
  if (segmentId === "pending") return orders.filter((o) => isPendingStatus(o.status)).length
  if (segmentId === "completed") return orders.filter((o) => o.status === WorkOrderStatus.Completed).length
  const statuses = getStatusesForTab(segmentId)
  return orders.filter((o) => o.status && statuses.includes(o.status)).length
}
