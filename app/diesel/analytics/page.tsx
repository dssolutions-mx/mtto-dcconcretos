"use client"

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
      <DieselAnalyticsDashboard />
    </DashboardShell>
  )
}
