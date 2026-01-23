import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { InventoryService, UpdatePartRequest } from '@/lib/services/inventory-service'

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

    const part = await InventoryService.getPartById(params.id)

    if (!part) {
      return NextResponse.json({ 
        success: false,
        error: 'Part not found' 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: part
    })
  } catch (error) {
    console.error('Error fetching part:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch part',
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

    const body: Partial<UpdatePartRequest> = await request.json()
    const part = await InventoryService.updatePart(
      { id: params.id, ...body },
      user.id
    )

    return NextResponse.json({
      success: true,
      data: part,
      message: 'Part updated successfully'
    })
  } catch (error) {
    console.error('Error updating part:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to update part',
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
    await InventoryService.deactivatePart(params.id, user.id)

    return NextResponse.json({
      success: true,
      message: 'Part deactivated successfully'
    })
  } catch (error) {
    console.error('Error deactivating part:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to deactivate part',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
