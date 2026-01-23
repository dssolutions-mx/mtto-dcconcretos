import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { InventoryReceiptService } from '@/lib/services/inventory-receipt-service'

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

    const receipts = await InventoryReceiptService.getReceiptHistory(params.id)

    return NextResponse.json({
      success: true,
      receipts,
      total: receipts.length
    })
  } catch (error) {
    console.error('Error fetching receipt history:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch receipt history',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
