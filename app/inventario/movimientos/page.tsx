import type { Metadata } from "next"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { InventoryModuleChrome } from "@/components/inventory/inventory-module-chrome"
import { MovementHistory } from "@/components/inventory/movement-history"

export const metadata: Metadata = {
  title: "Historial de Movimientos | Inventario",
  description: "Historial completo de movimientos de inventario",
}

export default function MovementsPage() {
  return (
    <DashboardShell>
      <InventoryModuleChrome
        title="Movimientos"
        description="Entradas, salidas y ajustes registrados en inventario, incluido surtido vinculado a órdenes de compra."
        activeHref="/inventario/movimientos"
      >
        <MovementHistory />
      </InventoryModuleChrome>
    </DashboardShell>
  )
}
