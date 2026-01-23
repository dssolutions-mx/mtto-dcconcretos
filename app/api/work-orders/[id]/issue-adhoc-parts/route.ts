import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { MovementService } from '@/lib/services/movement-service'
import { StockService } from '@/lib/services/stock-service'

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

    const body = await request.json()
    const { parts, issue_date } = body

    // Validate work order exists and not completed
    const { data: wo, error: woError } = await supabase
      .from('work_orders')
      .select('status')
      .eq('id', params.id)
      .single()

    if (woError) throw woError

    if (wo.status === 'Completada') {
      return NextResponse.json({ 
        success: false,
        error: 'Cannot issue parts for completed work order' 
      }, { status: 400 })
    }

    // Validate required fields
    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Parts array is required and cannot be empty' 
      }, { status: 400 })
    }

    const movements_created: string[] = []
    let total_cost = 0

    // Process each part
    for (const part of parts) {
      if (!part.part_id || !part.warehouse_id || !part.quantity) {
        continue // Skip invalid parts
      }

      // Get stock
      const stock = await StockService.getOrCreateStock(part.part_id, part.warehouse_id)

      // Verify availability
      const available = stock.current_quantity - stock.reserved_quantity
      if (available < part.quantity) {
        throw new Error(`Insufficient stock for part ${part.part_id}. Available: ${available}, Requested: ${part.quantity}`)
      }

      // Use provided cost or inventory average cost
      const unit_cost = part.unit_cost || stock.average_unit_cost || 0
      total_cost += part.quantity * unit_cost

      // Create issue movement (negative quantity)
      const movement = await MovementService.createMovement({
        part_id: part.part_id,
        stock_id: stock.id,
        warehouse_id: part.warehouse_id,
        movement_type: 'issue',
        quantity: -part.quantity, // Negative for issue
        unit_cost,
        work_order_id: params.id,
        reference_type: 'work_order',
        performed_by: user.id,
        movement_date: issue_date || new Date().toISOString(),
        notes: part.notes || 'Ad-hoc issue at completion (no prior reservation)'
      })

      movements_created.push(movement.id)
    }

    return NextResponse.json({
      success: true,
      data: {
        movements_created,
        total_issued: parts.reduce((sum: number, p: any) => sum + p.quantity, 0),
        total_cost
      },
      message: `${movements_created.length} parts issued successfully`
    })
  } catch (error) {
    console.error('Error issuing ad-hoc parts:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to issue parts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
