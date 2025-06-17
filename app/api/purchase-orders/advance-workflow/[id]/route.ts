import { NextRequest, NextResponse } from 'next/server'
import { PurchaseOrderService } from '@/lib/services/purchase-order-service'
import { AdvanceWorkflowRequest } from '@/types/purchase-orders'
import { createClient } from '@/lib/supabase-server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Resolve params using await
    const resolvedParams = await params
    const id = resolvedParams.id
    
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'User not authenticated' 
      }, { status: 401 })
    }

    // Parse request body
    const body: AdvanceWorkflowRequest = await request.json()
    
    if (!body.new_status) {
      return NextResponse.json({ 
        error: 'new_status is required' 
      }, { status: 400 })
    }
    
    // Advance workflow using database function from Stage 1
    const result = await PurchaseOrderService.advanceWorkflow(
      id, 
      body.new_status, 
      user.id, 
      body.notes
    )
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      workflow_advanced: true
    })
    
  } catch (error) {
    console.error('Error advancing workflow:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to advance workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 