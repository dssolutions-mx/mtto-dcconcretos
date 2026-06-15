"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { PlanningCockpit } from "@/components/planning/planning-cockpit"
import { cohortToBounds } from "@/lib/incidents/inspection-cohort"
import type { InspectionCohortId } from "@/lib/incidents/inspection-cohort"
import { incidentEffectiveMs } from "@/lib/incidents/incident-date-filter"

function PlanificacionContent() {
  const searchParams = useSearchParams()
  const cohortParam = (searchParams.get("cohort") ?? "june_2026_inspection") as InspectionCohortId
  const plantId = searchParams.get("plantId") ?? undefined

  const [incidents, setIncidents] = useState<Record<string, unknown>[]>([])
  const [workOrders, setWorkOrders] = useState<Record<string, unknown>[]>([])
  const [operationalCount, setOperationalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/incidents").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/work-orders/list").then((r) => (r.ok ? r.json() : { workOrders: [] })),
      fetch("/api/assets").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([inc, woList, assets]) => {
        setIncidents(inc)
        setWorkOrders(woList.workOrders ?? woList ?? [])
        const operational = (assets as Array<{ status?: string }>).filter(
          (a) => a.status === "operational",
        )
        setOperationalCount(operational.length)
      })
      .finally(() => setLoading(false))
  }, [])

  const inspectedAssetIds = useMemo(() => {
    const bounds = cohortToBounds(cohortParam)
    if (!bounds) return []
    const ids = new Set<string>()
    for (const inc of incidents) {
      const ms = incidentEffectiveMs(inc as { date?: string; created_at?: string })
      if (!Number.isFinite(ms) || ms < bounds.fromMs || ms > bounds.toMs) continue
      if (typeof inc.asset_id === "string") ids.add(inc.asset_id)
    }
    return [...ids]
  }, [incidents, cohortParam])

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Planificación" text="" />
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Planificación post-revisión"
        text="Organice la atención de hallazgos por tema, unidad y campaña"
      />
      <PlanningCockpit
        incidents={incidents}
        workOrders={workOrders}
        operationalAssetCount={operationalCount}
        inspectedAssetIds={inspectedAssetIds}
        initialCohort={cohortParam}
        initialPlantId={plantId}
      />
    </DashboardShell>
  )
}

export default function PlanificacionPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <DashboardHeader heading="Planificación" text="" />
        </DashboardShell>
      }
    >
      <PlanificacionContent />
    </Suspense>
  )
}
