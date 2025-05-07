import type { Metadata } from "next"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ServiceOrderDetails } from "@/components/work-orders/service-order-details"

export const metadata: Metadata = {
  title: "Detalles de Orden de Servicio | Sistema de Gestión de Mantenimiento",
  description: "Detalles de la orden de servicio",
}

interface ServiceOrderPageProps {
  params: {
    id: string
  }
}

export default function ServiceOrderPage({ params }: ServiceOrderPageProps) {
  return (
    <DashboardShell>
      <ServiceOrderDetails orderId={params.id} />
    </DashboardShell>
  )
}
