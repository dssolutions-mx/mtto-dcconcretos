import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { InventoryFulfillmentService } from '@/lib/services/inventory-fulfillment-service'

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

    const availability = await InventoryFulfillmentService.checkPOAvailability(params.id)

    return NextResponse.json({
      success: true,
      items: availability
    })
  } catch (error) {
    console.error('Error checking PO availability:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to check availability',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
