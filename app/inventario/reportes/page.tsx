import type { Metadata } from "next"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { InventoryModuleChrome } from "@/components/inventory/inventory-module-chrome"
import { InventoryReports } from "@/components/inventory/inventory-reports"

export const metadata: Metadata = {
  title: "Reportes de Inventario | Inventario",
  description: "Reportes y análisis de inventario",
}

export default function InventoryReportsPage() {
  return (
    <DashboardShell>
      <InventoryModuleChrome
        title="Reportes"
        description="Stock bajo, reservas y valoración para decisiones operativas."
        activeHref="/inventario/reportes"
      >
        <InventoryReports />
      </InventoryModuleChrome>
    </DashboardShell>
  )
}
