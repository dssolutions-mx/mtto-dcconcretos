'use client'

import type { SlaMonthlyTrend } from '@/lib/reports/incident-sla-metrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  trend: SlaMonthlyTrend[]
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
}

export function IncidentSlaTrendChart({ trend }: Props) {
  const maxTotal = Math.max(...trend.map((row) => row.total), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tendencia mensual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {trend.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos en el periodo.</p>
        ) : (
          trend.map((row) => (
            <div key={row.month} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{formatMonth(row.month)}</span>
                <span className="text-muted-foreground">
                  {row.total} incidencias · prog.{' '}
                  {row.scheduleCompliancePct === null ? '—' : `${row.scheduleCompliancePct}%`} · res.{' '}
                  {row.resolveCompliancePct === null ? '—' : `${row.resolveCompliancePct}%`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.max(8, (row.total / maxTotal) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
