/**
 * User-facing copy for PO creation review, derived from workflow-policy (single source of truth).
 */

import {
  GM_ESCALATION_THRESHOLD_MXN,
  resolveWorkflowPath,
  type WorkflowPolicyInput,
} from '@/lib/purchase-orders/workflow-policy'
import type { POPurpose } from '@/types/purchase-orders'

const PURPOSE_LABELS: Record<string, string> = {
  work_order_inventory: 'Uso de inventario (OT)',
  work_order_cash: 'Compra a proveedor (OT)',
  inventory_restock: 'Reabastecimiento de inventario',
  mixed: 'Combinado (almacén + proveedor)',
}

export function getPoPurposeLabelEs(purpose: POPurpose | string | null | undefined): string {
  if (!purpose || typeof purpose !== 'string') return 'Por determinar'
  const k = purpose.trim().toLowerCase()
  return PURPOSE_LABELS[k] ?? purpose
}

/**
 * Bullets for the pre-submit review modal. Uses resolveWorkflowPath only — no duplicated rules.
 */
export function getCreationWorkflowSummaryLines(input: WorkflowPolicyInput): string[] {
  const policy = resolveWorkflowPath(input)
  const amount = typeof input.approvalAmount === 'number' ? input.approvalAmount : 0
  const aboveThreshold = amount >= GM_ESCALATION_THRESHOLD_MXN
  const thresholdLabel = GM_ESCALATION_THRESHOLD_MXN.toLocaleString('es-MX', {
    maximumFractionDigits: 0,
  })

  const lines: string[] = []

  if (policy.requiresViability) {
    lines.push(
      'Tras la validación técnica, Administración debe confirmar viabilidad financiera antes de cerrar la aprobación.'
    )
  } else {
    lines.push('Esta ruta no requiere el paso de viabilidad administrativa.')
  }

  if (policy.requiresGMIfAboveThreshold) {
    if (aboveThreshold) {
      lines.push(
        `El monto de aprobación alcanza o supera $${thresholdLabel} MXN: puede requerirse Gerencia General en el paso final, según el tipo de OT.`
      )
    } else {
      lines.push(
        `Por debajo de $${thresholdLabel} MXN en monto de aprobación no aplica escalamiento a Gerencia General solo por umbral (en esta ruta).`
      )
    }
  } else if (policy.skipGM) {
    lines.push(
      'Con esta combinación de propósito y tipo de OT, la política actual no exige Gerencia General por umbral de monto.'
    )
  }

  lines.push(`Referencia de política: vía ${policy.path}.`)

  return lines
}
