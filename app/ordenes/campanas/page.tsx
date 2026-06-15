"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import {
  CampaignsThemeView,
  type CampaignListItem,
} from "@/components/campaigns/campaigns-theme-view"
import type { IssueThemeId } from "@/lib/maintenance/issue-theme-taxonomy"
import type { InspectionCohortId } from "@/lib/incidents/inspection-cohort"
import { MapPin } from "lucide-react"

function CampanasContent() {
  const searchParams = useSearchParams()
  const theme = searchParams.get("theme") as IssueThemeId | null
  const cohort = (searchParams.get("cohort") ?? "june_2026_inspection") as InspectionCohortId

  const [workOrders, setWorkOrders] = useState<Record<string, unknown>[]>([])
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/work-orders/list").then((r) => (r.ok ? r.json() : { workOrders: [] })),
      fetch("/api/campaigns").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([woList, camps]) => {
        setWorkOrders(woList.workOrders ?? [])
        setCampaigns(camps)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Campañas" text="" />
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Campañas de mantenimiento"
        text="Agrupe OTs por tema sin modificar incidentes"
      >
        <Button asChild variant="outline" size="sm" className="cursor-pointer">
          <Link href={`/ordenes/planificacion?cohort=${cohort}`}>
            <MapPin className="mr-2 h-4 w-4" />
            Planificación
          </Link>
        </Button>
      </DashboardHeader>
      <CampaignsThemeView
        workOrders={workOrders as Parameters<typeof CampaignsThemeView>[0]["workOrders"]}
        campaigns={campaigns}
        initialTheme={theme ?? undefined}
        initialCohort={cohort}
      />
    </DashboardShell>
  )
}

export default function CampanasPage() {
  return (
    <Suspense fallback={<DashboardShell><DashboardHeader heading="Campañas" text="" /></DashboardShell>}>
      <CampanasContent />
    </Suspense>
  )
}
