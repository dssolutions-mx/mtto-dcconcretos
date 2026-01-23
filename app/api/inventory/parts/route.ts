import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { InventoryService, CreatePartRequest, SearchPartsParams } from '@/lib/services/inventory-service'

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
    const params: SearchPartsParams = {
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
      supplier_id: searchParams.get('supplier_id') || undefined,
      is_active: searchParams.get('is_active') === 'false' ? false : true,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50')
    }

    const result = await InventoryService.getParts(params)

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Error fetching parts:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch parts',
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

    const body: CreatePartRequest = await request.json()

    // Validate required fields
    if (!body.part_number || !body.name || !body.category) {
      return NextResponse.json({ 
        success: false,
        error: 'Missing required fields: part_number, name, category' 
      }, { status: 400 })
    }

    const part = await InventoryService.createPart(body, user.id)

    return NextResponse.json({
      success: true,
      data: part,
      message: 'Part created successfully'
    })
  } catch (error) {
    console.error('Error creating part:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to create part',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
