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
