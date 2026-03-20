import type { Metadata } from "next"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { InventoryList } from "@/components/inventory/inventory-list"
import { InventoryModuleChrome } from "@/components/inventory/inventory-module-chrome"

export const metadata: Metadata = {
  title: "Inventario | Sistema de Gestión de Mantenimiento",
  description: "Gestión de inventario y garantías",
}

export default function InventoryPage() {
  return (
    <DashboardShell>
      <InventoryModuleChrome
        title="Inventario"
        description="Existencias por almacén, catálogo de partes y movimientos. Conectado con compras y órdenes de trabajo cuando el surtido sale del almacén."
        activeHref="/inventario"
      >
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Existencias
          </p>
          <InventoryList />
        </div>
      </InventoryModuleChrome>
    </DashboardShell>
  )
}
