'use client'

import type { SlaDepartmentRanking } from '@/lib/reports/incident-sla-metrics'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  departments: SlaDepartmentRanking[]
}

export function IncidentSlaDepartmentRanking({ departments }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ranking por departamento</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Departamento</TableHead>
              <TableHead className="text-right">Incidencias</TableHead>
              <TableHead className="text-right">Incumplimientos</TableHead>
              <TableHead className="text-right">% cumplimiento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Sin datos en el periodo seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              departments.map((dept) => (
                <TableRow key={dept.departmentId ?? 'unrouted'}>
                  <TableCell>{dept.departmentName}</TableCell>
                  <TableCell className="text-right">{dept.total}</TableCell>
                  <TableCell className="text-right text-red-600">{dept.breaches}</TableCell>
                  <TableCell className="text-right">
                    {dept.compliancePct === null ? '—' : `${dept.compliancePct}%`}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
