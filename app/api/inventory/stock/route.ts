import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { StockService, StockListParams } from '@/lib/services/stock-service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false,
        error: 'User not authenticated' 
      }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const params: StockListParams = {
      warehouse_id: searchParams.get('warehouse_id') || undefined,
      plant_id: searchParams.get('plant_id') || undefined,
      part_id: searchParams.get('part_id') || undefined,
      low_stock_only: searchParams.get('low_stock_only') === 'true',
      search: searchParams.get('search') || undefined
    }

    const stock = await StockService.getStock(params)

    return NextResponse.json({
      success: true,
      data: stock,
      total: stock.length
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
