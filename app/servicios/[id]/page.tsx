import { Metadata } from "next"
import { ServiceOrderDetail } from "@/components/service-orders/service-order-detail"
import { BreadcrumbSetter } from "@/components/navigation/breadcrumb-setter"

export const metadata: Metadata = {
  title: "Detalle de Orden de Servicio",
  description: "Información detallada de una orden de servicio",
}

export default async function ServiceOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="container py-8">
      <BreadcrumbSetter
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Órdenes de Trabajo", href: "/ordenes" }]}
      />
      <ServiceOrderDetail id={id} />
    </div>
  )
} 