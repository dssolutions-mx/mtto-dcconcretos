// Original DB enum values (legacy roles still used by existing profiles)
const ORIGINAL_DB_ROLES = [
  'GERENCIA_GENERAL',
  'JEFE_UNIDAD_NEGOCIO',
  'ENCARGADO_MANTENIMIENTO',
  'AREA_ADMINISTRATIVA',
  'JEFE_PLANTA',
  'AUXILIAR_COMPRAS',
  'DOSIFICADOR',
  'OPERADOR',
  'VISUALIZADOR',
  'EJECUTIVO',
  'ENCARGADO_ALMACEN',
] as const

// New roles added per POL-OPE-001/002 — now valid DB enum values
const NEW_DB_ROLES = [
  'GERENTE_MANTENIMIENTO',
  'COORDINADOR_MANTENIMIENTO',
  'MECANICO',
  'RECURSOS_HUMANOS',
] as const

export const LEGACY_DB_ROLES = [...ORIGINAL_DB_ROLES, ...NEW_DB_ROLES] as const

export type LegacyDbRole = (typeof LEGACY_DB_ROLES)[number]

export const FUTURE_BUSINESS_ROLES = [
  'GERENCIA_GENERAL',
  'GERENTE_MANTENIMIENTO',
  'JEFE_UNIDAD_NEGOCIO',
  'JEFE_PLANTA',
  'COORDINADOR_MANTENIMIENTO',
  'AREA_ADMINISTRATIVA',
  'AUXILIAR_COMPRAS',
  'ENCARGADO_ALMACEN',
  'OPERADOR',
  'MECANICO',
  'VISUALIZADOR',
  'EJECUTIVO',
  'RECURSOS_HUMANOS',
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
  JEFE_UNIDAD_NEGOCIO: 'Jefe de Unidad de Negocio',
  ENCARGADO_MANTENIMIENTO: 'Encargado de Mantenimiento (deprecado)',
  AREA_ADMINISTRATIVA: 'Área Administrativa',
  JEFE_PLANTA: 'Jefe de Planta',
  AUXILIAR_COMPRAS: 'Auxiliar de Compras',
  DOSIFICADOR: 'Dosificador',
  OPERADOR: 'Operador',
  VISUALIZADOR: 'Visualizador',
  EJECUTIVO: 'Ejecutivo',
  ENCARGADO_ALMACEN: 'Encargado de Almacén',
  GERENTE_MANTENIMIENTO: 'Gerente de Mantenimiento',
  COORDINADOR_MANTENIMIENTO: 'Coordinador de Mantenimiento',
  MECANICO: 'Mecánico',
  RECURSOS_HUMANOS: 'Recursos Humanos',
}

const FUTURE_ROLE_LABELS: Record<FutureBusinessRole, string> = {
  GERENCIA_GENERAL: 'Gerencia General',
  GERENTE_MANTENIMIENTO: 'Gerente de Mantenimiento',
  JEFE_UNIDAD_NEGOCIO: 'Jefe de Unidad de Negocio',
  JEFE_PLANTA: 'Jefe de Planta',
  COORDINADOR_MANTENIMIENTO: 'Coordinador de Mantenimiento',
  AREA_ADMINISTRATIVA: 'Área Administrativa',
  AUXILIAR_COMPRAS: 'Auxiliar de Compras',
  ENCARGADO_ALMACEN: 'Encargado de Almacén',
  OPERADOR: 'Operador',
  MECANICO: 'Mecánico',
  VISUALIZADOR: 'Visualizador',
  EJECUTIVO: 'Ejecutivo',
  RECURSOS_HUMANOS: 'Recursos Humanos',
}

// Maps legacy DB roles to their semantic future business role equivalents.
// ENCARGADO_MANTENIMIENTO (deprecated enum) maps to COORDINADOR for workflow scope; permissions stay keyed by profile.role.
// New DB roles map directly to themselves.
export const LEGACY_ROLE_TO_BUSINESS_ROLE: Partial<Record<LegacyDbRole, FutureBusinessRole>> = {
  GERENCIA_GENERAL: 'GERENCIA_GENERAL',
  JEFE_UNIDAD_NEGOCIO: 'JEFE_UNIDAD_NEGOCIO',
  ENCARGADO_MANTENIMIENTO: 'COORDINADOR_MANTENIMIENTO',
  AREA_ADMINISTRATIVA: 'AREA_ADMINISTRATIVA',
  JEFE_PLANTA: 'JEFE_PLANTA',
  AUXILIAR_COMPRAS: 'AUXILIAR_COMPRAS',
  DOSIFICADOR: 'OPERADOR',
  OPERADOR: 'OPERADOR',
  VISUALIZADOR: 'VISUALIZADOR',
  EJECUTIVO: 'EJECUTIVO',
  ENCARGADO_ALMACEN: 'ENCARGADO_ALMACEN',
  GERENTE_MANTENIMIENTO: 'GERENTE_MANTENIMIENTO',
  COORDINADOR_MANTENIMIENTO: 'COORDINADOR_MANTENIMIENTO',
  MECANICO: 'MECANICO',
  RECURSOS_HUMANOS: 'RECURSOS_HUMANOS',
}

// Maps future business roles to the DB enum value used when persisting.
// All new DB roles map directly to themselves.
export const FUTURE_ROLE_TO_LEGACY_ROLE: Partial<Record<FutureBusinessRole, LegacyDbRole>> = {
  GERENCIA_GENERAL: 'GERENCIA_GENERAL',
  GERENTE_MANTENIMIENTO: 'GERENTE_MANTENIMIENTO',
  JEFE_UNIDAD_NEGOCIO: 'JEFE_UNIDAD_NEGOCIO',
  JEFE_PLANTA: 'JEFE_PLANTA',
  COORDINADOR_MANTENIMIENTO: 'COORDINADOR_MANTENIMIENTO',
  AREA_ADMINISTRATIVA: 'AREA_ADMINISTRATIVA',
  AUXILIAR_COMPRAS: 'AUXILIAR_COMPRAS',
  ENCARGADO_ALMACEN: 'ENCARGADO_ALMACEN',
  OPERADOR: 'OPERADOR',
  MECANICO: 'MECANICO',
  VISUALIZADOR: 'VISUALIZADOR',
  EJECUTIVO: 'EJECUTIVO',
  RECURSOS_HUMANOS: 'RECURSOS_HUMANOS',
}

export const BUSINESS_ROLE_SCOPE: Record<FutureBusinessRole, RoleScopeMetadata> = {
  GERENCIA_GENERAL: {
    scope: 'global',
    label: 'Global',
    description: 'Autoridad transversal con aprobación final y escalaciones globales.',
  },
  GERENTE_MANTENIMIENTO: {
    scope: 'global',
    label: 'Global',
    description: 'Aprobador técnico de Nivel 1 para todas las OCs. Visibilidad y autoridad global sobre toda la red de activos y plantas.',
  },
  JEFE_UNIDAD_NEGOCIO: {
    scope: 'business_unit',
    label: 'Unidad de negocio',
    description: 'Jefe de unidad de negocio. No aprueba órdenes de compra.',
  },
  JEFE_PLANTA: {
    scope: 'plant',
    label: 'Planta',
    description:
      'Supervisión operativa de planta. No es el Coordinador de Mantenimiento; no crea OC ni autoriza validación técnica Nivel 1.',
  },
  COORDINADOR_MANTENIMIENTO: {
    scope: 'plant',
    label: 'Planta',
    description: 'Crea OTs y OCs. Límite de autorización $0. El Gerente de Mantenimiento aprueba.',
  },
  AREA_ADMINISTRATIVA: {
    scope: 'global',
    label: 'Global',
    description: 'Responsable de viabilidad administrativa y continuidad financiera.',
  },
  AUXILIAR_COMPRAS: {
    scope: 'global',
    label: 'Global',
    description: 'Soporte operativo de compras.',
  },
  ENCARGADO_ALMACEN: {
    scope: 'plant',
    label: 'Planta',
    description: 'Guardián del inventario físico. Libera inventario solo con OC aprobada en sistema.',
  },
  OPERADOR: {
    scope: 'plant',
    label: 'Planta',
    description: 'Rol operativo de ejecución en planta.',
  },
  MECANICO: {
    scope: 'plant',
    label: 'Planta',
    description: 'Lee OTs asignadas y sube evidencia fotográfica (antes/después). No crea OCs ni aprueba nada.',
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
    description: 'Propietario del módulo de conciliación. Da de alta usuarios, reasigna operadores y dicta sanciones.',
  },
}

// Per POL-OPE-001/002: only GERENTE_MANTENIMIENTO authorizes POs (Nivel 1).
// COORDINADOR_MANTENIMIENTO creates POs but has $0 authorization limit.
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

/**
 * Roles that must use `profiles.role` for module permissions (never `business_role` alone).
 * Covers: distinct permission rows vs mapped business role, JUN (must not inherit Gerente via stale business_role),
 * deprecated Encargado (keep Coordinador-shaped business_role without collapsing permission row).
 */
export const ROLES_PINNED_TO_PROFILE_ROLE_FOR_PERMISSIONS = new Set<LegacyDbRole>([
  'JEFE_UNIDAD_NEGOCIO',
  'JEFE_PLANTA',
  'ENCARGADO_MANTENIMIENTO',
  'DOSIFICADOR',
])

/**
 * Returns the role key to use for permission checks (hasModuleAccess, hasWriteAccess, etc.).
 * Pinned roles always use profile.role; others use business_role || role.
 */
export function effectiveRoleForPermissions(profile: {
  role?: string | null
  business_role?: string | null
} | null | undefined): string | null {
  if (!profile?.role) return null
  if (
    isLegacyDbRole(profile.role) &&
    ROLES_PINNED_TO_PROFILE_ROLE_FOR_PERMISSIONS.has(profile.role)
  ) {
    return profile.role
  }
  return profile.business_role || profile.role || null
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
