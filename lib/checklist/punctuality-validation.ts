import type {
  PunctualityConfig,
  PunctualitySectionData,
  PunctualityStatus,
} from '@/types'

export const DEFAULT_PUNCTUALITY_CONFIG: PunctualityConfig = {
  require_production_flag: true,
}

const VALID_STATUSES = new Set<PunctualityStatus>([
  'on_time',
  'late',
  'absent',
])

export function normalizePunctualityConfig(
  config: Partial<PunctualityConfig> | null | undefined
): PunctualityConfig {
  return {
    require_production_flag: config?.require_production_flag ?? true,
  }
}

export function isValidPunctualityStatus(
  value: unknown
): value is PunctualityStatus {
  return typeof value === 'string' && VALID_STATUSES.has(value as PunctualityStatus)
}

export function isPunctualitySectionComplete(
  data: PunctualitySectionData | undefined,
  config: PunctualityConfig,
  operatorCount = 0
): boolean {
  if (!data) {
    return !config.require_production_flag
  }

  if (config.require_production_flag && data.had_production === null) {
    return false
  }

  if (data.had_production === false) {
    return true
  }

  if (data.had_production !== true) {
    return !config.require_production_flag
  }

  if (operatorCount <= 0) {
    return true
  }

  const ratedCount = (data.entries ?? []).filter(
    (entry) => entry.operator_id && isValidPunctualityStatus(entry.status)
  ).length

  const expected =
    data.operator_count && data.operator_count > 0
      ? data.operator_count
      : operatorCount

  return ratedCount >= expected
}

export function getPunctualitySectionProgress(
  data: PunctualitySectionData | undefined,
  config: PunctualityConfig
): { total: number; completed: number } {
  const normalized = normalizePunctualityConfig(config)

  if (normalized.require_production_flag) {
    if (!data || data.had_production === null) {
      return { total: 1, completed: 0 }
    }
    if (data.had_production === false) {
      return { total: 1, completed: 1 }
    }
  }

  const operatorTotal =
    data?.operator_count && data.operator_count > 0 ? data.operator_count : 1

  const ratedCount = (data?.entries ?? []).filter(
    (entry) => entry.operator_id && isValidPunctualityStatus(entry.status)
  ).length

  const productionStep = normalized.require_production_flag ? 1 : 0
  const productionDone =
    !normalized.require_production_flag || data?.had_production !== null ? 1 : 0

  const total = productionStep + operatorTotal
  const completed = productionDone + ratedCount

  return {
    total,
    completed: Math.min(completed, total),
  }
}

export function validatePunctualitySectionPayload(
  data: unknown
): data is PunctualitySectionData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false
  }

  const record = data as Record<string, unknown>

  if (
    record.had_production !== null &&
    typeof record.had_production !== 'boolean'
  ) {
    return false
  }

  if (record.operator_count != null && typeof record.operator_count !== 'number') {
    return false
  }

  if (record.entries != null) {
    if (!Array.isArray(record.entries)) return false
    for (const entry of record.entries) {
      if (!entry || typeof entry !== 'object') return false
      const row = entry as Record<string, unknown>
      if (typeof row.operator_id !== 'string') return false
      if (!isValidPunctualityStatus(row.status)) return false
      if (row.notes != null && typeof row.notes !== 'string') return false
    }
  }

  return true
}
