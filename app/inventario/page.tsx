import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { InventoryList } from "@/components/inventory/inventory-list"
import { Plus, Package, Warehouse, FileText, BarChart3 } from "lucide-react"

export const metadata: Metadata = {
  title: "Inventario | Sistema de Gestión de Mantenimiento",
  description: "Gestión de inventario y garantías",
}

export default function InventoryPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Gestión de Inventario"
        text="Administra repuestos, consumibles, almacenes y movimientos de inventario."
        id="inventario-header"
      >
        <div className="flex gap-2">
          <Link href="/inventario/catalogo">
            <Button variant="outline">
              <Package className="mr-2 h-4 w-4" />
              Catálogo
            </Button>
          </Link>
          <Link href="/inventario/almacenes">
            <Button variant="outline">
              <Warehouse className="mr-2 h-4 w-4" />
              Almacenes
            </Button>
          </Link>
          <Link href="/inventario/movimientos">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Movimientos
            </Button>
          </Link>
          <Link href="/inventario/reportes">
            <Button variant="outline">
              <BarChart3 className="mr-2 h-4 w-4" />
              Reportes
            </Button>
          </Link>
          <Link href="/inventario/catalogo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Parte
            </Button>
          </Link>
        </div>
      </DashboardHeader>
      <InventoryList />
    </DashboardShell>
  )
}
