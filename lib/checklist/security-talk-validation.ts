import type { SecurityConfig } from '@/types'

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  mode: 'operator',
  require_attendance: true,
  require_topic: true,
  require_reflection: true,
  allow_evidence: false,
}

export function normalizeSecurityConfig(
  config: Partial<SecurityConfig> | Record<string, unknown> | string | null | undefined
): SecurityConfig {
  let parsed: Partial<SecurityConfig> | Record<string, unknown> = {}
  if (typeof config === 'string') {
    try {
      const json = JSON.parse(config) as Partial<SecurityConfig>
      if (json && typeof json === 'object') parsed = json
    } catch {
      parsed = {}
    }
  } else if (config && typeof config === 'object') {
    parsed = config as Partial<SecurityConfig>
  }

  const input = parsed

  return {
    mode: input.mode === 'plant_manager' ? 'plant_manager' : 'operator',
    require_attendance: input.require_attendance ?? true,
    require_topic: input.require_topic ?? true,
    require_reflection: input.require_reflection ?? true,
    allow_evidence: input.allow_evidence ?? false,
  }
}

export type ExecutionSectionLike = {
  section_type?: string | null
  security_config?: unknown
  punctuality_config?: unknown
  bonus_closure_config?: unknown
  tire_readings_config?: unknown
  evidence_config?: unknown
  cleanliness_config?: unknown
}

/**
 * Resolve the effective section type during checklist execution.
 * Some legacy rows only persisted security_config without section_type.
 */
export function resolveExecutionSectionType(
  section: ExecutionSectionLike | null | undefined
): string {
  const explicit = section?.section_type?.trim()
  if (explicit && explicit !== 'checklist' && explicit !== 'maintenance') {
    return explicit
  }

  const securityConfig = section?.security_config
  if (securityConfig) {
    if (typeof securityConfig === 'object') return 'security_talk'
    if (typeof securityConfig === 'string' && securityConfig.trim()) {
      try {
        const parsed = JSON.parse(securityConfig)
        if (parsed && typeof parsed === 'object') return 'security_talk'
      } catch {
        // ignore malformed JSON
      }
    }
  }
  if (section?.punctuality_config && typeof section.punctuality_config === 'object') {
    return 'operator_punctuality'
  }
  if (section?.bonus_closure_config && typeof section.bonus_closure_config === 'object') {
    return 'bonus_closure'
  }
  if (section?.tire_readings_config && typeof section.tire_readings_config === 'object') {
    return 'tire_readings'
  }
  if (section?.evidence_config && typeof section.evidence_config === 'object') {
    return 'evidence'
  }
  if (section?.cleanliness_config && typeof section.cleanliness_config === 'object') {
    return 'cleanliness_bonus'
  }

  return explicit || 'checklist'
}

export type SecurityTalkExecutorContext = {
  role?: string | null
  business_role?: string | null
}

const FIELD_EXECUTOR_ROLES = new Set(['OPERADOR', 'MECANICO'])

const PLANT_STAFF_EXECUTOR_ROLES = new Set([
  'DOSIFICADOR',
  'JEFE_PLANTA',
  'JEFE DE PLANTA',
  'COORDINADOR',
  'SUPERVISOR',
])

function normalizeExecutorRoleKey(role: string | null | undefined): string {
  return (role ?? '').trim().toUpperCase()
}

function resolveExecutorRoleKeys(
  executorOrRole: string | null | undefined | SecurityTalkExecutorContext
): string[] {
  const executor: SecurityTalkExecutorContext =
    typeof executorOrRole === 'object' && executorOrRole !== null
      ? executorOrRole
      : { role: executorOrRole }

  return [executor.role, executor.business_role]
    .map(normalizeExecutorRoleKey)
    .filter(Boolean)
}

/**
 * Pick the UI mode for security talk based on template config and executor role.
 * Field operators always get the self-attendance form even if the template
 * was authored for plant-manager mode (e.g. shared PLANTA presets).
 */
export function resolveSecurityTalkUiMode(
  config: SecurityConfig,
  executorOrRole: string | null | undefined | SecurityTalkExecutorContext
): SecurityConfig['mode'] {
  const roleKeys = resolveExecutorRoleKeys(executorOrRole)

  if (roleKeys.some((role) => FIELD_EXECUTOR_ROLES.has(role))) {
    return 'operator'
  }

  // Profile still loading — default to operator self-service (most checklist executors).
  if (roleKeys.length === 0) {
    return 'operator'
  }

  if (roleKeys.some((role) => PLANT_STAFF_EXECUTOR_ROLES.has(role))) {
    return 'plant_manager'
  }

  return config.mode
}
