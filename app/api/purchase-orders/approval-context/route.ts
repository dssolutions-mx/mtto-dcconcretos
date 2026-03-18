import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
import {
  loadActorContext,
  checkScopeOverBusinessUnit,
} from '@/lib/auth/server-authorization'
import {
  resolveWorkflowPath,
  resolveCurrentStage,
  canActorApproveAtStage,
  canActorRecordViabilityAtStage,
  getStageDisplayInfo,
  getNextStepForAdministration,
  GM_ESCALATION_THRESHOLD_MXN,
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

/** Batch-resolve business_unit_id for many POs. 4 queries total instead of 3 per PO. */
async function buildBusinessUnitLookup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pos: Array<{ plant_id?: string | null; work_order_id?: string | null }>
): Promise<(po: { plant_id?: string | null; work_order_id?: string | null }) => string | null> {
  const directPlantIds = [...new Set(pos.map(po => po.plant_id).filter(Boolean))] as string[]
  const workOrderIds = [...new Set(pos.filter(po => !po.plant_id && po.work_order_id).map(po => po.work_order_id!))]

  const woToPlant = new Map<string, string>()
  if (workOrderIds.length > 0) {
    const { data: wos } = await supabase.from('work_orders').select('id, asset_id').in('id', workOrderIds)
    const assetIds = [...new Set((wos ?? []).map((w: { asset_id: string | null }) => w.asset_id).filter(Boolean))] as string[]
    const woMap = new Map((wos ?? []).map((w: { id: string; asset_id: string | null }) => [w.id, w.asset_id]))

    let assetToPlant = new Map<string, string>()
    if (assetIds.length > 0) {
      const { data: assets } = await supabase.from('assets').select('id, plant_id').in('id', assetIds)
      assetToPlant = new Map((assets ?? []).filter((a: { plant_id: string | null }) => a.plant_id).map((a: { id: string; plant_id: string }) => [a.id, a.plant_id]))
    }
    workOrderIds.forEach(woId => {
      const assetId = woMap.get(woId)
      const plantId = assetId ? assetToPlant.get(assetId) : undefined
      if (plantId) woToPlant.set(woId, plantId)
    })
  }

  const allPlantIds = [...new Set([...directPlantIds, ...woToPlant.values()])]
  const plantToBu = new Map<string, string | null>()
  if (allPlantIds.length > 0) {
    const { data: plants } = await supabase.from('plants').select('id, business_unit_id').in('id', allPlantIds)
    ;(plants ?? []).forEach((p: { id: string; business_unit_id: string | null }) => {
      plantToBu.set(p.id, p.business_unit_id)
    })
  }

  return (po: { plant_id?: string | null; work_order_id?: string | null }) => {
    const plantId = po.plant_id ?? (po.work_order_id ? woToPlant.get(po.work_order_id) ?? null : null) ?? null
    return plantId ? (plantToBu.get(plantId) ?? null) : null
  }
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

    const actorRole = actor.profile.role

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
    const nonAdjustment = (purchaseOrders ?? []).filter((po: { is_adjustment?: boolean }) => !po.is_adjustment)
    const resolveBuId = await buildBusinessUnitLookup(supabase, nonAdjustment)

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

      // approval_amount may be stored as 0.00 (not null) when unset — fall through to total_amount
      const amount =
        Number(po.approval_amount) > 0
          ? Number(po.approval_amount)
          : Number(po.total_amount ?? 0)
      const buId = resolveBuId(po)
      const hasScope = checkScopeOverBusinessUnit(actor, buId)

      const policy = resolveWorkflowPath({
        poPurpose: po.po_purpose ?? null,
        workOrderType: po.work_order_type ?? null,
        approvalAmount: amount,
      })

      const needsGMEscalation =
        policy.requiresGMIfAboveThreshold &&
        amount >= GM_ESCALATION_THRESHOLD_MXN

      const stage = resolveCurrentStage({
        authorizedBy: po.authorized_by ?? null,
        viabilityState: po.viability_state ?? null,
        policy,
        amount,
      })

      const stageDisplay = getStageDisplayInfo(stage)
      const workflowStage = stageDisplay.label
      const responsibleRole = stageDisplay.responsibleRole

      const hasAuthLimit = actor.authorizationLimit > 0
      const amountWithinLimit = amount <= actor.authorizationLimit

      const actInput = {
        stage,
        actorRole,
        policy,
        needsGMEscalation,
        hasScope,
        hasAuthLimit,
        amountWithinLimit,
      }

      const canApprove = canActorApproveAtStage(actInput)
      const canRecordViability = canActorRecordViabilityAtStage(actInput)

      let reason = ''
      let nextStep = ''

      if (canApprove) {
        reason =
          stage === 'technical'
            ? 'Puede aprobar (validación técnica)'
            : 'Puede aprobar (aprobación final)'
        nextStep = stage === 'technical' ? 'Listo para tu aprobación' : 'Listo para aprobación final'
      } else if (canRecordViability) {
        reason = 'Puede registrar viabilidad'
        nextStep = 'Registrar viabilidad administrativa'
      } else {
        if (stage === 'technical') {
          reason = 'Pendiente validación técnica'
          nextStep = 'Gerente de Mantenimiento debe aprobar primero'
        } else if (stage === 'viability') {
          reason = 'Pendiente viabilidad administrativa'
          nextStep = 'Área Administrativa debe registrar viabilidad'
        } else {
          if (actorRole === 'AREA_ADMINISTRATIVA' && !amountWithinLimit && hasAuthLimit) {
            reason = `Excede tu límite ($${actor.authorizationLimit.toLocaleString('es-MX')})`
            nextStep = 'Requiere aprobador con mayor autorización'
          } else if (needsGMEscalation) {
            reason = 'Pendiente aprobación de Gerencia General'
            nextStep = 'Gerencia General debe aprobar'
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
