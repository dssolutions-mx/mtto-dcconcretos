import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { InventoryService } from '@/lib/services/inventory-service'

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
    const part_number = searchParams.get('part_number') || searchParams.get('q') || ''

    if (!part_number) {
      return NextResponse.json({ 
        success: false,
        error: 'part_number or q parameter is required' 
      }, { status: 400 })
    }

    const parts = await InventoryService.searchPartsByNumber(part_number)

    return NextResponse.json({
      success: true,
      parts,
      total: parts.length
    })
  } catch (error) {
    console.error('Error searching parts:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to search parts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
