/**
 * Purchase order workflow policy.
 * Codifies the four PO paths and approval rules.
 * Used by advance-workflow, authorization, and email approval.
 */

import type {
  POPurpose,
  PurchaseOrderPaymentCondition,
  PurchaseOrderWorkOrderType,
} from '@/types/purchase-orders'

/** GM escalation threshold in MXN */
export const GM_ESCALATION_THRESHOLD_MXN = 7000

export type WorkflowPath =
  | 'A' // work_order_inventory + preventive
  | 'B' // work_order_inventory + corrective
  | 'C' // inventory_restock
  | 'D' // work_order_cash or mixed

export interface WorkflowPolicyInput {
  poPurpose: POPurpose | string | null
  workOrderType: PurchaseOrderWorkOrderType | string | null
  approvalAmount: number
  paymentCondition?: PurchaseOrderPaymentCondition | string | null
}

export interface WorkflowPolicyResult {
  path: WorkflowPath
  requiresViability: boolean
  requiresGMIfAboveThreshold: boolean
  skipAdministration: boolean
  skipGM: boolean
  gmThreshold: number
}

const VALID_PURPOSES: readonly POPurpose[] = [
  'work_order_inventory',
  'work_order_cash',
  'inventory_restock',
  'mixed',
] as const

function normalizePurpose(
  purpose: POPurpose | string | null
): POPurpose | null {
  if (!purpose || typeof purpose !== 'string') {
    return null
  }
  const p = purpose.trim().toLowerCase()
  const found = VALID_PURPOSES.find((v) => v === p)
  return found ?? null
}

function normalizeWorkOrderType(
  type: PurchaseOrderWorkOrderType | string | null
): PurchaseOrderWorkOrderType | null {
  if (!type || typeof type !== 'string') {
    return null
  }
  const t = type.trim().toLowerCase()
  if (t === 'preventive' || t === 'preventivo') {
    return 'preventive'
  }
  if (t === 'corrective' || t === 'correctivo') {
    return 'corrective'
  }
  return null
}

/**
 * Resolve the workflow path from PO routing context.
 */
export function resolveWorkflowPath(
  input: WorkflowPolicyInput
): WorkflowPolicyResult {
  const purpose = normalizePurpose(input.poPurpose)
  const workOrderType = normalizeWorkOrderType(input.workOrderType)
  const amount = typeof input.approvalAmount === 'number' ? input.approvalAmount : 0
  const aboveThreshold = amount >= GM_ESCALATION_THRESHOLD_MXN

  // Path A: work_order_inventory + preventive
  // Technical approval -> warehouse release, skip admin and GM
  if (purpose === 'work_order_inventory' && workOrderType === 'preventive') {
    return {
      path: 'A',
      requiresViability: false,
      requiresGMIfAboveThreshold: false,
      skipAdministration: true,
      skipGM: true,
      gmThreshold: GM_ESCALATION_THRESHOLD_MXN,
    }
  }

  // Path B: work_order_inventory + corrective
  // Technical approval -> GM only if >= 7000
  if (purpose === 'work_order_inventory' && workOrderType === 'corrective') {
    return {
      path: 'B',
      requiresViability: false,
      requiresGMIfAboveThreshold: aboveThreshold,
      skipAdministration: true,
      skipGM: !aboveThreshold,
      gmThreshold: GM_ESCALATION_THRESHOLD_MXN,
    }
  }

  // Path C: inventory_restock
  // Technical approval -> viability -> GM if >= 7000
  if (purpose === 'inventory_restock') {
    return {
      path: 'C',
      requiresViability: true,
      requiresGMIfAboveThreshold: aboveThreshold,
      skipAdministration: false,
      skipGM: !aboveThreshold,
      gmThreshold: GM_ESCALATION_THRESHOLD_MXN,
    }
  }

  // Path D: work_order_cash or mixed
  // D1 preventive: Technical approval -> viability -> CxP, no GM
  // D2 corrective: Technical approval -> viability -> GM if >= 7000
  if (purpose === 'work_order_cash' || purpose === 'mixed') {
    const isPreventive = workOrderType === 'preventive'
    return {
      path: 'D',
      requiresViability: true,
      requiresGMIfAboveThreshold: !isPreventive && aboveThreshold,
      skipAdministration: false,
      skipGM: isPreventive,
      gmThreshold: GM_ESCALATION_THRESHOLD_MXN,
    }
  }

  // Fallback: treat as Path D (most common external/mixed flow)
  return {
    path: 'D',
    requiresViability: true,
    requiresGMIfAboveThreshold: aboveThreshold,
    skipAdministration: false,
    skipGM: false,
    gmThreshold: GM_ESCALATION_THRESHOLD_MXN,
  }
}

/**
 * Whether Administration viability is required for this PO.
 * Paths A and B skip; Paths C and D require.
 */
export function requiresAdministrationViability(
  input: WorkflowPolicyInput
): boolean {
  return resolveWorkflowPath(input).requiresViability
}

/**
 * Whether GM escalation is required (amount >= 7000 MXN and path requires it).
 */
export function requiresGMEscalation(input: WorkflowPolicyInput): boolean {
  const result = resolveWorkflowPath(input)
  return result.requiresGMIfAboveThreshold
}

/**
 * Whether Administration step is skipped for this PO.
 */
export function skipsAdministration(input: WorkflowPolicyInput): boolean {
  return resolveWorkflowPath(input).skipAdministration
}

/**
 * Whether GM approval step is skipped for this PO.
 */
export function skipsGM(input: WorkflowPolicyInput): boolean {
  return resolveWorkflowPath(input).skipGM
}

/**
 * Human-readable next step for Administration/viability stage.
 * Used by WorkflowStatusDisplay to show correct next action per path.
 */
export function getNextStepForAdministration(
  input: WorkflowPolicyInput,
  currentStatus: string,
  viabilityState: string | null | undefined
): string {
  const policy = resolveWorkflowPath(input)
  if (policy.skipAdministration) {
    return 'No requiere revisión administrativa (Path A/B)'
  }
  if (currentStatus !== 'pending_approval') {
    return 'Esperando aprobación técnica'
  }
  if (policy.requiresViability) {
    if (!viabilityState || viabilityState === 'pending') {
      return 'Revisión de viabilidad administrativa pendiente'
    }
    if (viabilityState === 'viable') {
      return policy.requiresGMIfAboveThreshold
        ? 'Viabilidad OK. Pendiente aprobación de Gerencia General'
        : 'Viabilidad OK. Listo para aprobación final (CxP)'
    }
    if (viabilityState === 'not_viable') {
      return 'Orden marcada como no viable'
    }
  }
  return 'Continuar con el siguiente paso'
}
