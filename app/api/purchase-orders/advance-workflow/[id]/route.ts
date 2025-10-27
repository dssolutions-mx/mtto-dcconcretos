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
    
    // ✅ NUEVO SISTEMA (Paso 1 de 2): Aprobación BU primero, escalamiento a Gerencia si excede límite
    if (body.new_status === 'approved') {
      // Get the purchase order to check amount and links
      const { data: purchaseOrder } = await supabase
        .from('purchase_orders')
        .select('id, status, total_amount, work_order_id, plant_id, authorized_by, authorization_date')
        .eq('id', id)
        .single()

      if (purchaseOrder) {
        const amount = Number(purchaseOrder.total_amount || 0)
        const userLimit = Number(profile.can_authorize_up_to || 0)

        // Resolve Business Unit from plant (direct) or via work order -> asset -> plant
        let resolvedPlantId: string | null = purchaseOrder.plant_id || null
        if (!resolvedPlantId && purchaseOrder.work_order_id) {
          const { data: wo } = await supabase
            .from('work_orders')
            .select('id, asset_id, service_order_id')
            .eq('id', purchaseOrder.work_order_id)
            .maybeSingle()
          if (wo?.asset_id) {
            const { data: asset } = await supabase
              .from('assets')
              .select('plant_id')
              .eq('id', wo.asset_id)
              .maybeSingle()
            resolvedPlantId = asset?.plant_id || null
          }
        }

        let buId: string | null = null
        if (resolvedPlantId) {
          const { data: plant } = await supabase
            .from('plants')
            .select('business_unit_id')
            .eq('id', resolvedPlantId)
            .maybeSingle()
          buId = (plant?.business_unit_id as string | null) || null
        }

        // If first approval not recorded yet, only BU Manager of that BU can perform it (GM can bypass)
        if (!purchaseOrder.authorized_by) {
          const isBuManager = profile.role === 'JEFE_UNIDAD_NEGOCIO' && buId && profile.business_unit_id === buId
          const isGM = profile.role === 'GERENCIA_GENERAL'
          
          if (!isBuManager && !isGM) {
            return NextResponse.json({ 
              error: 'Solo el Jefe de Unidad de Negocio correspondiente o Gerencia General puede aprobar esta orden.' 
            }, { status: 403 })
          }

          // Record BU authorization
          const { error: authUpdateError } = await supabase
            .from('purchase_orders')
            .update({ authorized_by: user.id, authorization_date: new Date().toISOString() })
            .eq('id', id)
          if (authUpdateError) {
            return NextResponse.json({ error: 'No se pudo registrar la autorización de BU' }, { status: 500 })
          }

          // If within BU limit, proceed to full approval now (single-step)
          if (amount <= userLimit) {
            // continue to approval below via service call
          } else {
            // Exceeds BU limit: do NOT finalize approval here; escalate to Gerencia General
            // Ensure PO status stays as 'pending_approval' to trigger GM notification
            // The database trigger notify_po_pending_approval will fire automatically on status update
            const { error: statusError } = await supabase
              .from('purchase_orders')
              .update({ 
                status: 'pending_approval',
                updated_at: new Date().toISOString()
              })
              .eq('id', id)
            
            if (statusError) {
              console.error('Failed to update status for escalation:', statusError)
            }

            return NextResponse.json({
              success: true,
              message: 'Autorización de BU registrada. Se ha escalado a Gerencia General para aprobación final.',
              escalated_to_gm: true
            })
          }
        } else {
          // Second lock: if already BU-authorized and amount exceeds BU limit, require GM role to approve
          if (amount > userLimit && profile.role !== 'GERENCIA_GENERAL') {
            return NextResponse.json({ 
              error: 'Esta orden requiere aprobación de Gerencia General después de la autorización del Jefe de Unidad.' 
            }, { status: 403 })
          }
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
    if (error instanceof Error && (
      error.message.includes('Quotation required for this purchase order before approval') ||
      error.message.includes('Cannot approve: quotation is required but not uploaded')
    )) {
      return NextResponse.json({ 
        success: false,
        error: 'Error de validación de cotización',
        details: 'Esta orden requiere cotización antes de ser aprobada. Por favor, sube la cotización antes de continuar.',
        requires_fix: true,
        fix_type: 'quotation'
      }, { status: 400 })
    }
    
    // Also handle Supabase error object case for quotation required
    if (
      error && typeof error === 'object' && 'code' in error && (error as any).code === 'P0001' &&
      'message' in error && typeof (error as any).message === 'string' &&
      ((error as any).message.includes('Quotation required for this purchase order before approval') ||
       (error as any).message.includes('Cannot approve: quotation is required but not uploaded'))
    ) {
      return NextResponse.json({ 
        success: false,
        error: 'Error de validación de cotización',
        details: 'Esta orden requiere cotización antes de ser aprobada. Por favor, sube la cotización antes de continuar.',
        requires_fix: true,
        fix_type: 'quotation'
      }, { status: 400 })
    }
    
    // Generic Postgres/Supabase error mapping to avoid unhelpful 500s
    const e: any = error
    const code = e?.code || e?.status || null
    const message = typeof e?.message === 'string' ? e.message : (typeof e === 'string' ? e : null)
    const errDetails = typeof e?.details === 'string' ? e.details : null
    const hint = typeof e?.hint === 'string' ? e.hint : null
    const details = message || errDetails || (typeof e?.error_description === 'string' ? e.error_description : 'Unknown error')

    // Map permission errors to 403
    if (
      String(code) === '42501' ||
      (typeof message === 'string' && (message.includes('permission denied') || message.toLowerCase().includes('row-level security')))
    ) {
      return NextResponse.json({ 
        success: false,
        error: 'Permisos insuficientes',
        details,
        code: code || '42501',
        hint
      }, { status: 403 })
    }

    // Treat business rule violations and constraint failures as client errors
    const clientErrorCodes = new Set(['P0001', '23514', '23503', '23505', '23502', '22P02'])
    if (code && clientErrorCodes.has(String(code))) {
      return NextResponse.json({ 
        success: false,
        error: 'No se pudo avanzar el workflow',
        details,
        code,
        hint
      }, { status: 400 })
    }

    // Function not found or server errors – still return JSON with details
    if (String(code) === '42883') {
      return NextResponse.json({
        success: false,
        error: 'Función de workflow no encontrada',
        details,
        code,
        hint
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: false,
      error: 'Failed to advance workflow',
      details,
      code: code || null,
      hint
    }, { status: 500 })
  }
} 