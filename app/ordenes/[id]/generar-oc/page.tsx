import { PurchaseOrderForm } from "@/components/work-orders/purchase-order-form"
import { createClient } from "@/lib/supabase"
import { redirect } from "next/navigation"

export default async function GeneratePurchaseOrderPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  
  // Check if work order exists and doesn't already have a purchase order
  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .select("id, purchase_order_id, type, required_parts")
    .eq("id", params.id)
    .single()
    
  if (error || !workOrder) {
    // Work order not found, redirect to work orders list
    redirect("/ordenes")
  }
  
  // If work order already has a purchase order, redirect to it
  if (workOrder.purchase_order_id) {
    redirect(`/compras/${workOrder.purchase_order_id}`)
  }
  
  // If work order doesn't have required parts, redirect to edit it
  if (!workOrder.required_parts) {
    redirect(`/ordenes/${params.id}/editar`)
  }
  
  return (
    <div className="container py-4 md:py-8">
      <PurchaseOrderForm workOrderId={params.id} />
    </div>
  )
} 