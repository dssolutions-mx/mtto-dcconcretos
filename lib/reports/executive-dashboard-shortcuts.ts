import type { LegacyDbRole } from '@/lib/auth/role-model'

export type DashboardReportShortcut = {
  label: string
  href: string
}

/** Quick links for executive roles — surfaced on role dashboards. */
export function reportShortcutsForRole(role: string | null | undefined): DashboardReportShortcut[] {
  switch (role as LegacyDbRole | undefined) {
    case 'GERENCIA_GENERAL':
      return [
        { label: 'Centro de reportes', href: '/reportes' },
        { label: 'Reporte gerencial', href: '/reportes/gerencial' },
        { label: 'Informe ejecutivo', href: '/reportes/gerencial/informe-ejecutivo' },
        { label: 'Ingresos vs gastos', href: '/reportes/gerencial/ingresos-gastos' },
        { label: 'Eficiencia diésel', href: '/reportes/eficiencia-diesel' },
      ]
    case 'GERENTE_MANTENIMIENTO':
      return [
        { label: 'Informe ejecutivo', href: '/reportes/gerencial/informe-ejecutivo' },
        { label: 'Reporte gerencial', href: '/reportes/gerencial' },
        { label: 'Eficiencia diésel', href: '/reportes/eficiencia-diesel' },
        { label: 'Ingresos vs gastos', href: '/reportes/gerencial/ingresos-gastos' },
      ]
    case 'JEFE_UNIDAD_NEGOCIO':
      return [
        { label: 'Ingresos vs gastos', href: '/reportes/gerencial/ingresos-gastos' },
        { label: 'Reporte gerencial', href: '/reportes/gerencial' },
        { label: 'Informe ejecutivo', href: '/reportes/gerencial/informe-ejecutivo' },
        { label: 'Eficiencia diésel', href: '/reportes/eficiencia-diesel' },
      ]
    case 'AREA_ADMINISTRATIVA':
      return [
        { label: 'Ingresos vs gastos', href: '/reportes/gerencial/ingresos-gastos' },
        { label: 'Centro de mando', href: '/reportes/gerencial/analisis-costos' },
        { label: 'Reporte gerencial', href: '/reportes/gerencial' },
      ]
    default:
      return [{ label: 'Centro de reportes', href: '/reportes' }]
  }
}
