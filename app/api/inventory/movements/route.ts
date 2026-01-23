import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { MovementService, MovementListParams } from '@/lib/services/movement-service'

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
    const params: MovementListParams = {
      part_id: searchParams.get('part_id') || undefined,
      warehouse_id: searchParams.get('warehouse_id') || undefined,
      movement_type: searchParams.get('movement_type') as any || undefined,
      work_order_id: searchParams.get('work_order_id') || undefined,
      purchase_order_id: searchParams.get('purchase_order_id') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50')
    }

    const result = await MovementService.getMovements(params)

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Error fetching movements:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch movements',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
