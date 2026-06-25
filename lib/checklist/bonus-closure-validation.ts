import type {
  BonusClosureConfig,
  BonusClosureDecision,
  BonusClosureSectionData,
} from '@/types'

export const DEFAULT_BONUS_CLOSURE_CONFIG: BonusClosureConfig = {
  bonus_type: 'cleanliness',
  deadline_day: 24,
  suggest_eligibility_threshold: 0.8,
}

export function normalizeBonusClosureConfig(
  config: Partial<BonusClosureConfig> | null | undefined
): BonusClosureConfig {
  return {
    bonus_type: config?.bonus_type ?? 'cleanliness',
    deadline_day: config?.deadline_day ?? 24,
    suggest_eligibility_threshold:
      config?.suggest_eligibility_threshold ?? 0.8,
  }
}

export function systemSuggestedEligible(
  weeklyPassRate: number,
  config: BonusClosureConfig
): boolean {
  return weeklyPassRate >= config.suggest_eligibility_threshold
}

export function isBonusClosureDecisionComplete(
  decision: BonusClosureDecision | undefined
): boolean {
  if (!decision?.operator_id) return false
  if (typeof decision.eligible !== 'boolean') return false
  if (!decision.eligible) {
    return Boolean(decision.ineligible_reason?.trim())
  }
  return true
}

export function isBonusClosureSectionComplete(
  data: BonusClosureSectionData | undefined,
  operatorCount = 0
): boolean {
  if (!data?.decisions?.length) {
    return operatorCount <= 0
  }
  if (operatorCount > 0 && data.decisions.length < operatorCount) {
    return false
  }
  return data.decisions.every((decision) => isBonusClosureDecisionComplete(decision))
}

export function getBonusClosureSectionProgress(
  data: BonusClosureSectionData | undefined,
  operatorCount = 0
): { total: number; completed: number } {
  const total = operatorCount > 0 ? operatorCount : (data?.decisions?.length ?? 0)
  if (total === 0) return { total: 0, completed: 0 }

  const completed = (data?.decisions ?? []).filter((decision) =>
    isBonusClosureDecisionComplete(decision)
  ).length

  return { total, completed: Math.min(completed, total) }
}

export function validateBonusClosureSectionPayload(
  data: unknown
): data is BonusClosureSectionData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false

  const record = data as Record<string, unknown>
  if (record.period_year != null && typeof record.period_year !== 'number') return false
  if (record.period_month != null && typeof record.period_month !== 'number') return false

  if (!Array.isArray(record.decisions)) return false

  for (const entry of record.decisions) {
    if (!entry || typeof entry !== 'object') return false
    const row = entry as Record<string, unknown>
    if (typeof row.operator_id !== 'string') return false
    if (typeof row.weekly_pass_rate !== 'number') return false
    if (!Array.isArray(row.evaluation_ids)) return false
    if (typeof row.system_suggested_eligible !== 'boolean') return false
    if (typeof row.eligible !== 'boolean') return false
    if (!row.eligible && typeof row.ineligible_reason !== 'string') return false
    if (row.ineligible_reason != null && typeof row.ineligible_reason !== 'string') {
      return false
    }
  }

  return true
}

export function buildInitialBonusClosureDecision(
  operator: {
    id: string
    nombre: string
    apellido: string
    employee_code?: string
  },
  prefill: {
    weekly_pass_rate: number
    evaluation_ids: string[]
  } | undefined,
  config: BonusClosureConfig
): BonusClosureDecision {
  const weeklyPassRate = prefill?.weekly_pass_rate ?? 0
  const suggested = systemSuggestedEligible(weeklyPassRate, config)
  return {
    operator_id: operator.id,
    operator_name: `${operator.nombre} ${operator.apellido}`.trim(),
    employee_code: operator.employee_code,
    weekly_pass_rate: weeklyPassRate,
    evaluation_ids: prefill?.evaluation_ids ?? [],
    system_suggested_eligible: suggested,
    eligible: suggested,
    ineligible_reason: suggested ? undefined : '',
  }
}
