import type { Metadata } from "next"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { MovementHistory } from "@/components/inventory/movement-history"

export const metadata: Metadata = {
  title: "Historial de Movimientos | Inventario",
  description: "Historial completo de movimientos de inventario",
}

export default function MovementsPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Historial de Movimientos"
        text="Consulta el historial completo de todos los movimientos de inventario."
        id="movements-header"
      />
      <MovementHistory />
    </DashboardShell>
  )
}
