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
    
    // ✅ SISTEMA HÍBRIDO: Validación de comprobantes con autorización dinámica + restricción administrativa
    if (body.new_status === 'validated') {
      const canValidateRoles = ['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA']
      
      // Primero verificar rol administrativo
      if (!canValidateRoles.includes(profile.role)) {
        return NextResponse.json({ 
          error: `Solo ${canValidateRoles.map(r => getRoleDisplayName(r)).join(' y ')} pueden validar comprobantes` 
        }, { status: 403 })
      }
      
      // Segundo, verificar que tenga autorización efectiva asignada
      const userLimit = profile.can_authorize_up_to || 0
      if (userLimit === 0) {
        return NextResponse.json({ 
          error: `Aunque tienes rol administrativo, necesitas tener límites de autorización asignados para validar comprobantes. Contacta a tu supervisor.` 
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
    
    // Handle specific max_payment_date validation error
    if (error instanceof Error && error.message.includes('max_payment_date cannot be in the past')) {
      return NextResponse.json({ 
        success: false,
        error: 'Error de validación de fecha de pago',
        details: 'La fecha máxima de pago no puede estar en el pasado cuando el método de pago es transferencia. Por favor, actualiza la fecha de pago o cambia el método de pago antes de continuar.',
        requires_fix: true,
        fix_type: 'payment_date'
      }, { status: 400 })
    }
    
    // Also handle the error when it comes from Supabase with code P0001
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P0001' && 
        'message' in error && typeof error.message === 'string' && 
        error.message.includes('max_payment_date cannot be in the past')) {
      return NextResponse.json({ 
        success: false,
        error: 'Error de validación de fecha de pago',
        details: 'La fecha máxima de pago no puede estar en el pasado cuando el método de pago es transferencia. Por favor, actualiza la fecha de pago o cambia el método de pago antes de continuar.',
        requires_fix: true,
        fix_type: 'payment_date'
      }, { status: 400 })
    }
    
    // Handle specific quotation validation error
    if (error instanceof Error && error.message.includes('Quotation required for this purchase order before approval')) {
      return NextResponse.json({ 
        success: false,
        error: 'Error de validación de cotización',
        details: 'Esta orden requiere cotización antes de ser aprobada. Por favor, sube la cotización antes de continuar.',
        requires_fix: true,
        fix_type: 'quotation'
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      success: false,
      error: 'Failed to advance workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 