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
    
    // SQL to create additional_expenses table and add adjustment fields to purchase_orders
    const migrationSQL = `
      -- ========================================
      -- MIGRACIÓN: Crear tabla additional_expenses y función para manejar gastos adicionales
      -- ========================================

      -- 1. Crear tabla additional_expenses si no existe
      CREATE TABLE IF NOT EXISTS additional_expenses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        work_order_id UUID REFERENCES work_orders(id),
        description TEXT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        justification TEXT,
        expense_type TEXT DEFAULT 'other',
        receipt_url TEXT,
        adjustment_po_id UUID REFERENCES purchase_orders(id),
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 2. Agregar columna is_adjustment a purchase_orders si no existe
      ALTER TABLE purchase_orders
      ADD COLUMN IF NOT EXISTS is_adjustment BOOLEAN DEFAULT FALSE;

      -- 3. Agregar columna original_purchase_order_id a purchase_orders si no existe
      ALTER TABLE purchase_orders
      ADD COLUMN IF NOT EXISTS original_purchase_order_id UUID REFERENCES purchase_orders(id);

      -- 4. Agregar función para generar orden de compra de ajuste
      CREATE OR REPLACE FUNCTION generate_adjustment_purchase_order(
        p_work_order_id UUID,
        p_supplier TEXT,
        p_items JSONB,
        p_requested_by UUID,
        p_original_po_id UUID DEFAULT NULL
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
        v_order_id := 'OCA-' || LPAD(v_order_counter::TEXT, 4, '0');
        
        -- Calculate total amount from items
        SELECT COALESCE(SUM((item->>'total_price')::DECIMAL), 0)
        INTO v_total_amount
        FROM jsonb_array_elements(p_items) AS item;
        
        -- Insert the adjustment purchase order
        INSERT INTO purchase_orders (
          order_id,
          work_order_id,
          supplier,
          items,
          total_amount,
          status,
          requested_by,
          expected_delivery_date,
          actual_delivery_date,
          approval_date,
          approved_by,
          is_adjustment,
          original_purchase_order_id
        ) VALUES (
          v_order_id,
          p_work_order_id,
          p_supplier,
          p_items,
          v_total_amount,
          'Recibida', -- Adjustment POs are typically already received
          p_requested_by,
          NOW(),
          NOW(),
          NOW(),
          p_requested_by,
          TRUE,
          p_original_po_id
        ) RETURNING id INTO v_po_id;
        
        RETURN v_po_id;
      END;
      $$;
    `;
    
    // In a real environment, this SQL would be executed through Supabase SQL editor
    return NextResponse.json({
      message: "Migration: Tabla de gastos adicionales y ajustes a órdenes de compra",
      note: "La siguiente SQL debe ser ejecutada en el editor SQL de Supabase:",
      sql: migrationSQL,
      instructions: "Ejecuta este script en el Supabase SQL Editor para crear las tablas y funciones necesarias para manejar gastos adicionales y órdenes de compra de ajuste."
    })
    
  } catch (error) {
    console.error("Error in migration:", error)
    return NextResponse.json(
      { error: "Internal server error during migration" },
      { status: 500 }
    )
  }
} 