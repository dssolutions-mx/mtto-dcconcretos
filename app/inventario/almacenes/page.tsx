import type { Metadata } from "next"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { WarehouseManagement } from "@/components/inventory/warehouse-management"

export const metadata: Metadata = {
  title: "Almacenes | Inventario",
  description: "Gestión de almacenes de inventario",
}

export default function WarehousesPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Gestión de Almacenes"
        text="Administra los almacenes de inventario por planta."
        id="warehouses-header"
      />
      <WarehouseManagement />
    </DashboardShell>
  )
}
