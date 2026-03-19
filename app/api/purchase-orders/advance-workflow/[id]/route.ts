import { NextRequest, NextResponse } from 'next/server'
import { PurchaseOrderService } from '@/lib/services/purchase-order-service'
import { AdvanceWorkflowRequest } from '@/types/purchase-orders'
import { createClient } from '@/lib/supabase-server'
import {
  loadActorContext,
  checkTechnicalApprovalAuthority,
  checkGMEscalationAuthority,
  checkScopeOverBusinessUnit,
  checkViabilityReviewAuthority,
  canValidateReceipts,
} from '@/lib/auth/server-authorization'
import {
  resolveWorkflowPath,
  GM_ESCALATION_THRESHOLD_MXN,
} from '@/lib/purchase-orders/workflow-policy'
import { notifyNextApprover, notifyReadyToPay } from '@/lib/purchase-orders/notify-approver'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = resolvedParams.id

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        error: 'User not authenticated'
      }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor?.profile?.role) {
      return NextResponse.json({
        error: 'User role not found'
      }, { status: 403 })
    }

    const body: AdvanceWorkflowRequest = await request.json()

    if (!body.new_status) {
      return NextResponse.json({
        error: 'new_status is required'
      }, { status: 400 })
    }

    // When approving with 2+ quotations and none selected, require quotation_id and select first
    if (body.new_status === 'approved') {
      const { data: poForQuotes } = await supabase
        .from('purchase_orders')
        .select('id, selected_quotation_id')
        .eq('id', id)
        .single()
      if (poForQuotes) {
        const { count } = await supabase
          .from('purchase_order_quotations')
          .select('*', { count: 'exact', head: true })
          .eq('purchase_order_id', id)
        if ((count ?? 0) >= 2 && !poForQuotes.selected_quotation_id) {
          if (!body.quotation_id) {
            return NextResponse.json({
              error: 'Selección de cotización requerida',
              details: 'Esta orden tiene múltiples cotizaciones. Debes seleccionar una cotización al aprobar.',
              requires_fix: true,
              fix_type: 'quotation'
            }, { status: 400 })
          }
          const { data: selResult, error: selErr } = await supabase.rpc('select_quotation', {
            p_quotation_id: body.quotation_id,
            p_user_id: user.id,
            p_selection_reason: 'Selección al aprobar por Gerente de Mantenimiento'
          })
          interface SelectQuotationResult {
            success?: boolean
            error?: string
          }
          const res = selResult as SelectQuotationResult
          if (selErr || !res?.success) {
            return NextResponse.json({
              error: res?.error ?? selErr?.message ?? 'Error al seleccionar cotización'
            }, { status: 400 })
          }
        }
      }
    }

    let recordAuthorizationAfterWorkflow = false

    // Approval authorization: use workflow policy and shared auth helpers
    if (body.new_status === 'approved') {
      const { data: purchaseOrder } = await supabase
        .from('purchase_orders')
        .select('id, status, total_amount, approval_amount, work_order_id, plant_id, po_purpose, work_order_type, authorized_by, authorization_date')
        .eq('id', id)
        .single()

      if (purchaseOrder) {
        // approval_amount may be stored as 0.00 (not null) when unset — fall through to total_amount
        const amount =
          Number(purchaseOrder.approval_amount) > 0
            ? Number(purchaseOrder.approval_amount)
            : Number(purchaseOrder.total_amount ?? 0)

        let resolvedPlantId: string | null = purchaseOrder.plant_id ?? null
        if (!resolvedPlantId && purchaseOrder.work_order_id) {
          const { data: wo } = await supabase
            .from('work_orders')
            .select('id, asset_id')
            .eq('id', purchaseOrder.work_order_id)
            .maybeSingle()
          if (wo?.asset_id) {
            const { data: asset } = await supabase
              .from('assets')
              .select('plant_id')
              .eq('id', wo.asset_id)
              .maybeSingle()
            resolvedPlantId = asset?.plant_id ?? null
          }
        }

        let buId: string | null = null
        if (resolvedPlantId) {
          const { data: plant } = await supabase
            .from('plants')
            .select('business_unit_id')
            .eq('id', resolvedPlantId)
            .maybeSingle()
          buId = (plant?.business_unit_id as string | null) ?? null
        }

        const policy = resolveWorkflowPath({
          poPurpose: purchaseOrder.po_purpose ?? null,
          workOrderType: purchaseOrder.work_order_type ?? null,
          approvalAmount: amount,
        })

        const needsGMEscalation =
          policy.requiresGMIfAboveThreshold &&
          amount >= GM_ESCALATION_THRESHOLD_MXN

        const isTechnicalApprover = checkTechnicalApprovalAuthority(actor)
        const isGM = checkGMEscalationAuthority(actor)
        const hasScope = checkScopeOverBusinessUnit(actor, buId)

        if (!purchaseOrder.authorized_by) {
          // First approval: technical approver with scope, or GM (can bypass)
          if (isGM && hasScope) {
            // GM can always do first (and only) approval when they have scope
          } else if (isTechnicalApprover && hasScope) {
            // Technical approver can do first approval
          } else {
            return NextResponse.json({
              error: 'Solo el aprobador técnico correspondiente o Gerencia General puede aprobar esta orden.'
            }, { status: 403 })
          }

          if (needsGMEscalation && !isGM) {
            // Corrective PO ≥$7k: register tech approval, stay pending, escalate to GG
            const { error: escalationError } = await supabase
              .from('purchase_orders')
              .update({
                authorized_by: user.id,
                authorization_date: new Date().toISOString(),
                status: 'pending_approval',
                updated_at: new Date().toISOString(),
              })
              .eq('id', id)

            if (escalationError) {
              return NextResponse.json({ error: 'No se pudo registrar la autorización escalada' }, { status: 500 })
            }

            // Notify next approver (Admin for viability paths, GM for non-viability paths)
            void notifyNextApprover(id)

            return NextResponse.json({
              success: true,
              message: 'Autorización registrada. Se ha escalado a Gerencia General para aprobación final.',
              escalated_to_gm: true
            })

          } else if (policy.requiresViability && !isGM) {
            // Viability-required path (preventive or corrective <$7k): register tech approval,
            // stay pending — Área Administrativa must record viability before final approval.
            // This prevents skipping step 2 of the protocol.
            const { error: authError } = await supabase
              .from('purchase_orders')
              .update({
                authorized_by: user.id,
                authorization_date: new Date().toISOString(),
                status: 'pending_approval',
                updated_at: new Date().toISOString(),
              })
              .eq('id', id)

            if (authError) {
              return NextResponse.json({ error: 'No se pudo registrar la validación técnica' }, { status: 500 })
            }

            void notifyNextApprover(id)

            return NextResponse.json({
              success: true,
              message: 'Validación técnica registrada. Área Administrativa debe revisar la viabilidad financiera antes de la aprobación final.',
              awaiting_viability: true
            })

          } else {
            // GM bypass OR simple path (no viability required, no GM escalation): advance directly
            recordAuthorizationAfterWorkflow = true
          }
        } else {
          // Second/final approval: only GM (when escalated) or Área Administrativa (when not)—Gerente de Mantenimiento cannot approve here

          // Self-approval guard: the same person who gave technical approval (authorized_by)
          // can NEVER be the final approver — except GG who has explicit bypass authority.
          if (!isGM && purchaseOrder.authorized_by && purchaseOrder.authorized_by === user.id) {
            return NextResponse.json({
              error: 'No puedes dar la aprobación final en una orden que tú mismo validaste técnicamente. La aprobación final debe ser realizada por otra persona con autoridad.',
            }, { status: 403 })
          }

          const isViabilityReviewer = checkViabilityReviewAuthority(actor)
          const hasAuthLimit = actor.authorizationLimit > 0
          const withinLimit = amount <= actor.authorizationLimit

          if (needsGMEscalation) {
            if (!isGM) {
              return NextResponse.json({
                error: 'Esta orden requiere aprobación de Gerencia General después de la autorización técnica.',
              }, { status: 403 })
            }
          } else {
            const canDoFinalApproval = isGM || (isViabilityReviewer && hasAuthLimit && withinLimit)
            if (!canDoFinalApproval) {
              return NextResponse.json({
                error: 'La aprobación final corresponde a Área Administrativa o Gerencia General.',
              }, { status: 403 })
            }
          }

          // Paths C and D require Administration viability before GM can approve
          if (policy.requiresViability && isGM) {
            const { data: poViability } = await supabase
              .from('purchase_orders')
              .select('viability_state')
              .eq('id', id)
              .maybeSingle()
            if (!poViability?.viability_state || poViability.viability_state === 'pending') {
              return NextResponse.json({
                error: 'Administración debe registrar la viabilidad financiera antes de la aprobación final.',
                requires_viability: true,
              }, { status: 403 })
            }
          }
        }
      }
    }

    if (body.new_status === 'validated') {
      const { data: purchaseOrder } = await supabase
        .from('purchase_orders')
        .select('id, po_purpose, work_order_type, approval_amount, total_amount')
        .eq('id', id)
        .maybeSingle()

      const policy = resolveWorkflowPath({
        poPurpose: purchaseOrder?.po_purpose ?? null,
        workOrderType: purchaseOrder?.work_order_type ?? null,
        approvalAmount: Number(purchaseOrder?.approval_amount) > 0
          ? Number(purchaseOrder?.approval_amount)
          : Number(purchaseOrder?.total_amount ?? 0),
      })

      if (policy.requiresViability) {
        const canReviewViability =
          checkViabilityReviewAuthority(actor) || checkGMEscalationAuthority(actor)

        if (!canReviewViability) {
          return NextResponse.json({
            error: 'Solo Área Administrativa o Gerencia General pueden registrar la viabilidad administrativa.'
          }, { status: 403 })
        }

        // Determine if GG final approval is still needed after viability
        const needsGMAfterViability = policy.requiresGMIfAboveThreshold && amount >= GM_ESCALATION_THRESHOLD_MXN

        if (!needsGMAfterViability) {
          // Preventive POs and corrective <$7k: viability is the last step — auto-approve immediately
          const { error: viabilityError } = await supabase
            .from('purchase_orders')
            .update({
              viability_state: 'viable',
              viability_checked_by: user.id,
              status: 'approved',
              approved_by: user.id,
              approval_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)

          if (viabilityError) {
            return NextResponse.json({ error: 'No se pudo registrar la viabilidad y aprobar la orden' }, { status: 500 })
          }

          void notifyReadyToPay(id)

          return NextResponse.json({
            success: true,
            message: 'Viabilidad registrada. Orden aprobada — lista para compra.',
            workflow_advanced: true,
            viability_recorded: true,
          })
        }

        // Corrective ≥$7k: viability done, GG final approval still required
        const { error: viabilityError } = await supabase
          .from('purchase_orders')
          .update({
            viability_state: 'viable',
            viability_checked_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)

        if (viabilityError) {
          return NextResponse.json({ error: 'No se pudo registrar la viabilidad administrativa' }, { status: 500 })
        }

        // Notify GM to do final approval
        void notifyNextApprover(id)

        return NextResponse.json({
          success: true,
          message: 'Viabilidad administrativa registrada. Gerencia General debe dar la aprobación final.',
          workflow_advanced: false,
          viability_recorded: true,
        })
      } else if (!canValidateReceipts(actor)) {
        return NextResponse.json({
          error: 'Solo Gerencia General o Área Administrativa con límites de autorización asignados pueden validar comprobantes.'
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

    if (body.new_status === 'approved' && recordAuthorizationAfterWorkflow) {
      const { error: authUpdateError } = await supabase
        .from('purchase_orders')
        .update({ authorized_by: user.id, authorization_date: new Date().toISOString() })
        .eq('id', id)

      if (authUpdateError) {
        return NextResponse.json({ error: 'La orden se aprobó, pero no se pudo registrar la autorización técnica.' }, { status: 500 })
      }
    }
    
    // Notify Administration that this PO is fully approved and ready to purchase/pay
    if (body.new_status === 'approved') {
      void notifyReadyToPay(id)
    }

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
    const err = error as { code?: string; message?: string }
    if (
      error && typeof error === 'object' && 'code' in error && err.code === 'P0001' &&
      'message' in error && typeof err.message === 'string' &&
      (err.message.includes('Quotation required for this purchase order before approval') ||
       err.message.includes('Cannot approve: quotation is required but not uploaded'))
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
    const e = error as { code?: string; status?: string; message?: string; details?: string; hint?: string; error_description?: string }
    const code = e?.code || e?.status || null
    const message = typeof e?.message === 'string' ? e.message : (typeof e === 'string' ? String(e) : null)
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