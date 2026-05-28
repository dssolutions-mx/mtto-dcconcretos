import type { LegacyDbRole } from '@/lib/auth/role-model'
import { canAccessIngresosGastosReport } from '@/lib/reports/reports-catalog'

export type DashboardReportShortcut = {
  label: string
  href: string
}

type ProfileLike = { role?: string | null; business_role?: string | null }

const BASE_BY_ROLE: Partial<Record<LegacyDbRole, DashboardReportShortcut[]>> = {
  GERENCIA_GENERAL: [
    { label: 'Centro de reportes', href: '/reportes' },
    { label: 'Ingresos vs gastos', href: '/reportes/gerencial/ingresos-gastos' },
    { label: 'Reporte gerencial', href: '/reportes/gerencial' },
    { label: 'Informe ejecutivo', href: '/reportes/gerencial/informe-ejecutivo' },
    { label: 'Eficiencia diésel', href: '/reportes/eficiencia-diesel' },
  ],
  JEFE_UNIDAD_NEGOCIO: [
    { label: 'Ingresos vs gastos', href: '/reportes/gerencial/ingresos-gastos' },
    { label: 'Reporte gerencial', href: '/reportes/gerencial' },
    { label: 'Informe ejecutivo', href: '/reportes/gerencial/informe-ejecutivo' },
    { label: 'Eficiencia diésel', href: '/reportes/eficiencia-diesel' },
  ],
  GERENTE_MANTENIMIENTO: [
    { label: 'Informe ejecutivo', href: '/reportes/gerencial/informe-ejecutivo' },
    { label: 'Reporte gerencial', href: '/reportes/gerencial' },
    { label: 'Eficiencia diésel', href: '/reportes/eficiencia-diesel' },
  ],
  AREA_ADMINISTRATIVA: [
    { label: 'Centro de mando', href: '/reportes/gerencial/analisis-costos' },
    { label: 'Reporte gerencial', href: '/reportes/gerencial' },
    { label: 'Centro de reportes', href: '/reportes' },
  ],
}

/** Quick links for executive roles — surfaced on role dashboards. */
export function reportShortcutsForRole(
  role: string | null | undefined,
  profile?: ProfileLike
): DashboardReportShortcut[] {
  const p = profile ?? { role }
  const list = BASE_BY_ROLE[role as LegacyDbRole] ?? [{ label: 'Centro de reportes', href: '/reportes' }]
  return list.filter((s) => {
    if (s.href.includes('/ingresos-gastos')) return canAccessIngresosGastosReport(p)
    return true
  })
}
