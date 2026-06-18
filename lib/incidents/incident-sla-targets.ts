import { effectiveRoleForPermissions } from '@/lib/auth/role-model'
import { hasWriteAccess } from '@/lib/auth/role-permissions'

export const SLA_IMPACT_OPTIONS = ['Alto', 'Medio', 'Bajo'] as const
export type SlaImpactOption = (typeof SLA_IMPACT_OPTIONS)[number]

export const INCIDENT_SLA_OBJETIVOS_PATH = '/reportes/incidentes-sla/objetivos'

export type IncidentSlaTarget = {
  id: string
  name: string
  is_active: boolean
  priority: number
  plant_id: string | null
  match_incident_type: string | null
  match_impact: string | null
  match_department_id: string | null
  target_ack_hours: number
  target_schedule_hours: number
  target_resolve_hours: number
  created_at: string
  updated_at: string
  departments?: { id: string; name: string; code: string } | null
  plants?: { id: string; name: string; code: string } | null
}

export type SlaTargetInput = {
  name: string
  priority?: number
  is_active?: boolean
  plant_id?: string | null
  match_incident_type?: string | null
  match_impact?: string | null
  match_department_id?: string | null
  target_ack_hours?: number
  target_schedule_hours?: number
  target_resolve_hours?: number
}

export type ValidatedSlaTargetInput = {
  name: string
  priority: number
  is_active: boolean
  plant_id: string | null
  match_incident_type: string | null
  match_impact: string | null
  match_department_id: string | null
  target_ack_hours: number
  target_schedule_hours: number
  target_resolve_hours: number
}

export type SlaTargetValidationResult =
  | { ok: true; data: ValidatedSlaTargetInput }
  | { ok: false; error: string }

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
}

/** Maintenance leadership or config write — same audience as incident routing rules admin. */
export function canManageIncidentSlaTargets(profile: {
  role?: string | null
  business_role?: string | null
}): boolean {
  const key = effectiveRoleForPermissions(profile)
  if (!key) return false
  return hasWriteAccess(key, 'maintenance') || hasWriteAccess(key, 'config')
}

export function validateSlaTargetInput(
  input: Partial<SlaTargetInput>,
  options: { requireName?: boolean } = {},
): SlaTargetValidationResult {
  const requireName = options.requireName ?? true
  const name = input.name?.trim() ?? ''

  if (requireName && !name) {
    return { ok: false, error: 'El nombre es obligatorio' }
  }

  const priority = input.priority ?? 100
  if (!isNonNegativeInteger(priority)) {
    return { ok: false, error: 'La prioridad debe ser un entero mayor o igual a 0' }
  }

  const target_ack_hours = input.target_ack_hours ?? 24
  const target_schedule_hours = input.target_schedule_hours ?? 48
  const target_resolve_hours = input.target_resolve_hours ?? 168

  if (!isPositiveInteger(target_ack_hours)) {
    return { ok: false, error: 'Las horas de atención deben ser un entero positivo' }
  }
  if (!isPositiveInteger(target_schedule_hours)) {
    return { ok: false, error: 'Las horas de programación deben ser un entero positivo' }
  }
  if (!isPositiveInteger(target_resolve_hours)) {
    return { ok: false, error: 'Las horas de resolución deben ser un entero positivo' }
  }

  const match_impact = normalizeOptionalText(input.match_impact)
  if (match_impact && !SLA_IMPACT_OPTIONS.includes(match_impact as SlaImpactOption)) {
    return { ok: false, error: 'El impacto debe ser Alto, Medio o Bajo' }
  }

  return {
    ok: true,
    data: {
      name,
      priority,
      is_active: input.is_active ?? true,
      plant_id: input.plant_id || null,
      match_incident_type: normalizeOptionalText(input.match_incident_type),
      match_impact,
      match_department_id: input.match_department_id || null,
      target_ack_hours,
      target_schedule_hours,
      target_resolve_hours,
    },
  }
}

export function formatSlaTargetMatchSummary(target: IncidentSlaTarget): string {
  const parts: string[] = []
  if (target.plants?.name) parts.push(target.plants.name)
  else if (target.plant_id) parts.push('Planta específica')
  else parts.push('Todas las plantas')

  if (target.match_impact) parts.push(`Impacto ${target.match_impact}`)
  if (target.match_incident_type) parts.push(target.match_incident_type)
  if (target.departments?.name) parts.push(target.departments.name)

  return parts.join(' · ')
}
