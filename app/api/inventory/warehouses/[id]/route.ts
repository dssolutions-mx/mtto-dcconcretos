import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { WarehouseService, UpdateWarehouseRequest } from '@/lib/services/warehouse-service'

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

    const warehouse = await WarehouseService.getWarehouseById(params.id)

    if (!warehouse) {
      return NextResponse.json({ 
        success: false,
        error: 'Warehouse not found' 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: warehouse
    })
  } catch (error) {
    console.error('Error fetching warehouse:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch warehouse',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

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

    const body: Partial<UpdateWarehouseRequest> = await request.json()
    const warehouse = await WarehouseService.updateWarehouse(
      { id: params.id, ...body },
      user.id
    )

    return NextResponse.json({
      success: true,
      data: warehouse,
      message: 'Warehouse updated successfully'
    })
  } catch (error) {
    console.error('Error updating warehouse:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to update warehouse',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
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

    // Soft delete (deactivate)
    await WarehouseService.deactivateWarehouse(params.id, user.id)

    return NextResponse.json({
      success: true,
      message: 'Warehouse deactivated successfully'
    })
  } catch (error) {
    console.error('Error deactivating warehouse:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to deactivate warehouse',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
