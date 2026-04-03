import type { OperatorIncidentWorkOrder } from '@/types/operator-incidents'
import {
  operatorPartsProcurementShortLabel,
  type OperatorPartsProcurement,
} from '@/lib/operator-incident-procurement'

export function trafficLightForOpenCount(open: number): 'green' | 'yellow' | 'red' {
  if (open <= 0) return 'green'
  if (open <= 5) return 'yellow'
  return 'red'
}

function woIsCompleted(wo: OperatorIncidentWorkOrder): boolean {
  if (!wo) return false
  const st = (wo.status || '').toLowerCase()
  return st === 'completada' || st === 'completed' || !!wo.completed_at
}

export function workOrderStatusLabelForOperator(wo: OperatorIncidentWorkOrder): string {
  if (!wo) return 'Sin orden'
  if (woIsCompleted(wo)) return 'Listo'
  const st = (wo.status || '').toLowerCase()
  if (wo.planned_date) {
    try {
      const d = new Date(wo.planned_date)
      const dateStr = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
      return `Programado · ${dateStr}`
    } catch {
      return 'Programado'
    }
  }
  if (st === 'pendiente' || st === 'pending') return 'En espera'
  return wo.status || 'En proceso'
}

/** Second line for list rows: procurement only (scheduling is in the badge via workOrderStatusLabelForOperator). */
export function operatorIncidentSecondaryLine(
  wo: OperatorIncidentWorkOrder
): string | null {
  if (!wo || woIsCompleted(wo)) return null
  const parts: OperatorPartsProcurement =
    wo.parts_procurement ?? { stage: 'none', expected_delivery_date: null }
  return operatorPartsProcurementShortLabel(parts)
}

export function friendlyIncidentTypeLabel(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('mecán') || t.includes('mecan')) return 'Mecánico'
  if (t.includes('hidrául')) return 'Hidráulico'
  if (t.includes('eléct') || t.includes('elect')) return 'Eléctrico'
  if (t.includes('accidente')) return 'Accidente'
  if (t.includes('manten')) return 'Mantenimiento'
  return type
}
