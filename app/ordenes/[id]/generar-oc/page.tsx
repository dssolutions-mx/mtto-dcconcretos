import { createClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { WorkOrderStatus } from "@/types"

export default async function GeneratePurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const supabase = await createClient();

  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .select("id, purchase_order_id, type, required_parts, estimated_cost, status")
    .eq("id", id)
    .single();

  if (error || !workOrder) {
    redirect("/ordenes");
  }

  // Allow additional purchase orders until the work order is completed (multi-provider / multi-OC).
  if (workOrder.status === WorkOrderStatus.Completed) {
    redirect(`/ordenes/${id}`);
  }

  const canGeneratePO =
    workOrder.required_parts ||
    (workOrder.estimated_cost && workOrder.estimated_cost > 0) ||
    workOrder.type === "corrective";

  if (!canGeneratePO) {
    redirect(`/ordenes/${id}/editar`);
  }

  const searchParams = new URLSearchParams({
    workOrderId: id,
  });

  if (typeof workOrder.type === "string" && workOrder.type.trim() !== "") {
    searchParams.set("workOrderType", workOrder.type);
  }

  redirect(`/compras/crear-tipificada?${searchParams.toString()}`);
}
