import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createClient()
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session?.user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }
    
    // SQL to create function for generating service orders from completed work orders
    const generateServiceOrderSQL = `
      CREATE OR REPLACE FUNCTION generate_service_order_from_work_order(
        p_work_order_id UUID
      )
      RETURNS UUID
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        v_service_order_id UUID;
        v_order_counter INT;
        v_order_id TEXT;
        v_work_order RECORD;
      BEGIN
        -- Get work order data
        SELECT * INTO v_work_order FROM work_orders WHERE id = p_work_order_id;
        
        IF v_work_order IS NULL THEN
          RAISE EXCEPTION 'Work order not found';
        END IF;
        
        -- Get the current service order count to generate a sequential order ID
        SELECT COUNT(*) + 1 INTO v_order_counter FROM service_orders;
        
        -- Format the service order ID
        v_order_id := 'OS-' || LPAD(v_order_counter::TEXT, 4, '0');
        
        -- Insert the service order
        INSERT INTO service_orders (
          order_id,
          asset_id,
          description,
          type,
          priority,
          status,
          work_order_id,
          completion_date,
          technician_id,
          labor_hours,
          labor_cost,
          parts_cost,
          total_cost,
          resolution_details,
          created_by
        ) VALUES (
          v_order_id,
          v_work_order.asset_id,
          'Servicio completado: ' || v_work_order.description,
          v_work_order.type,
          v_work_order.priority,
          'Completado',
          p_work_order_id,
          NOW(),
          v_work_order.assigned_to,
          v_work_order.labor_hours,
          v_work_order.labor_cost::DECIMAL,
          COALESCE((
            SELECT SUM((item->>'total_price')::DECIMAL)
            FROM jsonb_array_elements(v_work_order.required_parts) AS item
          ), 0),
          (v_work_order.labor_cost::DECIMAL + COALESCE((
            SELECT SUM((item->>'total_price')::DECIMAL)
            FROM jsonb_array_elements(v_work_order.required_parts) AS item
          ), 0)),
          v_work_order.resolution_details,
          v_work_order.created_by
        ) RETURNING id INTO v_service_order_id;
        
        -- Link the service order to the work order
        UPDATE work_orders
        SET service_order_id = v_service_order_id,
            updated_at = NOW()
        WHERE id = p_work_order_id;
        
        RETURN v_service_order_id;
      END;
      $$;
    `
    
    // In a real environment, these SQL statements would be executed through the Supabase SQL editor
    return NextResponse.json({
      message: "Phase 3: Function para generar órdenes de servicio está lista para ser ejecutada",
      note: "La siguiente SQL debe ser ejecutada en el editor SQL de Supabase:",
      sql: generateServiceOrderSQL
    })
    
  } catch (error) {
    console.error("Error in migration:", error)
    return NextResponse.json(
      { error: "Internal server error during migration" },
      { status: 500 }
    )
  }
} 