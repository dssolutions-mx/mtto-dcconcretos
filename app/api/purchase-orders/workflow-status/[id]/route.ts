import { NextRequest, NextResponse } from 'next/server'
import { PurchaseOrderService } from '@/lib/services/purchase-order-service'
import { createClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Resolve params using await
    const resolvedParams = await params
    const id = resolvedParams.id
    
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'User not authenticated' 
      }, { status: 401 })
    }

    // Get workflow status using service
    const workflowStatus = await PurchaseOrderService.getWorkflowStatus(id)
    
    return NextResponse.json(workflowStatus)
    
  } catch (error) {
    console.error('Error getting workflow status:', error)
    
    if (error instanceof Error && error.message === 'Purchase order not found') {
      return NextResponse.json({ 
        error: 'Purchase order not found' 
      }, { status: 404 })
    }
    
    return NextResponse.json({ 
      error: 'Failed to get workflow status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 