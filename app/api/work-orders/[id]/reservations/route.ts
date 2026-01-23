import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { InventoryReservationService } from '@/lib/services/inventory-reservation-service'

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

    const status = await InventoryReservationService.getReservationStatus(params.id)

    return NextResponse.json({
      success: true,
      ...status
    })
  } catch (error) {
    console.error('Error fetching reservations:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch reservations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
