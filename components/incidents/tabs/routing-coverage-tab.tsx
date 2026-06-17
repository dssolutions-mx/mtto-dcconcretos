'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { OrgFoundationSummary } from '@/lib/departments/department-coverage'

export function RoutingCoverageTab() {
  const [summary, setSummary] = useState<OrgFoundationSummary | null>(null)
  const [migrationPending, setMigrationPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/incidents/org-foundation')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar')
      setSummary(data.summary)
      setMigrationPending(!!data.migration_pending)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando diagnóstico de base organizacional…
      </div>
    )
  }

  if (error || !summary) {
    return <p className="text-sm text-red-600">{error ?? 'Sin datos'}</p>
  }

  const readinessPct =
    summary.open_incidents_total > 0
      ? Math.round((summary.open_incidents_routed / summary.open_incidents_total) * 100)
      : 0

  return (
    <div className="space-y-6">
      {migrationPending && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Migración pendiente</AlertTitle>
          <AlertDescription>
            La tabla <code>department_memberships</code> aún no está aplicada en producción.
            El sistema usa coincidencia por texto de <code>profiles.departamento</code> como respaldo.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Base organizacional para SLA</h2>
          <p className="text-sm text-muted-foreground">
            Antes de medir cumplimiento, la operación necesita departamentos completos, supervisores y
            personas vinculadas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button size="sm" asChild>
            <Link href="/gestion/departamentos">Gestionar departamentos</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Plantas con 4/4 canónicos</CardDescription>
            <CardTitle className="text-2xl">
              {summary.plants_fully_configured}/{summary.total_plants}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Departamentos con supervisor</CardDescription>
            <CardTitle className="text-2xl">
              {summary.departments_with_supervisor}/{summary.total_departments}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Membresías activas</CardDescription>
            <CardTitle className="text-2xl">{summary.total_memberships}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {summary.active_profiles_without_membership} perfiles sin departamento de ruteo
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Incidencias abiertas clasificadas</CardDescription>
            <CardTitle className="text-2xl">{readinessPct}%</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {summary.open_incidents_routed}/{summary.open_incidents_total} ruteadas ·{' '}
            {summary.open_incidents_assigned} asignadas · {summary.open_incidents_acknowledged} con acuse
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cobertura por planta</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Planta</TableHead>
                <TableHead>Canónicos</TableHead>
                <TableHead>Sin supervisor</TableHead>
                <TableHead>Sin miembros</TableHead>
                <TableHead>Faltantes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.plants.map((plant) => (
                <TableRow key={plant.plant_id}>
                  <TableCell className="font-medium">{plant.plant_name}</TableCell>
                  <TableCell>
                    {plant.canonical_configured}/{plant.canonical_total}
                  </TableCell>
                  <TableCell>{plant.departments_without_supervisor}</TableCell>
                  <TableCell>{plant.departments_without_members}</TableCell>
                  <TableCell>
                    {plant.missing_canonical.length === 0 ? (
                      <Badge variant="secondary">Completo</Badge>
                    ) : (
                      <span className="text-sm text-amber-700">
                        {plant.missing_canonical.join(', ')}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
