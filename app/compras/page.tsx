import type { Metadata } from "next"
import { PurchaseOrdersList } from "@/components/work-orders/purchase-orders-list"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

export const metadata: Metadata = {
  title: "Órdenes de Compra | Sistema de Gestión de Mantenimiento",
  description: "Lista y gestión de órdenes de compra",
}

export default function PurchaseOrdersPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Órdenes de Compra"
        text="Gestiona las órdenes de compra generadas a partir de órdenes de trabajo."
      />
      <PurchaseOrdersList />
    </DashboardShell>
  )
} 