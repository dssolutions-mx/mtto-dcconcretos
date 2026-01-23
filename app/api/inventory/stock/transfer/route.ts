import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { MovementService } from '@/lib/services/movement-service'
import { StockService } from '@/lib/services/stock-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false,
        error: 'User not authenticated' 
      }, { status: 401 })
    }

    const body = await request.json()
    const { part_id, from_warehouse_id, to_warehouse_id, quantity, transfer_date, unit_cost, notes } = body

    // Validate required fields
    if (!part_id || !from_warehouse_id || !to_warehouse_id || !quantity) {
      return NextResponse.json({ 
        success: false,
        error: 'Missing required fields: part_id, from_warehouse_id, to_warehouse_id, quantity' 
      }, { status: 400 })
    }

    // Validate quantity
    if (quantity <= 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Quantity must be greater than 0' 
      }, { status: 400 })
    }

    // Cannot transfer to same warehouse
    if (from_warehouse_id === to_warehouse_id) {
      return NextResponse.json({ 
        success: false,
        error: 'Cannot transfer to the same warehouse' 
      }, { status: 400 })
    }

    // Get source stock
    const sourceStock = await StockService.getOrCreateStock(part_id, from_warehouse_id)
    
    // Verify availability
    const available = sourceStock.current_quantity - sourceStock.reserved_quantity
    if (available < quantity) {
      return NextResponse.json({ 
        success: false,
        error: `Insufficient available stock. Available: ${available}, Requested: ${quantity}` 
      }, { status: 400 })
    }

    // Get or create destination stock
    const destStock = await StockService.getOrCreateStock(part_id, to_warehouse_id)

    const transferDate = transfer_date || new Date().toISOString()

    // Create transfer_out movement
    const transferOut = await MovementService.createMovement({
      part_id,
      stock_id: sourceStock.id,
      warehouse_id: from_warehouse_id,
      movement_type: 'transfer_out',
      quantity: -quantity, // Negative
      unit_cost: unit_cost || sourceStock.average_unit_cost,
      transfer_to_warehouse_id: to_warehouse_id,
      reference_type: 'transfer',
      performed_by: user.id,
      movement_date: transferDate,
      notes: notes || `Transfer to ${to_warehouse_id}`
    })

    // Create transfer_in movement
    const transferIn = await MovementService.createMovement({
      part_id,
      stock_id: destStock.id,
      warehouse_id: to_warehouse_id,
      movement_type: 'transfer_in',
      quantity: quantity, // Positive
      unit_cost: unit_cost || sourceStock.average_unit_cost,
      reference_type: 'transfer',
      performed_by: user.id,
      movement_date: transferDate,
      notes: notes || `Transfer from ${from_warehouse_id}`
    })

    return NextResponse.json({
      success: true,
      data: {
        transfer_out_movement_id: transferOut.id,
        transfer_in_movement_id: transferIn.id
      },
      message: 'Transfer completed successfully'
    })
  } catch (error) {
    console.error('Error transferring stock:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to transfer stock',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
