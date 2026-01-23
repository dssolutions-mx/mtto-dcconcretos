import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { MovementService } from '@/lib/services/movement-service'

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
    const plant_id = searchParams.get('plant_id') || undefined

    const staleReservations = await MovementService.getStaleReservations(plant_id)

    return NextResponse.json({
      success: true,
      reservations: staleReservations,
      total: staleReservations.length
    })
  } catch (error) {
    console.error('Error fetching stale reservations:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch stale reservations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
