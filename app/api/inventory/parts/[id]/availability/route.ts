import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { StockService } from '@/lib/services/stock-service'

export async function GET(
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

    const searchParams = request.nextUrl.searchParams
    const plant_id = searchParams.get('plant_id')
    const quantity = parseInt(searchParams.get('quantity') || '0')

    if (!plant_id) {
      return NextResponse.json({ 
        success: false,
        error: 'plant_id is required' 
      }, { status: 400 })
    }

    // Check availability
    const availability = await StockService.checkAvailability(
      resolvedParams.id,
      plant_id,
      quantity
    )

    // Get part details
    const { data: partData } = await supabase
      .from('inventory_parts')
      .select('part_number, name')
      .eq('id', resolvedParams.id)
      .single()

    const total_available = availability.reduce((sum, a) => sum + a.available_quantity, 0)

    return NextResponse.json({
      success: true,
      part_id: resolvedParams.id,
      part_number: partData?.part_number || '',
      part_name: partData?.name || '',
      required_quantity: quantity,
      available_by_warehouse: availability,
      total_available,
      sufficient: total_available >= quantity
    })
  } catch (error) {
    console.error('Error checking part availability:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to check availability',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
