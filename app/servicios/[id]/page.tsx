import { Metadata } from "next"
import { ServiceOrderDetail } from "@/components/service-orders/service-order-detail"

export const metadata: Metadata = {
  title: "Detalle de Orden de Servicio",
  description: "Información detallada de una orden de servicio",
}

interface ServiceOrderPageProps {
  params: {
    id: string
  }
}

export default function ServiceOrderPage({ params }: ServiceOrderPageProps) {
  return (
    <div className="container py-8">
      <ServiceOrderDetail id={params.id} />
    </div>
  )
} 