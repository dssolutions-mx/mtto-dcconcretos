import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { InventoryReservationService, ReservePartsRequest } from '@/lib/services/inventory-reservation-service'

export async function POST(
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

    const body: Omit<ReservePartsRequest, 'work_order_id'> = await request.json()

    // Validate required fields
    if (!body.reservations || body.reservations.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Reservations array is required and cannot be empty' 
      }, { status: 400 })
    }

    // Validate each reservation
    for (const reservation of body.reservations) {
      if (!reservation.part_id || !reservation.warehouse_id || !reservation.quantity) {
        return NextResponse.json({ 
          success: false,
          error: 'Each reservation must have: part_id, warehouse_id, quantity' 
        }, { status: 400 })
      }
      
      if (reservation.quantity <= 0) {
        return NextResponse.json({ 
          success: false,
          error: 'Quantity must be greater than 0' 
        }, { status: 400 })
      }
    }

    const results = await InventoryReservationService.reserveParts({
      work_order_id: params.id,
      ...body
    }, user.id)

    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    return NextResponse.json({
      success: failed.length === 0,
      data: {
        movements_created: successful.map(r => r.movement_id),
        total_reserved: successful.reduce((sum, r) => sum + r.quantity, 0),
        results
      },
      message: failed.length === 0
        ? `${successful.length} parts reserved successfully`
        : `${successful.length} parts reserved, ${failed.length} failed`
    })
  } catch (error) {
    console.error('Error reserving parts:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to reserve parts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
