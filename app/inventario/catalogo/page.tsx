import type { Metadata } from "next"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { InventoryModuleChrome } from "@/components/inventory/inventory-module-chrome"
import { PartsCatalog } from "@/components/inventory/parts-catalog"

export const metadata: Metadata = {
  title: "Catálogo de Partes | Inventario",
  description: "Catálogo maestro de partes y consumibles",
}

export default function PartsCatalogPage() {
  return (
    <DashboardShell>
      <InventoryModuleChrome
        title="Catálogo de partes"
        description="Alta, edición y búsqueda en el catálogo maestro de repuestos y consumibles."
        activeHref="/inventario/catalogo"
      >
        <PartsCatalog />
      </InventoryModuleChrome>
    </DashboardShell>
  )
}
