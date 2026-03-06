import { NextRequest, NextResponse } from 'next/server'
import { PurchaseOrderService, PurchaseOrderValidationService } from '@/lib/services/purchase-order-service'
import { CreatePurchaseOrderRequest } from '@/types/purchase-orders'
import { createClient } from '@/lib/supabase-server'
import { notifyNextApprover } from '@/lib/purchase-orders/notify-approver'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false,
        error: 'User not authenticated' 
      }, { status: 401 })
    }

    // Parse request body
    const body: CreatePurchaseOrderRequest = await request.json()
    const normalizedRequest = await PurchaseOrderService.normalizeCreateRequest(body)
    
    // Validate request
    const validation = PurchaseOrderValidationService.validateCreateRequest(normalizedRequest)
    if (!validation.isValid) {
      return NextResponse.json({ 
        success: false,
        error: 'Validation failed', 
        details: validation.errors 
      }, { status: 400 })
    }
    
    // Create purchase order with tipo específico
    const purchaseOrder = await PurchaseOrderService.createTypedPurchaseOrder(normalizedRequest, user.id)
    
    // If PO was created directly in pending_approval state (no draft/quote needed),
    // notify the technical approver (GERENTE_MANTENIMIENTO) immediately.
    if (purchaseOrder.status === 'pending_approval' && purchaseOrder.id) {
      void notifyNextApprover(purchaseOrder.id)
    }

    return NextResponse.json({
      success: true,
      data: purchaseOrder,
      message: `Orden de ${normalizedRequest.po_type.replace('_', ' ')} creada exitosamente y enviada a aprobación`
    })
    
  } catch (error) {
    console.error('Error creating typed purchase order:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to create purchase order',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 