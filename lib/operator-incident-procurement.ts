/**
 * Sanitized purchase-order progression for operator incident views.
 * No commercial fields — stage is derived from status / fulfillment only.
 */

import type { OperatorRouteSupabase } from '@/lib/operator-incidents-supabase'

export type OperatorPartsProcurementStage =
  | 'none'
  | 'ordered'
  | 'pending_approval'
  | 'approved'
  | 'awaiting_delivery'
  | 'received'

export type OperatorPartsProcurement = {
  stage: OperatorPartsProcurementStage
  expected_delivery_date: string | null
}

export type PurchaseOrderRowForOperator = {
  id: string
  work_order_id: string | null
  status: string | null
  enhanced_status: string | null
  expected_delivery_date: string | null
  fulfilled_at: string | null
  inventory_fulfilled: boolean | null
  received_to_inventory: boolean | null
}

const STAGE_RANK: Record<OperatorPartsProcurementStage, number> = {
  none: 0,
  ordered: 1,
  pending_approval: 2,
  approved: 3,
  awaiting_delivery: 4,
  received: 5,
}

function rank(s: OperatorPartsProcurementStage): number {
  return STAGE_RANK[s]
}

function mapSinglePoToStage(row: PurchaseOrderRowForOperator): OperatorPartsProcurementStage {
  if (row.fulfilled_at || row.inventory_fulfilled || row.received_to_inventory) {
    return 'received'
  }
  const es = (row.enhanced_status || '').toLowerCase().trim()
  const legacy = (row.status || '').toLowerCase().trim()

  const key = es || legacy

  switch (key) {
    case 'received':
    case 'fulfilled':
    case 'validated':
      return 'received'
    case 'ordered':
    case 'purchased':
    case 'receipt_uploaded':
      return 'awaiting_delivery'
    case 'approved':
      return 'approved'
    case 'pending_approval':
      return 'pending_approval'
    case 'draft':
    case 'quoted':
      return 'ordered'
    case 'rejected':
      return 'none'
    default:
      if (legacy.includes('recib') || legacy.includes('cumpl')) return 'received'
      if (legacy.includes('pedid') || legacy.includes('compr')) return 'awaiting_delivery'
      if (legacy.includes('aprob')) return 'approved'
      if (legacy.includes('pend')) return 'pending_approval'
      if (legacy.includes('borrador') || legacy.includes('cotiz')) return 'ordered'
      return 'ordered'
  }
}

/** Merge multiple POs for one work order — furthest stage wins; earliest expected date among in-flight POs. */
export function mergeOperatorPartsProcurement(
  rows: PurchaseOrderRowForOperator[]
): OperatorPartsProcurement {
  if (!rows.length) {
    return { stage: 'none', expected_delivery_date: null }
  }

  let best: OperatorPartsProcurementStage = 'none'
  let bestR = 0
  for (const r of rows) {
    const s = mapSinglePoToStage(r)
    const rr = rank(s)
    if (rr > bestR) {
      bestR = rr
      best = s
    }
  }

  let expected: string | null = null
  for (const r of rows) {
    if (!r.expected_delivery_date) continue
    const s = mapSinglePoToStage(r)
    if (s === 'received') continue
    const d = r.expected_delivery_date
    if (!expected || d < expected) expected = d
  }

  return { stage: best, expected_delivery_date: expected }
}

/** Short line for list rows (no supplier, no amounts). */
export function operatorPartsProcurementShortLabel(p: OperatorPartsProcurement): string | null {
  if (p.stage === 'none') return null
  switch (p.stage) {
    case 'ordered':
      return 'Refacciones: solicitud en curso'
    case 'pending_approval':
      return 'Refacciones: pendiente de aprobación'
    case 'approved':
      return 'Refacciones: compra aprobada'
    case 'awaiting_delivery':
      return p.expected_delivery_date
        ? `Refacciones: esperando entrega (${formatShortDate(p.expected_delivery_date)})`
        : 'Refacciones: esperando entrega'
    case 'received':
      return 'Refacciones: recibidas'
    default:
      return null
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return iso
  }
}

/** Longer paragraph for detail card. */
export function operatorPartsProcurementDetailCopy(p: OperatorPartsProcurement): string | null {
  if (p.stage === 'none') return null
  switch (p.stage) {
    case 'ordered':
      return 'Se solicitó la compra de refacciones relacionadas con esta orden.'
    case 'pending_approval':
      return 'La compra de refacciones está pendiente de aprobación.'
    case 'approved':
      return 'La compra de refacciones fue aprobada.'
    case 'awaiting_delivery':
      return p.expected_delivery_date
        ? `Se está esperando la entrega de refacciones. Entrega estimada: ${new Date(p.expected_delivery_date).toLocaleDateString('es-MX', { dateStyle: 'medium' })}.`
        : 'Se está esperando la entrega de refacciones.'
    case 'received':
      return 'Las refacciones ya fueron recibidas.'
    default:
      return null
  }
}

export type OperatorIncidentTimelineItem = {
  id: string
  label: string
  done: boolean
}

export function buildOperatorIncidentTimeline(args: {
  planned_date: string | null
  wo_status: string | null
  wo_completed_at: string | null
  parts: OperatorPartsProcurement
}): OperatorIncidentTimelineItem[] {
  const items: OperatorIncidentTimelineItem[] = []
  const woDone =
    (args.wo_status || '').toLowerCase() === 'completada' ||
    (args.wo_status || '').toLowerCase() === 'completed' ||
    !!args.wo_completed_at

  items.push({
    id: 'planned',
    label: args.planned_date
      ? `Revisión programada: ${new Date(args.planned_date).toLocaleDateString('es-MX', { dateStyle: 'medium' })}`
      : 'Revisión programada',
    done: !!args.planned_date,
  })

  const p = args.parts
  const partsStarted = p.stage !== 'none'
  items.push({
    id: 'parts_request',
    label: 'Compra de refacciones',
    done: partsStarted,
  })
  items.push({
    id: 'parts_approval',
    label: 'Aprobación de compra',
    done: rank(p.stage) >= rank('approved'),
  })
  items.push({
    id: 'parts_delivery',
    label: 'Entrega de refacciones',
    done: rank(p.stage) >= rank('awaiting_delivery'),
  })
  items.push({
    id: 'parts_received',
    label: 'Refacciones en planta',
    done: p.stage === 'received',
  })
  items.push({
    id: 'wo_done',
    label: 'Trabajo completado',
    done: woDone,
  })

  return items
}

export function operatorIncidentHasProgress(args: {
  planned_date: string | null
  parts: OperatorPartsProcurement
}): boolean {
  return !!args.planned_date || args.parts.stage !== 'none'
}

/** Collect PO rows linked to a work order (by work_order_id or by WO.purchase_order_id). */
export function purchaseOrdersForWorkOrder(
  all: PurchaseOrderRowForOperator[],
  workOrderId: string,
  purchaseOrderId: string | null | undefined
): PurchaseOrderRowForOperator[] {
  const byId = new Map<string, PurchaseOrderRowForOperator>()
  for (const p of all) {
    if (p.work_order_id === workOrderId || (purchaseOrderId && p.id === purchaseOrderId)) {
      byId.set(p.id, p)
    }
  }
  return [...byId.values()]
}

const PO_SELECT_FOR_OPERATOR =
  'id, work_order_id, status, enhanced_status, expected_delivery_date, fulfilled_at, inventory_fulfilled, received_to_inventory' as const

/** Load purchase orders for a batch of work orders (sanitized columns only). */
export async function fetchPurchaseOrdersForOperatorWorkOrders(
  supabase: OperatorRouteSupabase,
  workOrderIds: string[],
  purchaseOrderIds: (string | null | undefined)[]
): Promise<PurchaseOrderRowForOperator[]> {
  const woIds = [...new Set(workOrderIds.filter(Boolean))]
  const poIds = [...new Set(purchaseOrderIds.filter((x): x is string => !!x))]
  const rows: PurchaseOrderRowForOperator[] = []
  const seen = new Set<string>()

  if (woIds.length > 0) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(PO_SELECT_FOR_OPERATOR)
      .in('work_order_id', woIds)
    if (error) {
      console.error('operator incidents: PO by work_order_id', error)
    }
    const batch1 = (data || []) as PurchaseOrderRowForOperator[]
    for (const r of batch1) {
      if (!seen.has(r.id)) {
        seen.add(r.id)
        rows.push(r)
      }
    }
  }

  const needById = poIds.filter((id) => !seen.has(id))
  if (needById.length > 0) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(PO_SELECT_FOR_OPERATOR)
      .in('id', needById)
    if (error) {
      console.error('operator incidents: PO by id', error)
    }
    const batch2 = (data || []) as PurchaseOrderRowForOperator[]
    for (const r of batch2) {
      if (!seen.has(r.id)) {
        seen.add(r.id)
        rows.push(r)
      }
    }
  }

  return rows
}
