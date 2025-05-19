import { createClient } from "@/lib/supabase"
import { InsertMaintenanceHistory, WorkOrderStatus } from "@/types"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session?.user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const data = await request.json()
    const { 
      workOrderId,
      completionData,
      maintenanceHistoryData
    } = data

    if (!workOrderId || !completionData) {
      return NextResponse.json(
        { error: "Datos incompletos para completar la orden" },
        { status: 400 }
      )
    }
    
    // Verificar que la orden existe y no está ya completada
    const { data: existingOrder, error: checkError } = await supabase
      .from("work_orders")
      .select("id, status")
      .eq("id", workOrderId)
      .single()
      
    if (checkError || !existingOrder) {
      return NextResponse.json(
        { error: "La orden de trabajo no existe" },
        { status: 404 }
      )
    }
    
    if (existingOrder.status === WorkOrderStatus.Completed) {
      return NextResponse.json(
        { error: "La orden de trabajo ya está completada" },
        { status: 400 }
      )
    }

    // Update work order with completion data
    const { error: updateError } = await supabase
      .from("work_orders")
      .update({
        status: WorkOrderStatus.Completed,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        resolution_details: completionData.resolution_details,
        technician_notes: completionData.technician_notes,
        downtime_hours: completionData.downtime_hours,
        labor_hours: completionData.labor_hours,
        labor_cost: completionData.labor_cost
      })
      .eq("id", workOrderId)

    if (updateError) {
      console.error("Error al actualizar la orden de trabajo:", updateError)
      return NextResponse.json(
        { error: "Error al actualizar la orden de trabajo" },
        { status: 500 }
      )
    }

    // If maintenance history data is provided, add it
    let maintenanceHistoryId = null;
    if (maintenanceHistoryData) {
      const { data: historyData, error: historyError } = await supabase
        .from("maintenance_history")
        .insert(maintenanceHistoryData)
        .select("id")
        .single()

      if (historyError) {
        console.error("Error al agregar historial de mantenimiento:", historyError)
        // We don't fail the entire process if history update fails
      } else {
        maintenanceHistoryId = historyData?.id;
      }
    }

    // Create a service order manually since we can't call the DB function directly
    let serviceOrderId = null;
    
    try {
      // First get the work order details to copy
      const { data: workOrder, error: getWorkOrderError } = await supabase
        .from("work_orders")
        .select("*, asset:assets(*)")
        .eq("id", workOrderId)
        .single();
        
      if (getWorkOrderError || !workOrder) {
        throw new Error("Error fetching work order details");
      }
      
      // Count existing service orders to create new ID
      const { count: orderCount, error: countError } = await supabase
        .from("service_orders")
        .select("*", { count: "exact", head: true });
        
      if (countError) {
        throw new Error("Error counting service orders");
      }
      
      // Generate sequential order ID
      const orderNumber = (orderCount || 0) + 1;
      const orderId = `OS-${orderNumber.toString().padStart(4, '0')}`;
      
      // Calculate parts cost
      let partsCost = 0;
      if (workOrder.required_parts) {
        const parts = typeof workOrder.required_parts === 'string'
          ? JSON.parse(workOrder.required_parts)
          : workOrder.required_parts;
          
        partsCost = parts.reduce((sum: number, part: any) => {
          return sum + (parseFloat(part.total_price) || 0);
        }, 0);
      }
      
      // Calculate total cost
      const laborCost = parseFloat(completionData.labor_cost || '0');
      const totalCost = laborCost + partsCost;
      
      // Get technician name
      let technicianName = "No asignado";
      if (workOrder.assigned_to) {
        const { data: techData } = await supabase
          .from("profiles")
          .select("nombre, apellido")
          .eq("id", workOrder.assigned_to)
          .single();
          
        if (techData) {
          technicianName = `${techData.nombre || ''} ${techData.apellido || ''}`.trim();
        }
      }
      
      // Insert the service order
      const { data: serviceOrder, error: insertError } = await supabase
        .from("service_orders")
        .insert({
          order_id: orderId,
          asset_id: workOrder.asset_id,
          asset_name: workOrder.asset?.name || 'Activo sin nombre',
          description: `Servicio completado: ${workOrder.description}`,
          type: workOrder.type,
          priority: workOrder.priority,
          status: "Completado",
          work_order_id: workOrderId,
          date: new Date().toISOString(),
          completion_date: completionData.completion_date || new Date().toISOString(),
          technician_id: workOrder.assigned_to,
          technician: technicianName,
          labor_hours: completionData.labor_hours || 0,
          labor_cost: laborCost.toString(),
          parts_cost: partsCost.toString(),
          total_cost: totalCost.toString(),
          findings: completionData.technician_notes || null,
          actions: completionData.resolution_details,
          created_by: sessionData.session.user.id
        })
        .select("id")
        .single();
        
      if (insertError) {
        throw new Error(`Error creating service order: ${insertError.message}`);
      }
      
      serviceOrderId = serviceOrder.id;
      
      // Link service order back to work order
      const { error: linkError } = await supabase
        .from("work_orders")
        .update({ 
          service_order_id: serviceOrderId,
          updated_at: new Date().toISOString()
        })
        .eq("id", workOrderId);
        
      if (linkError) {
        console.error("Error linking service order to work order:", linkError);
        // Continue anyway
      }
    } catch (error) {
      console.error("Error creating service order:", error);
      // Continue despite service order creation failure
    }
    
    return NextResponse.json({
      message: "Orden de trabajo completada con éxito",
      serviceOrderId,
      maintenanceHistoryId
    })
  } catch (error) {
    console.error("Error al procesar la petición:", error)
    return NextResponse.json(
      { error: "Error interno al procesar la petición" },
      { status: 500 }
    )
  }
} 