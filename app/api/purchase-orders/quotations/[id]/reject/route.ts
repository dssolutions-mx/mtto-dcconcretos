import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { QuotationService } from '@/lib/services/quotation-service'

/**
 * PUT /api/purchase-orders/quotations/[id]/reject
 * Reject a quotation with reason
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'User not authenticated' 
      }, { status: 401 })
    }
    
    const resolvedParams = await params
    const quotation_id = resolvedParams.id
    
    const body = await request.json()
    const { rejection_reason } = body
    
    if (!rejection_reason || rejection_reason.trim() === '') {
      return NextResponse.json({ 
        error: 'rejection_reason is required' 
      }, { status: 400 })
    }
    
    await QuotationService.rejectQuotation(quotation_id, rejection_reason, user.id)
    
    return NextResponse.json({
      success: true,
      message: 'Quotation rejected successfully'
    })
    
  } catch (error) {
    console.error('Error rejecting quotation:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to reject quotation'
    }, { status: 500 })
  }
}
