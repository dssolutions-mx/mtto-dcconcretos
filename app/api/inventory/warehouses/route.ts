import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { WarehouseService, CreateWarehouseRequest } from '@/lib/services/warehouse-service'

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
    const is_active = searchParams.get('is_active') === 'true' ? true : 
                     searchParams.get('is_active') === 'false' ? false : undefined
    const search = searchParams.get('search') || undefined

    const warehouses = await WarehouseService.getWarehouses({
      plant_id,
      is_active,
      search
    })

    return NextResponse.json({
      success: true,
      warehouses,
      total: warehouses.length
    })
  } catch (error) {
    console.error('Error fetching warehouses:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch warehouses',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

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

    const body: CreateWarehouseRequest = await request.json()

    // Validate required fields
    if (!body.plant_id || !body.warehouse_code || !body.name) {
      return NextResponse.json({ 
        success: false,
        error: 'Missing required fields: plant_id, warehouse_code, name' 
      }, { status: 400 })
    }

    const warehouse = await WarehouseService.createWarehouse(body, user.id)

    return NextResponse.json({
      success: true,
      data: warehouse,
      message: 'Warehouse created successfully'
    })
  } catch (error) {
    console.error('Error creating warehouse:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to create warehouse',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
