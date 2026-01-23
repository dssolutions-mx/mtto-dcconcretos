import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { StockService } from '@/lib/services/stock-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false,
        error: 'User not authenticated' 
      }, { status: 401 })
    }

    const stock = await StockService.getStock({ part_id: params.id })

    if (!stock || stock.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Stock not found' 
      }, { status: 404 })
    }

    // Get part details
    const { data: part } = await supabase
      .from('inventory_parts')
      .select('*')
      .eq('id', params.id)
      .single()

    const total_available = stock.reduce((sum, s) => 
      sum + (s.current_quantity - s.reserved_quantity), 0
    )
    const total_reserved = stock.reduce((sum, s) => sum + s.reserved_quantity, 0)

    return NextResponse.json({
      success: true,
      part,
      stock_by_warehouse: stock.map(s => ({
        warehouse: s.warehouse,
        stock: {
          id: s.id,
          current_quantity: s.current_quantity,
          reserved_quantity: s.reserved_quantity,
          available_quantity: s.current_quantity - s.reserved_quantity,
          min_stock_level: s.min_stock_level,
          max_stock_level: s.max_stock_level,
          reorder_point: s.reorder_point,
          average_unit_cost: s.average_unit_cost
        }
      })),
      total_available,
      total_reserved
    })
  } catch (error) {
    console.error('Error fetching stock:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch stock',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
