'use client'

import Link from 'next/link'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import {
  filterReportsForProfile,
  GERENCIAL_METRICS_SPEC,
  type ReportCatalogEntry,
} from '@/lib/reports/reports-catalog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, ChevronRight, Fuel, FileText, Wrench } from 'lucide-react'

function groupIcon(group: ReportCatalogEntry['group']) {
  switch (group) {
    case 'gerencial':
      return BarChart3
    case 'operativo':
      return Fuel
    default:
      return FileText
  }
}

export function ReportsHub() {
  const { profile, ui } = useAuthZustand()
  const entries = profile ? filterReportsForProfile(profile) : []

  if (!profile) {
    return <p className="text-sm text-muted-foreground">Cargando permisos…</p>
  }

  if (!ui.shouldShowInNavigation('reports')) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-base text-amber-950">Sin acceso a reportes</CardTitle>
          <CardDescription className="text-amber-900/80">
            Tu rol no incluye el módulo de reportes. Si necesitas acceso, contacta a Gerencia General o
            Administración.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const gerencial = entries.filter((e) => e.group === 'gerencial')
  const operativo = entries.filter((e) => e.group === 'operativo')
  const legacy = entries.filter((e) => e.group === 'legacy')

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Reportes gerenciales</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Paquete financiero y de mantenimiento. Las métricas de diésel (L/h, L/km) siguen la misma política que{' '}
          <Link href="/reportes/eficiencia-diesel" className="underline font-medium text-foreground">
            Eficiencia diésel
          </Link>
          .
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gerencial.map((entry) => (
            <ReportCard key={entry.id} entry={entry} />
          ))}
        </div>
      </section>

      {operativo.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Operativos</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {operativo.map((entry) => (
              <ReportCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {legacy.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Otros</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {legacy.map((entry) => (
              <ReportCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Definición de métricas (gerencial)
          </h2>
        </div>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="p-3 font-medium">Métrica</th>
                <th className="p-3 font-medium">Origen</th>
                <th className="p-3 font-medium hidden md:table-cell">Alineación</th>
              </tr>
            </thead>
            <tbody>
              {GERENCIAL_METRICS_SPEC.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{row.label}</td>
                  <td className="p-3 text-muted-foreground">{row.source}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">
                    {row.alignedWith ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function ReportCard({ entry }: { entry: ReportCatalogEntry }) {
  const Icon = groupIcon(entry.group)
  return (
    <Link href={entry.href} className="block group">
      <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/30">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
          </div>
          <CardTitle className="text-base">{entry.label}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">{entry.description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <span className="text-xs font-medium text-primary">Abrir reporte →</span>
        </CardContent>
      </Card>
    </Link>
  )
}
