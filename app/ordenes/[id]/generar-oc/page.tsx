import { createClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { use } from "react"

export default async function GeneratePurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Unwrap the params promise using React.use()
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  const supabase = await createClient();
  
  // Check if work order exists and doesn't already have a purchase order
  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .select("id, purchase_order_id, type, required_parts, estimated_cost")
    .eq("id", id)
    .single();
    
  if (error || !workOrder) {
    // Work order not found, redirect to work orders list
    redirect("/ordenes");
  }
  
  // If work order already has a purchase order, redirect to it
  if (workOrder.purchase_order_id) {
    redirect(`/compras/${workOrder.purchase_order_id}`);
  }
  
  // Enhanced logic: Allow PO generation if work order has required_parts OR estimated_cost > 0 OR is corrective
  const canGeneratePO = 
    workOrder.required_parts || 
    (workOrder.estimated_cost && workOrder.estimated_cost > 0) ||
    workOrder.type === 'corrective';
  
  // If work order doesn't meet criteria for PO generation, redirect to edit it
  if (!canGeneratePO) {
    redirect(`/ordenes/${id}/editar`);
  }

  // Redirect to the new typed purchase order creation system
  // This integrates work orders with the new enhanced purchase order system
  redirect(`/compras/crear-tipificada?workOrderId=${id}`);
} 