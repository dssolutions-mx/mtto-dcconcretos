import { NextRequest, NextResponse } from 'next/server'
import { PurchaseOrderService } from '@/lib/services/purchase-order-service'
import { QuoteValidationRequest, PurchaseOrderType } from '@/types/purchase-orders'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'User not authenticated' 
      }, { status: 401 })
    }

    // Parse request body
    const body: QuoteValidationRequest = await request.json()
    
    if (!body.po_type || !body.total_amount) {
      return NextResponse.json({ 
        error: 'po_type and total_amount are required' 
      }, { status: 400 })
    }
    
    // Validate po_type
    if (!Object.values(PurchaseOrderType).includes(body.po_type)) {
      return NextResponse.json({ 
        error: 'Invalid po_type. Must be direct_purchase, direct_service, or special_order' 
      }, { status: 400 })
    }
    
    if (body.total_amount <= 0) {
      return NextResponse.json({ 
        error: 'total_amount must be greater than 0' 
      }, { status: 400 })
    }
    
    // Use service to validate quote requirement (calls database function)
    const result = await PurchaseOrderService.validateQuoteRequirement(body.po_type, body.total_amount)
    
    return NextResponse.json({
      ...result,
      policy_details: {
        direct_purchase: 'Las compras directas nunca requieren cotización',
        direct_service: 'Los servicios directos requieren cotización si el monto es mayor a $10,000 MXN',
        special_order: 'Los pedidos especiales siempre requieren cotización formal'
      }[body.po_type]
    })
    
  } catch (error) {
    console.error('Error validating quotation requirement:', error)
    return NextResponse.json({ 
      error: 'Failed to validate quotation requirement',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 