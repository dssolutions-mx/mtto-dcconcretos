'use client'

import Link from 'next/link'
import type { IncidentSlaRow, SlaMetricKind } from '@/lib/reports/incident-sla-metrics'
import { isSlaBreachedRow } from '@/lib/reports/incident-sla-metrics'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Props = {
  rows: IncidentSlaRow[]
  metric: SlaMetricKind | 'any'
}

function nextAction(row: IncidentSlaRow): { label: string; href: string } {
  if (!row.department_name || row.department_name === 'Sin departamento') {
    return { label: 'Clasificar', href: `/incidentes/${row.incident_id}` }
  }
  if (!row.assignee_name) {
    return { label: 'Asignar', href: `/incidentes/${row.incident_id}` }
  }
  if (row.met_ack_target === false) {
    return { label: 'Acusar', href: `/incidentes/${row.incident_id}` }
  }
  if (row.met_schedule_target === false) {
    return { label: 'Programar OT', href: `/incidentes/${row.incident_id}` }
  }
  return { label: 'Ver detalle', href: `/incidentes/${row.incident_id}` }
}
function breachLabel(row: IncidentSlaRow): string {
  const labels: string[] = []
  if (row.met_ack_target === false) labels.push('Atención')
  if (row.met_schedule_target === false) labels.push('Programación')
  if (row.met_resolve_target === false) labels.push('Resolución')
  if (row.routing_sla_breached === true) labels.push('Enrutamiento')
  return labels.join(', ') || '—'
}

export function IncidentSlaBreachesTable({ rows, metric }: Props) {
  const filtered =
    metric === 'any' ? rows : rows.filter((row) => isSlaBreachedRow(row, metric))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Incidencias incumplidas</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Incumplimiento</TableHead>
              <TableHead>Siguiente acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No hay incumplimientos en el periodo.
                </TableCell>
              </TableRow>
            ) : (
              filtered.slice(0, 50).map((row) => {
                const action = nextAction(row)
                return (
                <TableRow key={row.incident_id}>
                  <TableCell>
                    {new Date(row.reported_at).toLocaleDateString('es-MX')}
                  </TableCell>
                  <TableCell>{row.incident_type ?? '—'}</TableCell>
                  <TableCell>{row.department_name ?? 'Sin departamento'}</TableCell>
                  <TableCell>{row.assignee_name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">{breachLabel(row)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={action.href}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      {action.label}
                    </Link>
                  </TableCell>
                </TableRow>
              )})
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
