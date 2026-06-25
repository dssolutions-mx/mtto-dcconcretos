/**
 * Checklist section funnel — routes completion side-effects by lane.
 *
 * Lane A (maintenance): checklist (default), tire_readings, evidence → checklist_issues + OT
 * Lane B (operations_evaluation): cleanliness_bonus, security_talk,
 *   operator_punctuality, bonus_closure, and checklist sections with
 *   funnel_config.lane = 'operations_evaluation' → NO checklist_issues, NO OT
 *
 * Generic `checklist` sections can be marked Operaciones (RH) in the template
 * editor via funnel_config without changing section_type — use for items like
 * "Barcos limpios" in PLANTA REVISION GENERAL that are operational evaluations.
 */

export type SectionType =
  | 'checklist'
  | 'evidence'
  | 'cleanliness_bonus'
  | 'security_talk'
  | 'tire_readings'
  | 'operator_punctuality'
  | 'bonus_closure'

export type SectionFunnelLane = 'maintenance' | 'operations_evaluation'

export type SectionFunnelConfig = {
  lane: SectionFunnelLane
}

export const DEFAULT_FUNNEL_CONFIG: SectionFunnelConfig = {
  lane: 'maintenance',
}

export type SectionFunnelInput = {
  section_type?: string | null
  funnel_config?: SectionFunnelConfig | { lane?: string } | null
  /** Denormalized lane on completed_items payloads */
  funnel_lane?: SectionFunnelLane | string | null
}

export const SECTION_FUNNEL_LANE: Record<SectionType, SectionFunnelLane> = {
  checklist: 'maintenance',
  evidence: 'maintenance',
  tire_readings: 'maintenance',
  cleanliness_bonus: 'operations_evaluation',
  security_talk: 'operations_evaluation',
  operator_punctuality: 'operations_evaluation',
  bonus_closure: 'operations_evaluation',
}

const OPERATIONS_EVALUATION_SECTION_TYPES = new Set<SectionType>([
  'cleanliness_bonus',
  'security_talk',
  'operator_punctuality',
  'bonus_closure',
])

export function normalizeFunnelConfig(
  config?: { lane?: string } | null
): SectionFunnelConfig {
  if (config?.lane === 'operations_evaluation') {
    return { lane: 'operations_evaluation' }
  }
  return DEFAULT_FUNNEL_CONFIG
}

/** Legacy unresolved-issues route used "maintenance" as a default section_type label. */
function normalizeSectionType(
  sectionType: string | null | undefined
): SectionType | 'unknown' {
  if (!sectionType || sectionType === 'maintenance') {
    return 'checklist'
  }
  if (sectionType in SECTION_FUNNEL_LANE) {
    return sectionType as SectionType
  }
  return 'unknown'
}

function resolveExplicitLane(
  input: SectionFunnelInput
): SectionFunnelLane | null {
  const direct = input.funnel_lane ?? input.funnel_config?.lane
  if (direct === 'operations_evaluation' || direct === 'maintenance') {
    return direct
  }
  return null
}

export function getSectionFunnelLane(
  sectionOrType: string | SectionFunnelInput | null | undefined
): SectionFunnelLane {
  if (sectionOrType && typeof sectionOrType === 'object') {
    const explicit = resolveExplicitLane(sectionOrType)
    if (explicit) {
      return explicit
    }
    return getSectionFunnelLane(sectionOrType.section_type)
  }

  const normalized = normalizeSectionType(sectionOrType)
  if (normalized === 'unknown') {
    return 'maintenance'
  }
  return SECTION_FUNNEL_LANE[normalized]
}

export function isMaintenanceSection(
  sectionOrType: string | SectionFunnelInput | null | undefined
): boolean {
  return getSectionFunnelLane(sectionOrType) === 'maintenance'
}

export function isOperationsEvaluationSection(
  sectionOrType: string | SectionFunnelInput | null | undefined
): boolean {
  return getSectionFunnelLane(sectionOrType) === 'operations_evaluation'
}

/**
 * Whether a flagged/failed item should create a checklist_issues row and flow
 * into corrective work orders. Matches UI behavior in checklist-execution.
 */
export function shouldCreateChecklistIssue(
  sectionOrType: string | SectionFunnelInput | null | undefined
): boolean {
  if (isOperationsEvaluationSection(sectionOrType)) {
    return false
  }

  const sectionType =
    sectionOrType && typeof sectionOrType === 'object'
      ? sectionOrType.section_type
      : sectionOrType

  const normalized = normalizeSectionType(sectionType)
  if (normalized === 'tire_readings' || normalized === 'evidence') {
    return false
  }

  return normalized === 'checklist' || normalized === 'unknown'
}

export function itemHasMaintenanceIssue(item: {
  status?: string
  section_type?: string | null
  funnel_lane?: SectionFunnelLane | string | null
  funnel_config?: SectionFunnelConfig | { lane?: string } | null
}): boolean {
  return (
    (item.status === 'flag' || item.status === 'fail') &&
    shouldCreateChecklistIssue(item)
  )
}

export function completedItemsHaveMaintenanceIssues(
  items: Array<{
    status?: string
    section_type?: string | null
    funnel_lane?: SectionFunnelLane | string | null
    funnel_config?: SectionFunnelConfig | { lane?: string } | null
  }>
): boolean {
  return items.some(itemHasMaintenanceIssue)
}

/** Section types stored in completed_items that must never create checklist_issues. */
export const OPERATIONS_EVALUATION_SECTION_TYPE_LIST = [
  ...OPERATIONS_EVALUATION_SECTION_TYPES,
] as const

export function isOperationsEvaluationCompletedItem(item: {
  section_type?: string | null
  funnel_lane?: SectionFunnelLane | string | null
  funnel_config?: SectionFunnelConfig | { lane?: string } | null
}): boolean {
  return isOperationsEvaluationSection(item)
}
