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
    
    // SQL to create the stored procedure for generating purchase orders
    const functionSql = `
      CREATE OR REPLACE FUNCTION generate_purchase_order(
        p_work_order_id UUID,
        p_supplier TEXT,
        p_items JSONB,
        p_requested_by UUID = NULL,
        p_expected_delivery_date TIMESTAMPTZ = NOW(),
        p_quotation_url TEXT = NULL
      )
      RETURNS UUID
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        v_order_counter INT;
        v_order_id TEXT;
        v_po_id UUID;
        v_total_amount DECIMAL(10,2) := 0;
      BEGIN
        -- Get the current order count to generate a sequential order ID
        SELECT COUNT(*) + 1 INTO v_order_counter FROM purchase_orders;
        
        -- Format the order ID
        v_order_id := 'OC-' || LPAD(v_order_counter::TEXT, 4, '0');
        
        -- Calculate total amount from items
        SELECT COALESCE(SUM((item->>'total_price')::DECIMAL), 0)
        INTO v_total_amount
        FROM jsonb_array_elements(p_items) AS item;
        
        -- Insert the purchase order
        INSERT INTO purchase_orders (
          order_id,
          work_order_id,
          supplier,
          items,
          total_amount,
          status,
          requested_by,
          expected_delivery_date,
          quotation_url
        ) VALUES (
          v_order_id,
          p_work_order_id,
          p_supplier,
          p_items,
          v_total_amount,
          'Pendiente',
          p_requested_by,
          p_expected_delivery_date,
          p_quotation_url
        ) RETURNING id INTO v_po_id;
        
        -- Update the work order with the purchase order ID
        UPDATE work_orders
        SET purchase_order_id = v_po_id,
            updated_at = NOW()
        WHERE id = p_work_order_id;
        
        RETURN v_po_id;
      END;
      $$;
    `
    
    // In a real environment, this SQL would be executed through Supabase SQL editor
    // Here we return the SQL as part of the response for documentation
    return NextResponse.json({
      message: "Phase 3: Function para generar órdenes de compra está lista para ser ejecutada",
      note: "La siguiente SQL debe ser ejecutada en el editor SQL de Supabase:",
      sql: functionSql
    })
    
  } catch (error) {
    console.error("Error in migration:", error)
    return NextResponse.json(
      { error: "Internal server error during migration" },
      { status: 500 }
    )
  }
} 