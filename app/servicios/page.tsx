import { Metadata } from "next"
import { ServiceOrdersList } from "@/components/service-orders/service-orders-list"

export const metadata: Metadata = {
  title: "Órdenes de Servicio",
  description: "Gestión de órdenes de servicio de mantenimiento",
}

export default function ServiceOrdersPage() {
  return (
    <div className="container py-8">
      <ServiceOrdersList />
    </div>
  )
} 