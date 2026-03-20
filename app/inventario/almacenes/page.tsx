import type { Metadata } from "next"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { InventoryModuleChrome } from "@/components/inventory/inventory-module-chrome"
import { WarehouseManagement } from "@/components/inventory/warehouse-management"

export const metadata: Metadata = {
  title: "Almacenes | Inventario",
  description: "Gestión de almacenes de inventario",
}

export default function WarehousesPage() {
  return (
    <DashboardShell>
      <InventoryModuleChrome
        title="Almacenes"
        description="Ubicaciones de stock por planta. Base para disponibilidad y surtido."
        activeHref="/inventario/almacenes"
      >
        <WarehouseManagement />
      </InventoryModuleChrome>
    </DashboardShell>
  )
}
