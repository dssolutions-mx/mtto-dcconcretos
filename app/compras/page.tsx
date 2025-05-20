import { PurchaseOrdersList } from "@/components/work-orders/purchase-orders-list"

export const metadata = {
  title: "Órdenes de Compra",
  description: "Lista y gestión de órdenes de compra",
}

export default function PurchaseOrdersPage() {
  return (
    <div className="container py-4 md:py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Órdenes de Compra</h1>
      </div>
      
      <PurchaseOrdersList />
    </div>
  )
} 