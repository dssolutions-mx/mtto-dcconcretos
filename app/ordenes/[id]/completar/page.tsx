import { WorkOrderCompletionForm } from "@/components/work-orders/work-order-completion-form"
import { createClient } from "@/lib/supabase"
import { WorkOrderStatus } from "@/types"
import { redirect } from "next/navigation"

export default async function CompleteWorkOrderPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  
  // Check if work order exists and is not already completed
  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .select("id, status")
    .eq("id", params.id)
    .single()
    
  if (error || !workOrder) {
    // Work order not found, redirect to work orders list
    redirect("/ordenes")
  }
  
  // If work order is already completed, redirect to it
  if (workOrder.status === WorkOrderStatus.Completed) {
    redirect(`/ordenes/${params.id}`)
  }
  
  return (
    <div className="container py-4 md:py-8">
      <WorkOrderCompletionForm workOrderId={params.id} />
    </div>
  )
} 