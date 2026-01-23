import type { Metadata } from "next"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { InventoryReports } from "@/components/inventory/inventory-reports"

export const metadata: Metadata = {
  title: "Reportes de Inventario | Inventario",
  description: "Reportes y análisis de inventario",
}

export default function InventoryReportsPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Reportes de Inventario"
        text="Reportes de stock bajo, reservas antiguas y valoración de inventario."
        id="inventory-reports-header"
      />
      <InventoryReports />
    </DashboardShell>
  )
}
