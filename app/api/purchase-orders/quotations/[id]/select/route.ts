import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * PUT /api/purchase-orders/quotations/[id]/select
 * Select a quotation as the winning supplier
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
    
    if (!body.selection_reason || body.selection_reason.trim() === '') {
      return NextResponse.json({ 
        error: 'selection_reason is required' 
      }, { status: 400 })
    }
    
    // Use database function to handle selection logic directly
    const { data, error } = await supabase
      .rpc('select_quotation', {
        p_quotation_id: quotation_id,
        p_user_id: user.id,
        p_selection_reason: body.selection_reason
      })
    
    if (error) {
      console.error('Error selecting quotation via RPC:', error)
      return NextResponse.json({ 
        error: `Failed to select quotation: ${error.message}` 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: data?.success || true,
      message: data?.message || 'Quotation selected successfully'
    })
    
  } catch (error) {
    console.error('Error selecting quotation:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to select quotation'
    }, { status: 500 })
  }
}
