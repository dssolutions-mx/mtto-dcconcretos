"use client"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DieselAnalyticsDashboard } from "@/components/diesel-analytics/diesel-analytics-dashboard"

export default function DieselAnalyticsPage() {
  return (
    <DashboardShell className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-12">
      <DashboardHeader
        heading="Analíticas de diesel"
        text="Resumen por periodo, almacenes, activos y excepciones de calidad de datos (sin telemetría)."
        id="diesel-analytics-header"
      />
      <Suspense
        fallback={
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        }
      >
        <DieselAnalyticsDashboard />
      </Suspense>
    </DashboardShell>
  )
}
