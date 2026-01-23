import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { InventoryReservationService } from '@/lib/services/inventory-reservation-service'
import { MovementService } from '@/lib/services/movement-service'
import { StockService } from '@/lib/services/stock-service'

export async function PUT(
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

    const body = await request.json()
    const { new_required_parts, reservation_changes } = body

    // Validate work order exists and not completed/cancelled
    const { data: wo, error: woError } = await supabase
      .from('work_orders')
      .select('status, inventory_reserved')
      .eq('id', params.id)
      .single()

    if (woError) throw woError

    if (['Completada', 'Cancelada', 'Rechazada'].includes(wo.status)) {
      return NextResponse.json({ 
        success: false,
        error: 'Cannot update parts for completed or cancelled work order' 
      }, { status: 400 })
    }

    const unreserved_movements: string[] = []
    const new_reservation_movements: string[] = []

    // Process unreserves
    if (reservation_changes) {
      const unreserves = reservation_changes.filter((c: any) => c.action === 'unreserve')
      if (unreserves.length > 0) {
        const unreserveResults = await InventoryReservationService.unreserveParts({
          work_order_id: params.id,
          movement_ids: unreserves.map((u: any) => u.original_movement_id),
          notes: 'Unreserve due to work order parts edit'
        }, user.id)
        unreserved_movements.push(...unreserveResults.filter(r => r.success).map(r => r.movement_id))
      }

      // Process new reservations
      const reserves = reservation_changes.filter((c: any) => c.action === 'reserve')
      if (reserves.length > 0) {
        const reserveResults = await InventoryReservationService.reserveParts({
          work_order_id: params.id,
          reservations: reserves.map((r: any) => ({
            part_id: r.part_id,
            warehouse_id: r.warehouse_id,
            quantity: r.quantity
          })),
          reservation_date: new Date().toISOString()
        }, user.id)
        new_reservation_movements.push(...reserveResults.filter(r => r.success).map(r => r.movement_id))
      }
    }

    // Update work order required_parts
    if (new_required_parts) {
      // Build reserved_parts_summary
      const reservations = await MovementService.getReservations(params.id)
      const reserved_summary = await Promise.all(
        reservations.map(async (res) => {
          const { data: part } = await supabase
            .from('inventory_parts')
            .select('part_number, name')
            .eq('id', res.part_id)
            .single()
          
          const { data: warehouse } = await supabase
            .from('inventory_warehouses')
            .select('name')
            .eq('id', res.warehouse_id)
            .single()

          return {
            part_id: res.part_id,
            part_name: part?.name || '',
            warehouse_id: res.warehouse_id,
            warehouse_name: warehouse?.name || '',
            reserved_qty: res.quantity,
            movement_id: res.id
          }
        })
      )

      await supabase
        .from('work_orders')
        .update({
          required_parts: new_required_parts,
          reserved_parts_summary: reserved_summary,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', params.id)
    }

    return NextResponse.json({
      success: true,
      data: {
        unreserved_movements,
        new_reservation_movements,
        updated_required_parts: new_required_parts
      },
      message: 'Work order parts updated successfully'
    })
  } catch (error) {
    console.error('Error updating work order parts:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to update work order parts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
