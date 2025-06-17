import type { Metadata } from "next"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { EnhancedPurchaseOrderCreationForm } from "@/components/purchase-orders/creation/EnhancedPurchaseOrderCreationForm"

export const metadata: Metadata = {
  title: "Crear Orden de Compra Tipificada | Sistema de Gestión de Mantenimiento",
  description: "Crear una orden de compra usando el sistema tipificado de 3 tipos",
}

interface PageProps {
  searchParams: Promise<{
    workOrderId?: string
    type?: string
  }>
}

export default async function CreateTypedPurchaseOrderPage({ searchParams }: PageProps) {
  // Await searchParams before accessing its properties
  const resolvedSearchParams = await searchParams
  const { workOrderId, type } = resolvedSearchParams

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Crear Orden de Compra"
        text="Sistema inteligente de órdenes de compra basado en 3 tipos: Compra Directa, Servicio Directo y Pedido Especial."
      />
      <EnhancedPurchaseOrderCreationForm 
        workOrderId={workOrderId}
        initialType={type}
      />
    </DashboardShell>
  )
} 