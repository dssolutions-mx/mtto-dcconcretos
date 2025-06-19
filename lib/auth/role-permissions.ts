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
  permissions: ModulePermissions
  authorizationLimit: number
  scope: 'global' | 'business_unit' | 'plant'
  description: string
}

// Complete role configuration based on role_guard_structure.md
export const ROLE_PERMISSIONS: Record<string, RoleConfig> = {
  GERENCIA_GENERAL: {
    name: 'Gerencia General',
    permissions: {
      assets: 'full',
      maintenance: 'full',
      work_orders: 'full_auth',
      purchases: 'full_auth',
      inventory: 'full',
      personnel: 'full',
      checklists: 'full',
      reports: 'full',
      config: 'full'
    },
    authorizationLimit: Number.MAX_SAFE_INTEGER, // Sin límite
    scope: 'global',
    description: 'Acceso completo a todos los módulos sin restricciones'
  },
  JEFE_UNIDAD_NEGOCIO: {
    name: 'Jefe Unidad de Negocio',
    permissions: {
      assets: 'read_write',
      maintenance: 'full',
      work_orders: 'full_auth',
      purchases: 'read',
      inventory: 'read_write',
      personnel: 'full', // Solo su unidad
      checklists: 'full',
      reports: 'full',
      config: 'none'
    },
    authorizationLimit: 500000,
    scope: 'business_unit',
    description: 'Gestión completa de su unidad de negocio'
  },
  AREA_ADMINISTRATIVA: {
    name: 'Área Administrativa',
    permissions: {
      assets: 'read',
      maintenance: 'read',
      work_orders: 'full_auth',
      purchases: 'full_auth',
      inventory: 'full',
      personnel: 'full',
      checklists: 'none',
      reports: 'full', // Admin level
      config: 'read_write' // Básica
    },
    authorizationLimit: 100000,
    scope: 'global',
    description: 'Administración, autorización de compras y gestión de personal'
  },
  ENCARGADO_MANTENIMIENTO: {
    name: 'Encargado Mantenimiento',
    permissions: {
      assets: 'read_write',
      maintenance: 'full',
      work_orders: 'full',
      purchases: 'read_write',
      inventory: 'read_write',
      personnel: 'none',
      checklists: 'full',
      reports: 'read_write', // Mant level
      config: 'none'
    },
    authorizationLimit: 0,
    scope: 'plant',
    description: 'Gestión completa de mantenimiento en su planta'
  },
  JEFE_PLANTA: {
    name: 'Jefe de Planta',
    permissions: {
      assets: 'read_write', // Su planta
      maintenance: 'read_write', // Su planta
      work_orders: 'read_write', // Su planta
      purchases: 'read',
      inventory: 'read_write', // Su planta
      personnel: 'read_write', // Su planta
      checklists: 'read_write', // Su planta
      reports: 'read_write', // Su planta
      config: 'none'
    },
    authorizationLimit: 50000,
    scope: 'plant',
    description: 'Supervisión completa de su planta'
  },
  AUXILIAR_COMPRAS: {
    name: 'Auxiliar de Compras',
    permissions: {
      assets: 'none',
      maintenance: 'none',
      work_orders: 'none',
      purchases: 'full',
      inventory: 'full',
      personnel: 'none',
      checklists: 'none',
      reports: 'read', // Compras level
      config: 'none'
    },
    authorizationLimit: 0,
    scope: 'global',
    description: 'Gestión exclusiva de compras e inventario'
  },
  DOSIFICADOR: {
    name: 'Dosificador',
    permissions: {
      assets: 'none',
      maintenance: 'none',
      work_orders: 'none',
      purchases: 'none',
      inventory: 'none',
      personnel: 'none',
      checklists: 'read', // Solo ejecutar
      reports: 'none',
      config: 'none'
    },
    authorizationLimit: 0,
    scope: 'plant',
    description: 'Solo ejecución de checklists asignados'
  },
  OPERADOR: {
    name: 'Operador',
    permissions: {
      assets: 'none',
      maintenance: 'none',
      work_orders: 'none',
      purchases: 'none',
      inventory: 'none',
      personnel: 'none',
      checklists: 'read', // Solo ejecutar
      reports: 'none',
      config: 'none'
    },
    authorizationLimit: 0,
    scope: 'plant',
    description: 'Solo ejecución de checklists asignados'
  },
  VISUALIZADOR: {
    name: 'Visualizador',
    permissions: {
      assets: 'read',
      maintenance: 'read',
      work_orders: 'read',
      purchases: 'read',
      inventory: 'read',
      personnel: 'none',
      checklists: 'read',
      reports: 'read',
      config: 'none'
    },
    authorizationLimit: 0,
    scope: 'global',
    description: 'Solo visualización de información general'
  }
}

// Permission checking functions
export function hasModuleAccess(userRole: string, module: keyof ModulePermissions): boolean {
  const roleConfig = ROLE_PERMISSIONS[userRole]
  if (!roleConfig) return false
  
  return roleConfig.permissions[module] !== 'none'
}

export function hasWriteAccess(userRole: string, module: keyof ModulePermissions): boolean {
  const roleConfig = ROLE_PERMISSIONS[userRole]
  if (!roleConfig) return false
  
  const permission = roleConfig.permissions[module]
  return ['read_write', 'full', 'full_auth'].includes(permission)
}

export function hasCreateAccess(userRole: string, module: keyof ModulePermissions): boolean {
  const roleConfig = ROLE_PERMISSIONS[userRole]
  if (!roleConfig) return false
  
  const permission = roleConfig.permissions[module]
  return ['read_write', 'full', 'full_auth'].includes(permission)
}

export function hasDeleteAccess(userRole: string, module: keyof ModulePermissions): boolean {
  const roleConfig = ROLE_PERMISSIONS[userRole]
  if (!roleConfig) return false
  
  const permission = roleConfig.permissions[module]
  return ['full', 'full_auth'].includes(permission)
}

export function hasAuthorizationAccess(userRole: string, module: keyof ModulePermissions): boolean {
  const roleConfig = ROLE_PERMISSIONS[userRole]
  if (!roleConfig) return false
  
  return roleConfig.permissions[module] === 'full_auth'
}

export function canAuthorizeAmount(userRole: string, amount: number): boolean {
  const roleConfig = ROLE_PERMISSIONS[userRole]
  if (!roleConfig) return false
  
  return amount <= roleConfig.authorizationLimit
}

export function getAuthorizationLimit(userRole: string): number {
  const roleConfig = ROLE_PERMISSIONS[userRole]
  return roleConfig?.authorizationLimit || 0
}

export function getRoleScope(userRole: string): 'global' | 'business_unit' | 'plant' {
  const roleConfig = ROLE_PERMISSIONS[userRole]
  return roleConfig?.scope || 'plant'
}

export function getRoleDisplayName(userRole: string): string {
  const roleConfig = ROLE_PERMISSIONS[userRole]
  return roleConfig?.name || userRole
}

// Route access mapping
export const ROUTE_PERMISSIONS: Record<string, keyof ModulePermissions> = {
  '/activos': 'assets',
  '/preventivo': 'maintenance',
  '/ordenes': 'work_orders',
  '/compras': 'purchases',
  '/inventario': 'inventory',
  '/gestion/personal': 'personnel',
  '/checklists': 'checklists',
  '/reportes': 'reports',
  '/gestion': 'config'
}

// Specific route access checks for AREA_ADMINISTRATIVA
export function canAccessRoute(userRole: string, pathname: string): boolean {
  // Allow dashboard access for all authenticated users
  if (pathname === '/dashboard' || pathname === '/') return true
  
  // Check specific route permissions
  for (const [routePattern, module] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(routePattern)) {
      return hasModuleAccess(userRole, module)
    }
  }
  
  // Allow other routes by default (like profile, etc.)
  return true
}

// UI element visibility helpers
export const UI_PERMISSIONS = {
  // Buttons and actions
  canShowCreateButton: (userRole: string, module: keyof ModulePermissions) => 
    hasCreateAccess(userRole, module),
  
  canShowEditButton: (userRole: string, module: keyof ModulePermissions) => 
    hasWriteAccess(userRole, module),
  
  canShowDeleteButton: (userRole: string, module: keyof ModulePermissions) => 
    hasDeleteAccess(userRole, module),
  
  canShowAuthorizeButton: (userRole: string, module: keyof ModulePermissions) => 
    hasAuthorizationAccess(userRole, module),
  
  // Navigation items
  shouldShowInNavigation: (userRole: string, module: keyof ModulePermissions) => 
    hasModuleAccess(userRole, module)
} 