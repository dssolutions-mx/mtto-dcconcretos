import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { canUserReleaseInventory } from '@/lib/inventory/warehouse-authority'
import { InventoryFulfillmentService, FulfillFromInventoryRequest } from '@/lib/services/inventory-fulfillment-service'

export async function POST(
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

    const body: Omit<FulfillFromInventoryRequest, 'purchase_order_id'> = await request.json()

    // Validate required fields
    if (!body.fulfillments || body.fulfillments.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Fulfillments array is required and cannot be empty' 
      }, { status: 400 })
    }

    // Validate each fulfillment
    for (const fulfillment of body.fulfillments) {
      if (!fulfillment.part_id || !fulfillment.warehouse_id || !fulfillment.quantity) {
        return NextResponse.json({ 
          success: false,
          error: 'Each fulfillment must have: part_id, warehouse_id, quantity' 
        }, { status: 400 })
      }
      
      if (fulfillment.quantity <= 0) {
        return NextResponse.json({ 
          success: false,
          error: 'Quantity must be greater than 0' 
        }, { status: 400 })
      }
    }

    const warehouseIds = [...new Set(body.fulfillments.map((fulfillment) => fulfillment.warehouse_id))]
    const releaseChecks = await Promise.all(
      warehouseIds.map(async (warehouseId) => ({
        warehouseId,
        allowed: await canUserReleaseInventory(user.id, warehouseId),
      }))
    )

    const deniedWarehouse = releaseChecks.find((check) => !check.allowed)
    if (deniedWarehouse) {
      return NextResponse.json({
        success: false,
        error: 'You do not have permission to fulfill from inventory in one or more selected warehouses',
        warehouse_id: deniedWarehouse.warehouseId,
      }, { status: 403 })
    }

    const result = await InventoryFulfillmentService.fulfillFromInventory({
      purchase_order_id: resolvedParams.id,
      ...body
    }, user.id)

    if (result.items_fulfilled === 0 && body.fulfillments.length > 0) {
      const firstErr =
        result.results.find((r) => !r.success && r.error_message)?.error_message ||
        'No se pudo registrar ningún surtido desde almacén.'
      return NextResponse.json({
        success: false,
        error: firstErr,
        data: result,
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `${result.items_fulfilled} partida(s) surtida(s) desde almacén`,
    })
  } catch (error) {
    console.error('Error fulfilling from inventory:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fulfill from inventory',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
