import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { StockService, AdjustStockRequest } from '@/lib/services/stock-service'

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

    const body: AdjustStockRequest = await request.json()

    // Validate required fields
    if (!body.stock_id || body.physical_count === undefined || !body.adjustment_reason) {
      return NextResponse.json({ 
        success: false,
        error: 'Missing required fields: stock_id, physical_count, adjustment_reason' 
      }, { status: 400 })
    }

    // Validate physical count
    if (body.physical_count < 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Physical count cannot be negative' 
      }, { status: 400 })
    }

    const updatedStock = await StockService.adjustStock(body, user.id)

    // Calculate adjustment amount
    const { data: oldStock } = await supabase
      .from('inventory_stock')
      .select('current_quantity')
      .eq('id', body.stock_id)
      .single()

    const adjustment_amount = body.physical_count - (oldStock?.current_quantity || 0)

    return NextResponse.json({
      success: true,
      data: {
        movement_id: '', // Would need to get from movement creation
        adjustment_amount,
        new_quantity: updatedStock.current_quantity
      },
      message: 'Stock adjusted successfully'
    })
  } catch (error) {
    console.error('Error adjusting stock:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to adjust stock',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
