import { NextRequest, NextResponse } from 'next/server'
import { PurchaseOrderService } from '@/lib/services/purchase-order-service'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'User not authenticated' 
      }, { status: 401 })
    }

    // Get metrics using service (uses views from Stage 1)
    const metrics = await PurchaseOrderService.getMetricsByType()
    
    return NextResponse.json({
      success: true,
      data: metrics,
      generated_at: new Date().toISOString(),
      metadata: {
        description: 'Purchase order metrics aggregated by type and payment method',
        data_sources: ['purchase_order_metrics view', 'po_type_summary view'],
        refresh_frequency: 'Real-time'
      }
    })
    
  } catch (error) {
    console.error('Error getting metrics by type:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to get metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 