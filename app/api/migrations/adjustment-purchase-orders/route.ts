import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Add is_adjustment column to purchase_orders table
    const { error: isAdjustmentError } = await supabase.rpc('add_column_if_not_exists', {
      p_table: 'purchase_orders',
      p_column: 'is_adjustment',
      p_type: 'boolean',
      p_constraint: 'DEFAULT false'
    })
    
    if (isAdjustmentError) {
      console.error('Error adding is_adjustment column to purchase_orders:', isAdjustmentError)
    }
    
    // Add original_purchase_order_id column to purchase_orders table 
    const { error: originalPoError } = await supabase.rpc('add_column_if_not_exists', {
      p_table: 'purchase_orders',
      p_column: 'original_purchase_order_id',
      p_type: 'uuid',
      p_constraint: 'NULL'
    })
    
    if (originalPoError) {
      console.error('Error adding original_purchase_order_id column to purchase_orders:', originalPoError)
    }
    
    // Add adjustment_po_id column to additional_expenses table
    const { error: adjustmentPoIdError } = await supabase.rpc('add_column_if_not_exists', {
      p_table: 'additional_expenses',
      p_column: 'adjustment_po_id',
      p_type: 'uuid',
      p_constraint: 'NULL'
    })
    
    if (adjustmentPoIdError) {
      console.error('Error adding adjustment_po_id column to additional_expenses:', adjustmentPoIdError)
    }
    
    // Add processed field to additional_expenses table
    const { error: processedError } = await supabase.rpc('add_column_if_not_exists', {
      p_table: 'additional_expenses',
      p_column: 'processed',
      p_type: 'boolean',
      p_constraint: 'DEFAULT false'
    })
    
    if (processedError) {
      console.error('Error adding processed column to additional_expenses:', processedError)
    }
    
    return NextResponse.json({
      message: 'Adjustment purchase orders migration completed',
      results: {
        isAdjustment: isAdjustmentError ? 'Error' : 'Added or already exists',
        originalPurchaseOrderId: originalPoError ? 'Error' : 'Added or already exists',
        adjustmentPoId: adjustmentPoIdError ? 'Error' : 'Added or already exists',
        processed: processedError ? 'Error' : 'Added or already exists'
      }
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
} 