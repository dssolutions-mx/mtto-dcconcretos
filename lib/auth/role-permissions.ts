import {
  getRoleDisplayName as getCompatibilityRoleDisplayName,
  getRoleScope as getCompatibilityRoleScope,
  isGMEscalatorRole,
  isRHOwnerRole,
  isLegacyDbRole,
  isTechnicalApproverRole,
  isViabilityReviewerRole,
  resolveBusinessRole,
  resolveRoleScope,
  type FutureBusinessRole,
  type LegacyDbRole,
  type RoleScope,
} from '@/lib/auth/role-model'

export type AccessLevel = 'none' | 'read' | 'read_write' | 'full' | 'full_auth'

export type ModulePermissions = {
  assets: AccessLevel
  maintenance: AccessLevel
  work_orders: AccessLevel
  purchases: AccessLevel
  inventory: AccessLevel
  personnel: AccessLevel
  checklists: AccessLevel
  reports: AccessLevel
  config: AccessLevel
}

export type RoleConfig = {
  name: string
  businessRole: FutureBusinessRole | null
  permissions: ModulePermissions
  authorizationLimit: number
  scope: RoleScope
  description: string
}

export interface CompatibleRoleInfo {
  legacyRole: LegacyDbRole | null
  businessRole: FutureBusinessRole | null
  scope: RoleScope | null
  displayName: string
}

const LEGACY_ROLE_PERMISSIONS: Record<LegacyDbRole, RoleConfig> = {
  GERENCIA_GENERAL: {
    name: 'Gerencia General',
    businessRole: 'GERENCIA_GENERAL',
    permissions: {
      assets: 'full',
      maintenance: 'full',
      work_orders: 'full_auth',
      purchases: 'full_auth',
      inventory: 'full',
      personnel: 'full',
      checklists: 'full',
      reports: 'full',
      config: 'full',
    },
    authorizationLimit: Number.MAX_SAFE_INTEGER,
    scope: 'global',
    description: 'Acceso completo a todos los módulos sin restricciones',
  },
  JEFE_UNIDAD_NEGOCIO: {
    name: 'Jefe Unidad de Negocio',
    businessRole: 'GERENTE_MANTENIMIENTO',
    permissions: {
      assets: 'read_write',
      maintenance: 'full',
      work_orders: 'full_auth',
      purchases: 'full_auth',
      inventory: 'read_write',
      personnel: 'full',
      checklists: 'full',
      reports: 'full',
      config: 'read_write',
    },
    authorizationLimit: 500000,
    scope: 'business_unit',
    description: 'Gestión completa de su unidad de negocio, incluyendo autorización de compras',
  },
  AREA_ADMINISTRATIVA: {
    name: 'Área Administrativa',
    businessRole: 'AREA_ADMINISTRATIVA',
    permissions: {
      assets: 'read',
      maintenance: 'read',
      work_orders: 'full_auth',
      purchases: 'full_auth',
      inventory: 'full',
      personnel: 'full',
      checklists: 'none',
      reports: 'full',
      config: 'read_write',
    },
    authorizationLimit: 100000,
    scope: 'global',
    description: 'Administración, autorización de compras y gestión de personal',
  },
  ENCARGADO_MANTENIMIENTO: {
    name: 'Encargado Mantenimiento',
    businessRole: 'COORDINADOR_MANTENIMIENTO',
    permissions: {
      assets: 'read_write',
      maintenance: 'full',
      work_orders: 'full',
      purchases: 'read_write',
      inventory: 'read_write',
      personnel: 'none',
      checklists: 'full',
      reports: 'read_write',
      config: 'none',
    },
    authorizationLimit: 0,
    scope: 'plant',
    description: 'Gestión completa de mantenimiento, puede crear órdenes de compra que requieren aprobación',
  },
  JEFE_PLANTA: {
    name: 'Jefe de Planta',
    businessRole: 'COORDINADOR_MANTENIMIENTO',
    permissions: {
      assets: 'read_write',
      maintenance: 'read_write',
      work_orders: 'read_write',
      purchases: 'read_write',
      inventory: 'read_write',
      personnel: 'read_write',
      checklists: 'read_write',
      reports: 'read_write',
      config: 'none',
    },
    authorizationLimit: 50000,
    scope: 'plant',
    description: 'Supervisión completa de su planta, incluyendo órdenes de compra hasta $50,000',
  },
  AUXILIAR_COMPRAS: {
    name: 'Auxiliar de Compras',
    businessRole: 'AUXILIAR_COMPRAS',
    permissions: {
      assets: 'none',
      maintenance: 'read',
      work_orders: 'read',
      purchases: 'full',
      inventory: 'full',
      personnel: 'none',
      checklists: 'none',
      reports: 'read',
      config: 'none',
    },
    authorizationLimit: 0,
    scope: 'global',
    description: 'Gestión exclusiva de compras e inventario',
  },
  DOSIFICADOR: {
    name: 'Dosificador',
    businessRole: 'OPERADOR',
    permissions: {
      assets: 'none',
      maintenance: 'none',
      work_orders: 'none',
      purchases: 'none',
      inventory: 'read_write',
      personnel: 'none',
      checklists: 'read',
      reports: 'none',
      config: 'none',
    },
    authorizationLimit: 0,
    scope: 'plant',
    description: 'Ejecución de checklists asignados a sus activos y gestión de diesel',
  },
  OPERADOR: {
    name: 'Operador',
    businessRole: 'OPERADOR',
    permissions: {
      assets: 'none',
      maintenance: 'none',
      work_orders: 'none',
      purchases: 'none',
      inventory: 'none',
      personnel: 'none',
      checklists: 'read',
      reports: 'none',
      config: 'none',
    },
    authorizationLimit: 0,
    scope: 'plant',
    description: 'Ejecución de checklists asignados a sus activos',
  },
  VISUALIZADOR: {
    name: 'Visualizador',
    businessRole: 'VISUALIZADOR',
    permissions: {
      assets: 'read',
      maintenance: 'read',
      work_orders: 'read',
      purchases: 'read_write',
      inventory: 'read',
      personnel: 'none',
      checklists: 'read',
      reports: 'read',
      config: 'none',
    },
    authorizationLimit: 0,
    scope: 'global',
    description: 'Visualización de información y creación de órdenes de compra',
  },
  EJECUTIVO: {
    name: 'Ejecutivo',
    businessRole: 'EJECUTIVO',
    permissions: {
      assets: 'read',
      maintenance: 'read',
      work_orders: 'read',
      purchases: 'read',
      inventory: 'read',
      personnel: 'full',
      checklists: 'read',
      reports: 'read',
      config: 'read',
    },
    authorizationLimit: 0,
    scope: 'global',
    description: 'Acceso ejecutivo con capacidad de gestión de personal y registro de usuarios',
  },
  ENCARGADO_ALMACEN: {
    name: 'Encargado de Almacén',
    businessRole: null,
    permissions: {
      assets: 'none',
      maintenance: 'read',
      work_orders: 'read',
      purchases: 'read_write',
      inventory: 'full',
      personnel: 'none',
      checklists: 'none',
      reports: 'read',
      config: 'none',
    },
    authorizationLimit: 0,
    scope: 'plant',
    description:
      'Rol legacy en transición. Mantiene compatibilidad mientras la responsabilidad de almacén se separa del rol primario.',
  },
}

const FUTURE_ROLE_PERMISSIONS: Record<FutureBusinessRole, RoleConfig> = {
  GERENCIA_GENERAL: {
    name: 'Gerencia General',
    businessRole: 'GERENCIA_GENERAL',
    permissions: LEGACY_ROLE_PERMISSIONS.GERENCIA_GENERAL.permissions,
    authorizationLimit: LEGACY_ROLE_PERMISSIONS.GERENCIA_GENERAL.authorizationLimit,
    scope: 'global',
    description: 'Compatibilidad para el rol futuro de gerencia general.',
  },
  GERENTE_MANTENIMIENTO: {
    name: 'Gerente de Mantenimiento',
    businessRole: 'GERENTE_MANTENIMIENTO',
    permissions: LEGACY_ROLE_PERMISSIONS.JEFE_UNIDAD_NEGOCIO.permissions,
    authorizationLimit: LEGACY_ROLE_PERMISSIONS.JEFE_UNIDAD_NEGOCIO.authorizationLimit,
    scope: 'business_unit',
    description: 'Compatibilidad para el aprobador técnico futuro.',
  },
  COORDINADOR_MANTENIMIENTO: {
    name: 'Coordinador de Mantenimiento',
    businessRole: 'COORDINADOR_MANTENIMIENTO',
    permissions: LEGACY_ROLE_PERMISSIONS.ENCARGADO_MANTENIMIENTO.permissions,
    authorizationLimit: LEGACY_ROLE_PERMISSIONS.ENCARGADO_MANTENIMIENTO.authorizationLimit,
    scope: 'plant',
    description: 'Compatibilidad para el rol operativo futuro de mantenimiento.',
  },
  AREA_ADMINISTRATIVA: {
    name: 'Área Administrativa',
    businessRole: 'AREA_ADMINISTRATIVA',
    permissions: LEGACY_ROLE_PERMISSIONS.AREA_ADMINISTRATIVA.permissions,
    authorizationLimit: LEGACY_ROLE_PERMISSIONS.AREA_ADMINISTRATIVA.authorizationLimit,
    scope: 'global',
    description: 'Compatibilidad para revisión administrativa y viabilidad.',
  },
  AUXILIAR_COMPRAS: {
    name: 'Auxiliar de Compras',
    businessRole: 'AUXILIAR_COMPRAS',
    permissions: LEGACY_ROLE_PERMISSIONS.AUXILIAR_COMPRAS.permissions,
    authorizationLimit: LEGACY_ROLE_PERMISSIONS.AUXILIAR_COMPRAS.authorizationLimit,
    scope: 'global',
    description: 'Compatibilidad para operaciones de compras.',
  },
  OPERADOR: {
    name: 'Operador',
    businessRole: 'OPERADOR',
    permissions: LEGACY_ROLE_PERMISSIONS.OPERADOR.permissions,
    authorizationLimit: LEGACY_ROLE_PERMISSIONS.OPERADOR.authorizationLimit,
    scope: 'plant',
    description: 'Compatibilidad para el rol operativo base.',
  },
  VISUALIZADOR: {
    name: 'Visualizador',
    businessRole: 'VISUALIZADOR',
    permissions: LEGACY_ROLE_PERMISSIONS.VISUALIZADOR.permissions,
    authorizationLimit: LEGACY_ROLE_PERMISSIONS.VISUALIZADOR.authorizationLimit,
    scope: 'global',
    description: 'Compatibilidad para acceso de consulta.',
  },
  EJECUTIVO: {
    name: 'Ejecutivo',
    businessRole: 'EJECUTIVO',
    permissions: LEGACY_ROLE_PERMISSIONS.EJECUTIVO.permissions,
    authorizationLimit: LEGACY_ROLE_PERMISSIONS.EJECUTIVO.authorizationLimit,
    scope: 'global',
    description: 'Compatibilidad para el rol ejecutivo legacy.',
  },
  RECURSOS_HUMANOS: {
    name: 'Recursos Humanos',
    businessRole: 'RECURSOS_HUMANOS',
    permissions: {
      assets: 'read',
      maintenance: 'read',
      work_orders: 'read',
      purchases: 'read',
      inventory: 'read',
      personnel: 'full',
      checklists: 'read',
      reports: 'read',
      config: 'read',
    },
    authorizationLimit: 0,
    scope: 'global',
    description: 'Compatibilidad futura para gobierno de personal sin cambiar autoridad live en Task 1.',
  },
  MECANICO: {
    name: 'Mecánico',
    businessRole: 'MECANICO',
    permissions: {
      assets: 'read',
      maintenance: 'read_write',
      work_orders: 'read_write',
      purchases: 'none',
      inventory: 'none',
      personnel: 'none',
      checklists: 'read',
      reports: 'read',
      config: 'none',
    },
    authorizationLimit: 0,
    scope: 'plant',
    description: 'Compatibilidad futura para ejecución técnica sin autoridad administrativa adicional.',
  },
}

export const ROLE_PERMISSIONS: Record<string, RoleConfig> = {
  ...LEGACY_ROLE_PERMISSIONS,
  ...FUTURE_ROLE_PERMISSIONS,
}

function resolveRoleConfig(userRole: string): RoleConfig | null {
  if (isLegacyDbRole(userRole)) {
    return LEGACY_ROLE_PERMISSIONS[userRole]
  }

  return ROLE_PERMISSIONS[userRole] ?? null
}

function hasAccessLevel(
  userRole: string,
  module: keyof ModulePermissions,
  allowedLevels: AccessLevel[]
): boolean {
  const roleConfig = resolveRoleConfig(userRole)
  if (!roleConfig) {
    return false
  }

  return allowedLevels.includes(roleConfig.permissions[module])
}

// Permission checking functions
export function hasModuleAccess(userRole: string, module: keyof ModulePermissions): boolean {
  return hasAccessLevel(userRole, module, ['read', 'read_write', 'full', 'full_auth'])
}

export function hasWriteAccess(userRole: string, module: keyof ModulePermissions): boolean {
  return hasAccessLevel(userRole, module, ['read_write', 'full', 'full_auth'])
}

export function hasCreateAccess(userRole: string, module: keyof ModulePermissions): boolean {
  return hasAccessLevel(userRole, module, ['read_write', 'full', 'full_auth'])
}

export function hasDeleteAccess(userRole: string, module: keyof ModulePermissions): boolean {
  return hasAccessLevel(userRole, module, ['full', 'full_auth'])
}

export function hasAuthorizationAccess(
  userRole: string,
  module: keyof ModulePermissions
): boolean {
  return hasAccessLevel(userRole, module, ['full_auth'])
}

export function canAuthorizeAmount(userRole: string, amount: number): boolean {
  const roleConfig = resolveRoleConfig(userRole)
  if (!roleConfig) {
    return false
  }

  return amount <= roleConfig.authorizationLimit
}

export function getAuthorizationLimit(userRole: string): number {
  return resolveRoleConfig(userRole)?.authorizationLimit ?? 0
}

export function getBusinessRole(userRole: string): FutureBusinessRole | null {
  return resolveRoleConfig(userRole)?.businessRole ?? resolveBusinessRole(userRole)
}

export function getRoleScope(userRole: string): RoleScope {
  return resolveRoleConfig(userRole)?.scope ?? getCompatibilityRoleScope(userRole)
}

export function getRoleDisplayName(userRole: string): string {
  return resolveRoleConfig(userRole)?.name ?? getCompatibilityRoleDisplayName(userRole)
}

export function resolveCompatibleRoleInfo(userRole: string): CompatibleRoleInfo {
  const roleConfig = resolveRoleConfig(userRole)

  return {
    legacyRole: isLegacyDbRole(userRole) ? userRole : null,
    businessRole: roleConfig?.businessRole ?? resolveBusinessRole(userRole),
    scope: roleConfig?.scope ?? resolveRoleScope(userRole),
    displayName: roleConfig?.name ?? getRoleDisplayName(userRole),
  }
}

export function isTechnicalApprover(userRole: string): boolean {
  return isTechnicalApproverRole(userRole)
}

export function isViabilityReviewer(userRole: string): boolean {
  return isViabilityReviewerRole(userRole)
}

export function isGMEscalator(userRole: string): boolean {
  return isGMEscalatorRole(userRole)
}

export function isRHOwner(userRole: string): boolean {
  return isRHOwnerRole(userRole)
}

// Route access mapping
export const ROUTE_PERMISSIONS: Record<string, keyof ModulePermissions> = {
  '/activos': 'assets',
  '/preventivo': 'maintenance',
  '/incidentes': 'maintenance',
  '/ordenes': 'work_orders',
  '/compras': 'purchases',
  '/inventario': 'inventory',
  '/suppliers': 'purchases',
  '/gestion/personal': 'personnel',
  '/gestion/autorizaciones': 'personnel',
  '/gestion/plantas': 'config',
  '/checklists': 'checklists',
  '/reportes': 'reports',
  '/gestion': 'personnel',
}

export function canAccessRoute(userRole: string, pathname: string): boolean {
  if (pathname === '/dashboard' || pathname === '/') {
    return true
  }

  for (const [routePattern, module] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(routePattern)) {
      return hasModuleAccess(userRole, module)
    }
  }

  return true
}

// UI element visibility helpers
export const UI_PERMISSIONS = {
  canShowCreateButton: (userRole: string, module: keyof ModulePermissions) =>
    hasCreateAccess(userRole, module),

  canShowEditButton: (userRole: string, module: keyof ModulePermissions) =>
    hasWriteAccess(userRole, module),

  canShowDeleteButton: (userRole: string, module: keyof ModulePermissions) =>
    hasDeleteAccess(userRole, module),

  canShowAuthorizeButton: (userRole: string, module: keyof ModulePermissions) =>
    hasAuthorizationAccess(userRole, module),

  shouldShowInNavigation: (userRole: string, module: keyof ModulePermissions) =>
    hasModuleAccess(userRole, module),
}