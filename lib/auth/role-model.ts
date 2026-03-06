export const LEGACY_DB_ROLES = [
  'GERENCIA_GENERAL',
  'JEFE_UNIDAD_NEGOCIO',
  'AREA_ADMINISTRATIVA',
  'ENCARGADO_MANTENIMIENTO',
  'JEFE_PLANTA',
  'AUXILIAR_COMPRAS',
  'DOSIFICADOR',
  'OPERADOR',
  'VISUALIZADOR',
  'EJECUTIVO',
  'ENCARGADO_ALMACEN',
] as const

export type LegacyDbRole = (typeof LEGACY_DB_ROLES)[number]

export const FUTURE_BUSINESS_ROLES = [
  'GERENCIA_GENERAL',
  'GERENTE_MANTENIMIENTO',
  'COORDINADOR_MANTENIMIENTO',
  'AREA_ADMINISTRATIVA',
  'AUXILIAR_COMPRAS',
  'OPERADOR',
  'VISUALIZADOR',
  'EJECUTIVO',
  'RECURSOS_HUMANOS',
  'MECANICO',
] as const

export type FutureBusinessRole = (typeof FUTURE_BUSINESS_ROLES)[number]
export type RoleScope = 'global' | 'business_unit' | 'plant'
export type CompatibleRole = LegacyDbRole | FutureBusinessRole

export interface RoleScopeMetadata {
  scope: RoleScope
  label: string
  description: string
}

const LEGACY_ROLE_LABELS: Record<LegacyDbRole, string> = {
  GERENCIA_GENERAL: 'Gerencia General',
  JEFE_UNIDAD_NEGOCIO: 'Gerente de Mantenimiento',
  AREA_ADMINISTRATIVA: 'Área Administrativa',
  ENCARGADO_MANTENIMIENTO: 'Coordinador de Mantenimiento',
  JEFE_PLANTA: 'Jefe de Planta',
  AUXILIAR_COMPRAS: 'Auxiliar de Compras',
  DOSIFICADOR: 'Dosificador',
  OPERADOR: 'Operador',
  VISUALIZADOR: 'Visualizador',
  EJECUTIVO: 'Ejecutivo',
  ENCARGADO_ALMACEN: 'Encargado de Almacén',
}

const FUTURE_ROLE_LABELS: Record<FutureBusinessRole, string> = {
  GERENCIA_GENERAL: 'Gerencia General',
  GERENTE_MANTENIMIENTO: 'Gerente de Mantenimiento',
  COORDINADOR_MANTENIMIENTO: 'Coordinador de Mantenimiento',
  AREA_ADMINISTRATIVA: 'Área Administrativa',
  AUXILIAR_COMPRAS: 'Auxiliar de Compras',
  OPERADOR: 'Operador',
  VISUALIZADOR: 'Visualizador',
  EJECUTIVO: 'Ejecutivo',
  RECURSOS_HUMANOS: 'Recursos Humanos',
  MECANICO: 'Mecánico',
}

export const LEGACY_ROLE_TO_BUSINESS_ROLE: Partial<Record<LegacyDbRole, FutureBusinessRole>> = {
  GERENCIA_GENERAL: 'GERENCIA_GENERAL',
  JEFE_UNIDAD_NEGOCIO: 'GERENTE_MANTENIMIENTO',
  AREA_ADMINISTRATIVA: 'AREA_ADMINISTRATIVA',
  ENCARGADO_MANTENIMIENTO: 'COORDINADOR_MANTENIMIENTO',
  JEFE_PLANTA: 'COORDINADOR_MANTENIMIENTO',
  AUXILIAR_COMPRAS: 'AUXILIAR_COMPRAS',
  DOSIFICADOR: 'OPERADOR',
  OPERADOR: 'OPERADOR',
  VISUALIZADOR: 'VISUALIZADOR',
  EJECUTIVO: 'EJECUTIVO',
}

export const FUTURE_ROLE_TO_LEGACY_ROLE: Partial<Record<FutureBusinessRole, LegacyDbRole>> = {
  GERENCIA_GENERAL: 'GERENCIA_GENERAL',
  GERENTE_MANTENIMIENTO: 'JEFE_UNIDAD_NEGOCIO',
  COORDINADOR_MANTENIMIENTO: 'ENCARGADO_MANTENIMIENTO',
  AREA_ADMINISTRATIVA: 'AREA_ADMINISTRATIVA',
  AUXILIAR_COMPRAS: 'AUXILIAR_COMPRAS',
  OPERADOR: 'OPERADOR',
  VISUALIZADOR: 'VISUALIZADOR',
  EJECUTIVO: 'EJECUTIVO',
  RECURSOS_HUMANOS: 'AREA_ADMINISTRATIVA',
  MECANICO: 'OPERADOR',
}

export const BUSINESS_ROLE_SCOPE: Record<FutureBusinessRole, RoleScopeMetadata> = {
  GERENCIA_GENERAL: {
    scope: 'global',
    label: 'Global',
    description: 'Autoridad transversal con aprobación final y escalaciones globales.',
  },
  GERENTE_MANTENIMIENTO: {
    scope: 'business_unit',
    label: 'Unidad de negocio',
    description: 'Aprobador técnico principal durante la transición desde los roles legacy.',
  },
  COORDINADOR_MANTENIMIENTO: {
    scope: 'plant',
    label: 'Planta',
    description: 'Responsable operativo de mantenimiento y creación de solicitudes.',
  },
  AREA_ADMINISTRATIVA: {
    scope: 'global',
    label: 'Global',
    description: 'Responsable de viabilidad administrativa y continuidad financiera.',
  },
  AUXILIAR_COMPRAS: {
    scope: 'global',
    label: 'Global',
    description: 'Soporte operativo de compras e inventario.',
  },
  OPERADOR: {
    scope: 'plant',
    label: 'Planta',
    description: 'Rol operativo de ejecución en planta.',
  },
  VISUALIZADOR: {
    scope: 'global',
    label: 'Global',
    description: 'Acceso de consulta y seguimiento.',
  },
  EJECUTIVO: {
    scope: 'global',
    label: 'Global',
    description: 'Rol ejecutivo legacy conservado para compatibilidad.',
  },
  RECURSOS_HUMANOS: {
    scope: 'global',
    label: 'Global',
    description: 'Propietario futuro de altas, bajas y gobierno de personal.',
  },
  MECANICO: {
    scope: 'plant',
    label: 'Planta',
    description: 'Rol técnico operativo asociado a ejecución de trabajo y evidencia.',
  },
}

const TECHNICAL_APPROVER_ROLES = new Set<FutureBusinessRole>(['GERENTE_MANTENIMIENTO'])

const VIABILITY_REVIEWER_ROLES = new Set<FutureBusinessRole>(['AREA_ADMINISTRATIVA'])
const GM_ESCALATOR_ROLES = new Set<FutureBusinessRole>(['GERENCIA_GENERAL'])
const RH_OWNER_ROLES = new Set<FutureBusinessRole>(['RECURSOS_HUMANOS'])

export function isLegacyDbRole(role: string | null | undefined): role is LegacyDbRole {
  return typeof role === 'string' && LEGACY_DB_ROLES.includes(role as LegacyDbRole)
}

export function isFutureBusinessRole(
  role: string | null | undefined
): role is FutureBusinessRole {
  return typeof role === 'string' && FUTURE_BUSINESS_ROLES.includes(role as FutureBusinessRole)
}

export function resolveBusinessRole(
  role: string | null | undefined
): FutureBusinessRole | null {
  if (!role) {
    return null
  }

  if (isFutureBusinessRole(role)) {
    return role
  }

  if (isLegacyDbRole(role)) {
    return LEGACY_ROLE_TO_BUSINESS_ROLE[role] ?? null
  }

  return null
}

export function resolveRoleScope(role: string | null | undefined): RoleScope | null {
  return getRoleScopeMetadata(role)?.scope ?? null
}

export function getRoleScopeMetadata(
  role: string | null | undefined
): RoleScopeMetadata | null {
  const businessRole = resolveBusinessRole(role)
  return businessRole ? BUSINESS_ROLE_SCOPE[businessRole] : null
}

export function getRoleScope(role: string | null | undefined): RoleScope {
  return resolveRoleScope(role) ?? 'plant'
}

export function getRoleDisplayName(role: string | null | undefined): string {
  if (!role) {
    return 'Sin rol'
  }

  if (isLegacyDbRole(role)) {
    return LEGACY_ROLE_LABELS[role]
  }

  if (isFutureBusinessRole(role)) {
    return FUTURE_ROLE_LABELS[role]
  }

  return role
}

export function isTechnicalApproverRole(role: string | null | undefined): boolean {
  const businessRole = resolveBusinessRole(role)
  return businessRole ? TECHNICAL_APPROVER_ROLES.has(businessRole) : false
}

export function isViabilityReviewerRole(role: string | null | undefined): boolean {
  const businessRole = resolveBusinessRole(role)
  return businessRole ? VIABILITY_REVIEWER_ROLES.has(businessRole) : false
}

export function isGMEscalatorRole(role: string | null | undefined): boolean {
  const businessRole = resolveBusinessRole(role)
  return businessRole ? GM_ESCALATOR_ROLES.has(businessRole) : false
}

export function isRHOwnerRole(role: string | null | undefined): boolean {
  const businessRole = resolveBusinessRole(role)
  return businessRole ? RH_OWNER_ROLES.has(businessRole) : false
}

export interface NormalizedPersistedRole {
  role: LegacyDbRole
  businessRole: FutureBusinessRole | null
  roleScope: RoleScope | null
}

export function normalizeRoleForPersistence(
  role: string | null | undefined
): NormalizedPersistedRole | null {
  if (!role) {
    return null
  }

  if (isLegacyDbRole(role)) {
    return {
      role,
      businessRole: resolveBusinessRole(role),
      roleScope: resolveRoleScope(role),
    }
  }

  if (isFutureBusinessRole(role)) {
    const legacyRole = FUTURE_ROLE_TO_LEGACY_ROLE[role]
    if (!legacyRole) {
      return null
    }

    return {
      role: legacyRole,
      businessRole: role,
      roleScope: resolveRoleScope(role),
    }
  }

  return null
}
