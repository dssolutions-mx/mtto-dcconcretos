import type { Metadata } from "next"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { PartsCatalog } from "@/components/inventory/parts-catalog"

export const metadata: Metadata = {
  title: "Catálogo de Partes | Inventario",
  description: "Catálogo maestro de partes y consumibles",
}

export default function PartsCatalogPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Catálogo de Partes"
        text="Administra el catálogo maestro de partes, repuestos y consumibles."
        id="parts-catalog-header"
      />
      <PartsCatalog />
    </DashboardShell>
  )
}
