import { WorkOrderEditForm } from "@/components/work-orders/work-order-edit-form"
import { createClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { use } from "react"

export default function EditWorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  // Return the content component with the id
  return <EditWorkOrderContent id={id} />;
}

// Create an async server component for the content
async function EditWorkOrderContent({ id }: { id: string }) {
  const supabase = await createClient();
  
  // Check if work order exists (explicit select ensures creation_photos included)
  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .select(`
      *,
      asset:assets (*)
    `)
    .eq("id", id)
    .single();
    
  if (error || !workOrder) {
    // Work order not found, redirect to work orders list
    redirect("/ordenes");
  }

  // Parse creation_photos on server (same as details page) so it reliably reaches the client
  const creationPhotos = workOrder.creation_photos
    ? typeof workOrder.creation_photos === "string"
      ? JSON.parse(workOrder.creation_photos)
      : workOrder.creation_photos
    : [];
  const initialCreationPhotos = Array.isArray(creationPhotos) ? creationPhotos : [];
  
  return (
    <div className="container py-4 md:py-8">
      <WorkOrderEditForm workOrder={workOrder} initialCreationPhotos={initialCreationPhotos} />
    </div>
  );
} 