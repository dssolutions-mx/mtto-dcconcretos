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
      -- Create additional_expenses table
      CREATE TABLE IF NOT EXISTS additional_expenses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
        asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        justification TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendiente_aprobacion',
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        approved_by UUID REFERENCES auth.users(id),
        approved_at TIMESTAMPTZ,
        rejected_by UUID REFERENCES auth.users(id),
        rejected_at TIMESTAMPTZ,
        rejection_reason TEXT
      );

      -- Add adjustment fields to purchase_orders
      ALTER TABLE purchase_orders 
      ADD COLUMN IF NOT EXISTS requires_adjustment BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS adjustment_amount DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS adjustment_reason TEXT,
      ADD COLUMN IF NOT EXISTS adjustment_status TEXT,
      ADD COLUMN IF NOT EXISTS adjusted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS adjusted_by UUID REFERENCES auth.users(id),
      ADD COLUMN IF NOT EXISTS adjusted_total_amount DECIMAL(10,2);

      -- Add additional_expenses field to service_orders
      ALTER TABLE service_orders
      ADD COLUMN IF NOT EXISTS additional_expenses TEXT,
      ADD COLUMN IF NOT EXISTS has_additional_expenses BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS requires_adjustment BOOLEAN DEFAULT FALSE;

      -- Create view to show all expenses requiring approval
      CREATE OR REPLACE VIEW pending_expense_approvals AS
      SELECT 
        ae.id,
        ae.work_order_id,
        wo.order_id as work_order_number,
        ae.asset_id,
        a.name as asset_name,
        ae.description,
        ae.amount,
        ae.justification,
        ae.status,
        ae.created_at,
        p.nombre || ' ' || p.apellido as requested_by,
        wo.purchase_order_id,
        po.order_id as purchase_order_number
      FROM 
        additional_expenses ae
      JOIN 
        work_orders wo ON ae.work_order_id = wo.id
      JOIN 
        assets a ON ae.asset_id = a.id
      JOIN 
        profiles p ON ae.created_by = p.id
      LEFT JOIN 
        purchase_orders po ON wo.purchase_order_id = po.id
      WHERE 
        ae.status = 'pendiente_aprobacion';
        
      -- Create function to approve additional expenses
      CREATE OR REPLACE FUNCTION approve_additional_expense(
        p_expense_id UUID,
        p_approved_by UUID
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        v_expense RECORD;
        v_work_order RECORD;
        v_purchase_order RECORD;
        v_total_adjustment DECIMAL(10,2) := 0;
      BEGIN
        -- Get expense data
        SELECT * INTO v_expense 
        FROM additional_expenses 
        WHERE id = p_expense_id;
        
        IF v_expense IS NULL THEN
          RAISE EXCEPTION 'Expense not found';
        END IF;
        
        -- Update expense status
        UPDATE additional_expenses
        SET status = 'aprobado',
            approved_by = p_approved_by,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = p_expense_id;
        
        -- Get work order
        SELECT * INTO v_work_order
        FROM work_orders
        WHERE id = v_expense.work_order_id;
        
        -- If work order has a purchase order, adjust it
        IF v_work_order.purchase_order_id IS NOT NULL THEN
          -- Get purchase order
          SELECT * INTO v_purchase_order
          FROM purchase_orders
          WHERE id = v_work_order.purchase_order_id;
          
          -- Calculate total adjustment amount from all approved expenses
          SELECT SUM(amount) INTO v_total_adjustment
          FROM additional_expenses
          WHERE work_order_id = v_work_order.id 
          AND status = 'aprobado';
          
          -- Update purchase order
          UPDATE purchase_orders
          SET adjustment_amount = v_total_adjustment,
              adjustment_status = 'aprobado',
              adjusted_at = NOW(),
              adjusted_by = p_approved_by,
              adjusted_total_amount = total_amount + v_total_adjustment,
              updated_at = NOW()
          WHERE id = v_work_order.purchase_order_id;
        END IF;
        
        RETURN TRUE;
      END;
      $$;
      
      -- Create function to reject additional expenses
      CREATE OR REPLACE FUNCTION reject_additional_expense(
        p_expense_id UUID,
        p_rejected_by UUID,
        p_rejection_reason TEXT
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        v_expense RECORD;
      BEGIN
        -- Get expense data
        SELECT * INTO v_expense 
        FROM additional_expenses 
        WHERE id = p_expense_id;
        
        IF v_expense IS NULL THEN
          RAISE EXCEPTION 'Expense not found';
        END IF;
        
        -- Update expense status
        UPDATE additional_expenses
        SET status = 'rechazado',
            rejected_by = p_rejected_by,
            rejected_at = NOW(),
            rejection_reason = p_rejection_reason,
            updated_at = NOW()
        WHERE id = p_expense_id;
        
        RETURN TRUE;
      END;
      $$;
    `;
    
    // In a real environment, this SQL would be executed through Supabase SQL editor
    return NextResponse.json({
      message: "Migration: Tabla de gastos adicionales y ajustes a órdenes de compra",
      note: "La siguiente SQL debe ser ejecutada en el editor SQL de Supabase:",
      sql: migrationSQL
    })
    
  } catch (error) {
    console.error("Error in migration:", error)
    return NextResponse.json(
      { error: "Internal server error during migration" },
      { status: 500 }
    )
  }
} 