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

/** Stage of the approval workflow. Only pending_approval POs are processed. */
export type WorkflowStage =
  | 'technical'   // Validación técnica - no authorized_by yet
  | 'viability'   // Viabilidad administrativa
  | 'final'       // Aprobación final

/**
 * Roles that can approve at Validación técnica (stage 1) in UI policy.
 * Must stay aligned with `checkTechnicalApprovalAuthority` (Gerente only) plus GM bypass where the app uses `checkGMEscalationAuthority` on first action.
 */
const TECHNICAL_APPROVAL_ROLES = new Set<string>([
  'GERENTE_MANTENIMIENTO',
  'GERENCIA_GENERAL',
])

/** Roles that can record viability (stage 2). */
const VIABILITY_RECORDING_ROLES = new Set<string>([
  'AREA_ADMINISTRATIVA',
  'GERENCIA_GENERAL',
])

/** Roles that can approve at Aprobación final when GM escalation applies. */
const FINAL_APPROVAL_ESCALATED_ROLES = new Set<string>(['GERENCIA_GENERAL'])

/** Roles that can approve at Aprobación final when no escalation (AREA_ADMINISTRATIVA needs limit). */
const FINAL_APPROVAL_NON_ESCALATED_ROLES = new Set<string>([
  'AREA_ADMINISTRATIVA',
  'GERENCIA_GENERAL',
])

export interface ResolveStageInput {
  authorizedBy: string | null
  viabilityState: string | null | undefined
  policy: WorkflowPolicyResult
  amount: number
}

const STAGE_DISPLAY: Record<WorkflowStage, { label: string; responsibleRole: string }> = {
  technical: { label: 'Validación técnica', responsibleRole: 'Gerente de Mantenimiento' },
  viability: { label: 'Viabilidad administrativa', responsibleRole: 'Área Administrativa' },
  final: { label: 'Aprobación final', responsibleRole: 'Gerencia General' },
}

/** Human-readable stage label and responsible role for UI. */
export function getStageDisplayInfo(stage: WorkflowStage) {
  return STAGE_DISPLAY[stage]
}

/**
 * Resolve the current workflow stage from PO state and policy.
 * Used by approval-context to determine which action (approve vs record viability) applies.
 */
export function resolveCurrentStage(input: ResolveStageInput): WorkflowStage {
  const { authorizedBy, viabilityState, policy, amount } = input

  if (!authorizedBy) {
    return 'technical'
  }

  const viabilityPending =
    policy.requiresViability &&
    (!viabilityState || viabilityState === 'pending')

  if (viabilityPending) {
    return 'viability'
  }

  return 'final'
}

export interface CanActorActAtStageInput {
  stage: WorkflowStage
  actorRole: string
  policy: WorkflowPolicyResult
  needsGMEscalation: boolean
  hasScope: boolean
  hasAuthLimit: boolean
  amountWithinLimit: boolean
}

/**
 * Policy-driven check: can the actor approve at the given stage?
 * Uses explicit role whitelists per stage. Roles not in any set never get canApprove.
 */
export function canActorApproveAtStage(input: CanActorActAtStageInput): boolean {
  const {
    stage,
    actorRole,
    needsGMEscalation,
    hasScope,
    hasAuthLimit,
    amountWithinLimit,
  } = input

  if (!hasScope) {
    return false
  }

  if (stage === 'technical') {
    return TECHNICAL_APPROVAL_ROLES.has(actorRole)
  }

  if (stage === 'viability') {
    return false // Viability stage: record viability, not approve
  }

  if (stage === 'final') {
    if (needsGMEscalation) {
      return FINAL_APPROVAL_ESCALATED_ROLES.has(actorRole)
    }
    // Non-escalated: AREA_ADMINISTRATIVA needs limit + within limit; GERENCIA_GENERAL always
    if (actorRole === 'GERENCIA_GENERAL') {
      return true
    }
    if (actorRole === 'AREA_ADMINISTRATIVA') {
      return hasAuthLimit && amountWithinLimit
    }
    return false
  }

  return false
}

/**
 * Policy-driven check: can the actor record viability at the given stage?
 */
export function canActorRecordViabilityAtStage(
  input: CanActorActAtStageInput
): boolean {
  const { stage, actorRole, hasScope } = input

  if (!hasScope) {
    return false
  }

  if (stage !== 'viability') {
    return false
  }

  return VIABILITY_RECORDING_ROLES.has(actorRole)
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
