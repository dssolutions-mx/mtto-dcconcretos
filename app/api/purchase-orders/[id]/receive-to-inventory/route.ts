import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { InventoryReceiptService, ReceiveToInventoryRequest } from '@/lib/services/inventory-receipt-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false,
        error: 'User not authenticated' 
      }, { status: 401 })
    }

    const body: Omit<ReceiveToInventoryRequest, 'purchase_order_id'> = await request.json()

    // Validate required fields
    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Items array is required and cannot be empty' 
      }, { status: 400 })
    }

    // Validate each item
    for (const item of body.items) {
      if (!item.part_name || !item.warehouse_id || !item.quantity || item.unit_cost === undefined) {
        return NextResponse.json({ 
          success: false,
          error: `Item validation failed: ${JSON.stringify(item)}. Each item must have: part_name, warehouse_id, quantity, unit_cost` 
        }, { status: 400 })
      }
      
      if (item.quantity <= 0) {
        return NextResponse.json({ 
          success: false,
          error: 'Quantity must be greater than 0' 
        }, { status: 400 })
      }
    }

    const result = await InventoryReceiptService.receiveToInventory({
      purchase_order_id: resolvedParams.id,
      ...body
    }, user.id)

    return NextResponse.json({
      success: true,
      data: result,
      message: `${result.total_items_received} items received to inventory successfully`
    })
  } catch (error) {
    console.error('Error receiving to inventory:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to receive to inventory',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
