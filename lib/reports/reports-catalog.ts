import {
  effectiveRoleForPermissions,
  type FutureBusinessRole,
  type LegacyDbRole,
} from '@/lib/auth/role-model'
import {
  hasModuleAccess,
  hasWriteAccess,
  type ModulePermissions,
} from '@/lib/auth/role-permissions'

export type ReportCatalogEntry = {
  id: string
  href: string
  label: string
  description: string
  group: 'gerencial' | 'operativo' | 'legacy'
  /** Path prefix for active state (defaults to href) */
  matchPrefix?: string
}

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  {
    id: 'gerencial',
    href: '/reportes/gerencial',
    label: 'Reporte gerencial',
    description: 'Ventas, diésel FIFO, mantenimiento y producción por activo, planta y unidad.',
    group: 'gerencial',
  },
  {
    id: 'informe-ejecutivo',
    href: '/reportes/gerencial/informe-ejecutivo',
    label: 'Informe ejecutivo',
    description: 'Análisis de mantenimiento para dirección (gráficos, ratios, top equipos).',
    group: 'gerencial',
  },
  {
    id: 'ingresos-gastos',
    href: '/reportes/gerencial/ingresos-gastos',
    label: 'Ingresos vs gastos',
    description: 'P&L por planta: ventas, diésel, MANTTO, nómina, EBITDA.',
    group: 'gerencial',
  },
  {
    id: 'analisis-costos',
    href: '/reportes/gerencial/analisis-costos',
    label: 'Centro de mando',
    description: 'Estructura de costos, correctivo vs preventivo, drill-down financiero.',
    group: 'gerencial',
  },
  {
    id: 'manual-costs',
    href: '/reportes/gerencial/manual-costs',
    label: 'Costos manuales',
    description: 'Ajustes y cargas indirectas que alimentan ingresos-gastos.',
    group: 'gerencial',
  },
  {
    id: 'eficiencia-diesel',
    href: '/reportes/eficiencia-diesel',
    label: 'Eficiencia diésel',
    description: 'L/h y L/km confiables por activo — fuente de verdad para métricas operativas.',
    group: 'operativo',
    matchPrefix: '/reportes/eficiencia-diesel',
  },
  {
    id: 'checklists',
    href: '/reportes/checklists',
    label: 'Checklists',
    description: 'Cumplimiento de inspecciones y problemas recurrentes.',
    group: 'operativo',
  },
  {
    id: 'legacy-analytics',
    href: '/reportes',
    label: 'Dashboard analítico',
    description: 'Vista histórica de indicadores (reporte ejecutivo legacy).',
    group: 'legacy',
    matchPrefix: '/reportes',
  },
]

const MANUAL_COSTS_ROLES = new Set<LegacyDbRole | FutureBusinessRole>([
  'GERENCIA_GENERAL',
  'AREA_ADMINISTRATIVA',
  'GERENTE_MANTENIMIENTO',
  'JEFE_UNIDAD_NEGOCIO',
])

/** Ingresos vs gastos P&L — solo dirección general y jefes de unidad de negocio. */
const INGRESOS_GASTOS_ROLES = new Set<LegacyDbRole | FutureBusinessRole>([
  'GERENCIA_GENERAL',
  'JEFE_UNIDAD_NEGOCIO',
])

export const INGRESOS_GASTOS_PATH_PREFIX = '/reportes/gerencial/ingresos-gastos'

function roleInSet(
  profile: { role?: string | null; business_role?: string | null },
  allowed: Set<LegacyDbRole | FutureBusinessRole>
): boolean {
  const role = profile.role as LegacyDbRole | undefined
  const br = profile.business_role as FutureBusinessRole | undefined
  return (
    (role != null && allowed.has(role)) || (br != null && allowed.has(br))
  )
}

function permissionRoleKey(profile: {
  role?: string | null
  business_role?: string | null
}): string | null {
  return effectiveRoleForPermissions(profile)
}

/** Whether the user may open any report route. */
export function canAccessReportsModule(profile: {
  role?: string | null
  business_role?: string | null
}): boolean {
  const key = permissionRoleKey(profile)
  return key ? hasModuleAccess(key, 'reports') : false
}

export function canAccessIngresosGastosReport(profile: {
  role?: string | null
  business_role?: string | null
}): boolean {
  if (!canAccessReportsModule(profile)) return false
  return roleInSet(profile, INGRESOS_GASTOS_ROLES)
}

export function canAccessManualCostsReport(profile: {
  role?: string | null
  business_role?: string | null
}): boolean {
  if (!canAccessReportsModule(profile)) return false
  const key = permissionRoleKey(profile)
  if (!key) return false
  if (hasWriteAccess(key, 'config')) return true
  return roleInSet(profile, MANUAL_COSTS_ROLES)
}

export function filterReportsForProfile(profile: {
  role?: string | null
  business_role?: string | null
}): ReportCatalogEntry[] {
  if (!canAccessReportsModule(profile)) return []

  return REPORT_CATALOG.filter((entry) => {
    if (entry.id === 'ingresos-gastos') return canAccessIngresosGastosReport(profile)
    if (entry.id === 'manual-costs') return canAccessManualCostsReport(profile)
    if (entry.id === 'legacy-analytics') {
      const key = permissionRoleKey(profile)
      return key ? hasModuleAccess(key, 'reports') : false
    }
    return true
  })
}

/** Nav items for sidebar (excludes legacy hub duplicate when gerencial exists). */
export function reportsNavItemsForProfile(profile: {
  role?: string | null
  business_role?: string | null
}): ReportCatalogEntry[] {
  return filterReportsForProfile(profile).filter((e) => e.id !== 'legacy-analytics')
}

export function reportEntryMatchesPath(entry: ReportCatalogEntry, pathname: string): boolean {
  const prefix = entry.matchPrefix ?? entry.href
  if (entry.id === 'legacy-analytics') {
    return pathname === '/reportes'
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Report-specific gates on top of module `reports` access (used by RoleProvider). */
export function canAccessReportPath(
  profile: { role?: string | null; business_role?: string | null },
  pathname: string
): boolean {
  if (!pathname.startsWith('/reportes')) return true
  if (!canAccessReportsModule(profile)) return false
  if (
    pathname === INGRESOS_GASTOS_PATH_PREFIX ||
    pathname.startsWith(`${INGRESOS_GASTOS_PATH_PREFIX}/`)
  ) {
    return canAccessIngresosGastosReport(profile)
  }
  if (pathname.startsWith('/reportes/gerencial/manual-costs')) {
    return canAccessManualCostsReport(profile)
  }
  return true
}

export function activeReportFromPath(
  pathname: string,
  profile: { role?: string | null; business_role?: string | null }
): ReportCatalogEntry | null {
  const entries = filterReportsForProfile(profile)
  const sorted = [...entries].sort(
    (a, b) => (b.matchPrefix ?? b.href).length - (a.matchPrefix ?? a.href).length
  )
  for (const entry of sorted) {
    if (reportEntryMatchesPath(entry, pathname)) return entry
  }
  return null
}

export type GerencialMetricSpec = {
  id: string
  label: string
  source: string
  alignedWith?: string
}

/** Documented metric lineage for gerencial / informe / eficiencia diésel. */
export const GERENCIAL_METRICS_SPEC: GerencialMetricSpec[] = [
  {
    id: 'diesel_cost',
    label: 'Costo diésel',
    source: 'FIFO por transacción de consumo (lib/fifo-diesel-costs)',
    alignedWith: 'ingresos-gastos diesel_total',
  },
  {
    id: 'diesel_liters',
    label: 'Litros diésel',
    source: 'Suma quantity_liters en consumos (excl. transferencias)',
    alignedWith: 'eficiencia-diesel total_liters',
  },
  {
    id: 'liters_per_hour',
    label: 'L/h',
    source: 'litros / horas confiables (merged-first, diesel-efficiency-hours-policy)',
    alignedWith: 'asset_diesel_efficiency_monthly.liters_per_hour_trusted',
  },
  {
    id: 'liters_per_km',
    label: 'L/km',
    source: 'litros / km confiables (computeMergedOperatingKmByAsset)',
    alignedWith: 'asset_diesel_efficiency_monthly.liters_per_km',
  },
  {
    id: 'maintenance_cost',
    label: 'Mantenimiento',
    source: 'POs con OT, excl. restock; preventivo/correctivo por tipo OT',
    alignedWith: 'ingresos-gastos mantto_total',
  },
  {
    id: 'concrete_m3',
    label: 'Producción m³',
    source: 'Cotizador remisiones / vista financiera unificada',
    alignedWith: 'ingresos-gastos volumen_concreto',
  },
  {
    id: 'cost_per_m3',
    label: 'Costo mantenimiento / m³',
    source: 'totalMaintenanceCost / totalConcreteM3 (informe rollup)',
  },
]

export type ReportsModuleKey = keyof ModulePermissions
