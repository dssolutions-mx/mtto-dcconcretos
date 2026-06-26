import type { SecurityConfig } from '@/types'

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  mode: 'operator',
  require_attendance: true,
  require_topic: true,
  require_reflection: true,
  allow_evidence: false,
}

export function normalizeSecurityConfig(
  config: Partial<SecurityConfig> | Record<string, unknown> | null | undefined
): SecurityConfig {
  const input =
    config && typeof config === 'object' ? (config as Partial<SecurityConfig>) : {}

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

  if (section?.security_config && typeof section.security_config === 'object') {
    return 'security_talk'
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

/**
 * Pick the UI mode for security talk based on template config and executor role.
 * Field operators always get the self-attendance form even if the template
 * was authored for plant-manager mode (e.g. shared PLANTA presets).
 */
export function resolveSecurityTalkUiMode(
  config: SecurityConfig,
  executorRole: string | null | undefined
): SecurityConfig['mode'] {
  const role = (executorRole ?? '').toUpperCase()
  if (role === 'OPERADOR' || role === 'MECANICO') {
    return 'operator'
  }
  return config.mode
}
