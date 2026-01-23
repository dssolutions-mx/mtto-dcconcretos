import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
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
    const { plant_id, parts } = body

    if (!plant_id || !Array.isArray(parts)) {
      return NextResponse.json({ 
        success: false,
        error: 'Missing required fields: plant_id, parts (array)' 
      }, { status: 400 })
    }

    // Convert parts array to format expected by service
    const partsForCheck = parts.map((p: any) => ({
      part_id: p.part_id || p.id,
      quantity: p.quantity || 0
    })).filter((p: any) => p.part_id)

    const availability = await StockService.checkMultiplePartsAvailability(
      partsForCheck,
      plant_id
    )

    const summary = {
      total_parts: availability.length,
      available_parts: availability.filter(a => a.sufficient).length,
      insufficient_parts: availability.filter(a => !a.sufficient).length,
      not_in_catalog: availability.filter(a => a.part_id === '').length
    }

    return NextResponse.json({
      success: true,
      parts: availability,
      summary
    })
  } catch (error) {
    console.error('Error checking availability:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to check availability',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
