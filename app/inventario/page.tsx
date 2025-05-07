import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { InventoryList } from "@/components/inventory/inventory-list"
import { Plus, FileDown, FileUp } from "lucide-react"

export const metadata: Metadata = {
  title: "Inventario | Sistema de Gestión de Mantenimiento",
  description: "Gestión de inventario y garantías",
}

export default function InventoryPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Gestión de Inventario y Garantías"
        text="Administra repuestos, consumibles y sus garantías asociadas."
      >
        <div className="flex gap-2">
          <Button variant="outline">
            <FileDown className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline">
            <FileUp className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Ítem
          </Button>
        </div>
      </DashboardHeader>
      <InventoryList />
    </DashboardShell>
  )
}
