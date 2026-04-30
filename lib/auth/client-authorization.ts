import { isRHOwnerRole } from '@/lib/auth/role-model'

/** RRHH / GG: full registration (any role, any BU/plant). Mirrors server-side RH ownership. */
export function isFullPersonnelRegistrationClient(profile: {
  role?: string | null
  business_role?: string | null
} | null): boolean {
  if (!profile?.role) return false
  return (
    profile.role === 'GERENCIA_GENERAL' ||
    profile.role === 'RECURSOS_HUMANOS' ||
    profile.business_role === 'RECURSOS_HUMANOS' ||
    isRHOwnerRole(profile.business_role ?? profile.role)
  )
}

/** Client mirror: who may open the registrar-usuario flow (server enforces scope). */
export function canRegisterOperatorsClient(profile: {
  role?: string | null
  business_role?: string | null
} | null): boolean {
  if (!profile?.role) return false
  const r = profile.role
  const br = profile.business_role
  return (
    r === 'GERENCIA_GENERAL' ||
    r === 'RECURSOS_HUMANOS' ||
    br === 'RECURSOS_HUMANOS' ||
    isRHOwnerRole(br ?? r) ||
    r === 'JEFE_UNIDAD_NEGOCIO' ||
    r === 'JEFE_PLANTA'
  )
}

export function canAccessRHReportingNav(profile: {
  role?: string | null
  business_role?: string | null
} | null): boolean {
  if (!profile?.role) return false
  return (
    profile.role === 'GERENCIA_GENERAL' ||
    profile.role === 'RECURSOS_HUMANOS' ||
    isRHOwnerRole(profile.business_role ?? profile.role)
  )
}

/**
 * Jefe de Planta: plants the user may act on. Prefer `managed_plant_ids` from
 * `profile_scoped_plant_ids` (set in the auth store after load); otherwise primary `plant_id` only.
 */
export function jefePlantaClientPlantScope(profile: {
  role?: string | null
  plant_id?: string | null
  managed_plant_ids?: string[] | null
} | null): string[] {
  if (profile?.role !== 'JEFE_PLANTA') return []
  const m = profile.managed_plant_ids
  if (m && m.length > 0) return m
  if (profile.plant_id) return [profile.plant_id]
  return []
}

export function canManageUserAuthorizationClient(profile: {
  role?: string | null
  business_role?: string | null
} | null): boolean {
  if (!profile?.role) return false
  return (
    profile.role === 'GERENCIA_GENERAL' ||
    profile.role === 'RECURSOS_HUMANOS' ||
    profile.business_role === 'RECURSOS_HUMANOS' ||
    isRHOwnerRole(profile.business_role ?? profile.role)
  )
}
