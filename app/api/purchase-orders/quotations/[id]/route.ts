import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { QuotationService } from '@/lib/services/quotation-service'

/**
 * DELETE /api/purchase-orders/quotations/[id]
 * Delete a quotation
 */
export async function DELETE(
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
    
    await QuotationService.deleteQuotation(quotation_id)
    
    return NextResponse.json({
      success: true,
      message: 'Quotation deleted successfully'
    })
    
  } catch (error) {
    console.error('Error deleting quotation:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to delete quotation'
    }, { status: 500 })
  }
}
