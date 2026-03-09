import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
import {
  loadActorContext,
  checkTechnicalApprovalAuthority,
  checkGMEscalationAuthority,
  checkScopeOverBusinessUnit,
  checkViabilityReviewAuthority,
} from '@/lib/auth/server-authorization'
import {
  resolveWorkflowPath,
  GM_ESCALATION_THRESHOLD_MXN,
  getNextStepForAdministration,
} from '@/lib/purchase-orders/workflow-policy'

const PurchaseOrderStatus = {
  PendingApproval: 'pending_approval',
} as const

export interface ApprovalContextItem {
  canApprove: boolean
  canReject: boolean
  canRecordViability: boolean
  reason: string
  nextStep: string
  /** Neutral workflow stage: which point of the approval flow this PO is in (actor-agnostic) */
  workflowStage: string
  /** Short role name when user cannot act: who is responsible for the next step (for "En espera de" display) */
  responsibleRole?: string
}

export type ApprovalContextResponse = Record<string, ApprovalContextItem>

async function resolveBusinessUnitId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  po: { plant_id?: string | null; work_order_id?: string | null }
): Promise<string | null> {
  let resolvedPlantId: string | null = po.plant_id ?? null
  if (!resolvedPlantId && po.work_order_id) {
    const { data: wo } = await supabase
      .from('work_orders')
      .select('id, asset_id')
      .eq('id', po.work_order_id)
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
  if (!resolvedPlantId) return null
  const { data: plant } = await supabase
    .from('plants')
    .select('business_unit_id')
    .eq('id', resolvedPlantId)
    .maybeSingle()
  return (plant?.business_unit_id as string | null) ?? null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    if (!idsParam) {
      return NextResponse.json(
        { error: 'Missing ids query parameter' },
        { status: 400 }
      )
    }
    const ids = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    if (ids.length === 0) {
      return NextResponse.json({} as ApprovalContextResponse)
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor?.profile?.role) {
      return NextResponse.json(
        { error: 'User role not found' },
        { status: 403 }
      )
    }

    // Diagnostic logging (temporary) - confirm role resolution
    const isTechnicalApprover = checkTechnicalApprovalAuthority(actor)
    const isGM = checkGMEscalationAuthority(actor)
    const isViabilityReviewer = checkViabilityReviewAuthority(actor)
    console.log('[approval-context] Role resolution:', {
      profileRole: actor.profile.role,
      profileBusinessRole: actor.profile.business_role ?? null,
      effectiveBusinessRole: actor.effectiveBusinessRole ?? null,
      isTechnicalApprover,
      isGM,
      isViabilityReviewer,
    })

    const { data: purchaseOrders, error } = await supabase
      .from('purchase_orders')
      .select(
        'id, status, is_adjustment, authorized_by, viability_state, po_purpose, work_order_type, approval_amount, total_amount, plant_id, work_order_id'
      )
      .in('id', ids)
      .eq('status', PurchaseOrderStatus.PendingApproval)

    if (error) {
      console.error('approval-context fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to load purchase orders' },
        { status: 500 }
      )
    }

    const result: ApprovalContextResponse = {}

    for (const po of purchaseOrders || []) {
      if (po.is_adjustment) {
        result[po.id] = {
          canApprove: false,
          canReject: false,
          canRecordViability: false,
          reason: 'Es ajuste',
          nextStep: '',
          workflowStage: '',
        }
        continue
      }

      const amount = Number(po.approval_amount ?? po.total_amount ?? 0)
      const buId = await resolveBusinessUnitId(supabase, po)
      const hasScope = checkScopeOverBusinessUnit(actor, buId)

      const policy = resolveWorkflowPath({
        poPurpose: po.po_purpose ?? null,
        workOrderType: po.work_order_type ?? null,
        approvalAmount: amount,
      })

      const needsGMEscalation =
        policy.requiresGMIfAboveThreshold &&
        amount >= GM_ESCALATION_THRESHOLD_MXN

      const viabilityDone =
        !!po.viability_state && po.viability_state === 'viable'
      const viabilityPending =
        policy.requiresViability &&
        (!po.viability_state || po.viability_state === 'pending')

      let canApprove = false
      let canRecordViability = false
      let reason = ''
      let nextStep = ''
      let workflowStage = ''
      let responsibleRole: string | undefined

      if (!po.authorized_by) {
        workflowStage = 'Validación técnica'
        responsibleRole = 'Gerente de Mantenimiento'
        if ((isGM && hasScope) || (isTechnicalApprover && hasScope)) {
          canApprove = true
          reason = 'Puede aprobar (validación técnica)'
          nextStep = 'Listo para tu aprobación'
        } else {
          reason = 'Pendiente validación técnica'
          nextStep = 'Gerente de Mantenimiento debe aprobar primero'
        }
      } else if (viabilityPending) {
        workflowStage = 'Viabilidad administrativa'
        responsibleRole = 'Área Administrativa'
        if (isViabilityReviewer || isGM) {
          canRecordViability = true
          reason = 'Puede registrar viabilidad'
          nextStep = 'Registrar viabilidad administrativa'
        } else {
          reason = 'Pendiente viabilidad administrativa'
          nextStep = 'Área Administrativa debe registrar viabilidad'
        }
      } else {
        workflowStage = 'Aprobación final'
        responsibleRole = 'Gerencia General'
        // ONLY GM or Área Administrativa can approve here—Gerente de Mantenimiento (technical approver) must NEVER get canApprove
        if (needsGMEscalation) {
          canApprove = isGM && hasScope
          if (canApprove) {
            reason = 'Puede aprobar (aprobación final)'
            nextStep = 'Listo para aprobación final'
          } else {
            reason = 'Pendiente aprobación de Gerencia General'
            nextStep = 'Gerencia General debe aprobar'
          }
        } else {
          const hasAuthLimit = actor.authorizationLimit > 0
          const withinLimit = amount <= actor.authorizationLimit
          canApprove = (isViabilityReviewer && hasAuthLimit && withinLimit) || (isGM && hasScope)
          if (canApprove) {
            reason = 'Puede aprobar (aprobación final)'
            nextStep = 'Listo para aprobación final'
          } else if (isViabilityReviewer && !withinLimit) {
            reason = `Excede tu límite ($${actor.authorizationLimit.toLocaleString('es-MX')})`
            nextStep = 'Requiere aprobador con mayor autorización'
          } else {
            reason = 'Pendiente aprobación final'
            nextStep = getNextStepForAdministration(
              {
                poPurpose: po.po_purpose ?? null,
                workOrderType: po.work_order_type ?? null,
                approvalAmount: amount,
              },
              'pending_approval',
              po.viability_state ?? null
            )
          }
        }
      }

      canRecordViability =
        canRecordViability ||
        (policy.requiresViability &&
          !!po.authorized_by &&
          viabilityPending &&
          (isViabilityReviewer || isGM))

      // Defensive: GERENTE_MANTENIMIENTO must never approve at Aprobación final (only at Validación técnica).
      // Use profile.role directly—never trust effectiveBusinessRole/business_role for this guard.
      if (workflowStage === 'Aprobación final' && actor.profile.role === 'GERENTE_MANTENIMIENTO') {
        canApprove = false
      }

      result[po.id] = {
        canApprove,
        canReject: canApprove || canRecordViability,
        canRecordViability,
        reason,
        nextStep,
        workflowStage,
        ...(canApprove || canRecordViability ? {} : { responsibleRole }),
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('approval-context error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get approval context',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
