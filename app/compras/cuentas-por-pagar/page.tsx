import type { Metadata } from "next"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { AccountsPayableView } from "@/components/purchase-orders/AccountsPayableView"

export const metadata: Metadata = {
  title: "Cuentas por Pagar | Sistema de Gestión de Mantenimiento",
  description: "Gestión de pagos pendientes y seguimiento de vencimientos de órdenes de compra",
}

export default function AccountsPayablePage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Cuentas por Pagar"
        text="Control y seguimiento de pagos pendientes, vencimientos y flujo de caja para órdenes de compra."
      />
      <AccountsPayableView />
    </DashboardShell>
  )
} 