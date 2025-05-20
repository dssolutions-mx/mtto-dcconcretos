import { WorkOrderCompletionForm } from "@/components/work-orders/work-order-completion-form"
import { createClient } from "@/lib/supabase-server"
import { WorkOrderStatus } from "@/types"
import { redirect } from "next/navigation"
import { use } from "react"

export default function CompleteWorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  // Return the content component with the id
  return <CompleteWorkOrderContent id={id} />;
}

// Create an async server component for the content
async function CompleteWorkOrderContent({ id }: { id: string }) {
  const supabase = await createClient();
  
  // Check if work order exists and is not already completed
  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .select("id, status")
    .eq("id", id)
    .single();
    
  if (error || !workOrder) {
    // Work order not found, redirect to work orders list
    redirect("/ordenes");
  }
  
  // If work order is already completed, redirect to it
  if (workOrder.status === WorkOrderStatus.Completed) {
    redirect(`/ordenes/${id}`);
  }
  
  return (
    <div className="container py-4 md:py-8">
      <WorkOrderCompletionForm workOrderId={id} />
    </div>
  );
} 