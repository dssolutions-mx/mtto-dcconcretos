import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { QuotationService } from '@/lib/services/quotation-service'

/**
 * GET /api/purchase-orders/quotations/compare?purchase_order_id=X
 * Get quotation comparison data with recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'User not authenticated' 
      }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const purchase_order_id = searchParams.get('purchase_order_id')
    
    if (!purchase_order_id) {
      return NextResponse.json({ 
        error: 'purchase_order_id is required' 
      }, { status: 400 })
    }
    
    const comparison = await QuotationService.getComparison(purchase_order_id)
    
    return NextResponse.json({
      success: true,
      data: comparison
    })
    
  } catch (error) {
    console.error('Error fetching comparison:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch comparison'
    }, { status: 500 })
  }
}
