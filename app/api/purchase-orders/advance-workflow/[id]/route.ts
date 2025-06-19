import { NextRequest, NextResponse } from 'next/server'
import { PurchaseOrderService } from '@/lib/services/purchase-order-service'
import { AdvanceWorkflowRequest } from '@/types/purchase-orders'
import { createClient } from '@/lib/supabase-server'
import { canAuthorizeAmount, getRoleDisplayName } from '@/lib/auth/role-permissions'

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

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (!profile?.role) {
      return NextResponse.json({ 
        error: 'User role not found' 
      }, { status: 403 })
    }

    // Parse request body
    const body: AdvanceWorkflowRequest = await request.json()
    
    if (!body.new_status) {
      return NextResponse.json({ 
        error: 'new_status is required' 
      }, { status: 400 })
    }
    
    // Special checks for approval actions
    if (body.new_status === 'approved') {
      // Get the purchase order to check amount
      const { data: purchaseOrder } = await supabase
        .from('purchase_orders')
        .select('total_amount')
        .eq('id', id)
        .single()
      
      if (purchaseOrder) {
        const amount = parseFloat(purchaseOrder.total_amount)
        if (!canAuthorizeAmount(profile.role, amount)) {
          return NextResponse.json({ 
            error: `Tu rol ${getRoleDisplayName(profile.role)} no puede autorizar órdenes de ${amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}` 
          }, { status: 403 })
        }
      }
    }
    
    // Special checks for validation actions
    if (body.new_status === 'validated') {
      const canValidateRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'AREA_ADMINISTRATIVA', 'JEFE_PLANTA']
      if (!canValidateRoles.includes(profile.role)) {
        return NextResponse.json({ 
          error: `Tu rol ${getRoleDisplayName(profile.role)} no puede validar comprobantes` 
        }, { status: 403 })
      }
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