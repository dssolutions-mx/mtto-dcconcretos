'use client'

import type { SlaKpiSummary } from '@/lib/reports/incident-sla-metrics'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  kpis: SlaKpiSummary
}

function formatPct(value: number | null): string {
  if (value === null) return '—'
  return `${value}%`
}

function formatHours(value: number | null): string {
  if (value === null) return '—'
  if (value < 24) return `${value}h`
  return `${Math.round((value / 24) * 10) / 10}d`
}

export function IncidentSlaKpiStrip({ kpis }: Props) {
  const tiles = [
    { label: 'Incidencias', value: String(kpis.totalIncidents) },
    { label: 'MTTA (mediana)', value: formatHours(kpis.medianMttaHours) },
    { label: 'MTTR (mediana)', value: formatHours(kpis.medianMttrHours) },
    { label: 'Cumpl. atención', value: formatPct(kpis.ackCompliancePct) },
    { label: 'Cumpl. programación', value: formatPct(kpis.scheduleCompliancePct) },
    { label: 'Cumpl. resolución', value: formatPct(kpis.resolveCompliancePct) },
    { label: 'Cumpl. enrutamiento', value: formatPct(kpis.routingCompliancePct) },
    { label: 'Incumplimientos', value: String(kpis.breachCount), alert: kpis.breachCount > 0 },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {tiles.map((tile) => (
        <Card key={tile.label} className={tile.alert ? 'border-red-300 bg-red-50' : undefined}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{tile.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${tile.alert ? 'text-red-700' : ''}`}>
              {tile.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
