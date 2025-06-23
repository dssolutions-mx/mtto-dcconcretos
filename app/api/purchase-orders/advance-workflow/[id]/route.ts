import { NextRequest, NextResponse } from 'next/server'
import { PurchaseOrderService } from '@/lib/services/purchase-order-service'
import { AdvanceWorkflowRequest } from '@/types/purchase-orders'
import { createClient } from '@/lib/supabase-server'
import { getRoleDisplayName } from '@/lib/auth/role-permissions'

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

    // ✅ NUEVO SISTEMA: Obtener perfil con límite dinámico de autorización
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, can_authorize_up_to, business_unit_id, plant_id')
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
    
    // ✅ NUEVO SISTEMA: Validación dinámica para aprobación
    if (body.new_status === 'approved') {
      // Get the purchase order to check amount
      const { data: purchaseOrder } = await supabase
        .from('purchase_orders')
        .select('total_amount')
        .eq('id', id)
        .single()
      
      if (purchaseOrder) {
        const amount = parseFloat(purchaseOrder.total_amount)
        const userLimit = profile.can_authorize_up_to || 0
        
        // ✅ Validación basada en límite dinámico del usuario
        if (amount > userLimit) {
          return NextResponse.json({ 
            error: `Tu límite de autorización (${userLimit.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}) no permite aprobar órdenes de ${amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}. Esta orden debe ser aprobada por un superior.` 
          }, { status: 403 })
        }
      }
    }
    
    // ✅ NUEVO SISTEMA: Validación de comprobantes solo para roles específicos
    if (body.new_status === 'validated') {
      const canValidateRoles = ['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA']
      if (!canValidateRoles.includes(profile.role)) {
        return NextResponse.json({ 
          error: `Solo ${canValidateRoles.map(r => getRoleDisplayName(r)).join(' y ')} pueden validar comprobantes` 
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