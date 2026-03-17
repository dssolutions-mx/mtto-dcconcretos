import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext, checkScopeOverBusinessUnit } from '@/lib/auth/server-authorization'
import {
  resolveWorkflowPath,
  resolveCurrentStage,
  canActorApproveAtStage,
  canActorRecordViabilityAtStage,
  GM_ESCALATION_THRESHOLD_MXN,
} from '@/lib/purchase-orders/workflow-policy'

export const dynamic = 'force-dynamic'

/** Dashboard pending-actions counts for role-specific heroes */
export interface DashboardPendingActions {
  technicalValidation: number
  viabilityReview: number
  gmApproval: number
  activeWorkOrders?: number
}

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

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor?.profile?.role) {
      return NextResponse.json({ technicalValidation: 0, viabilityReview: 0, gmApproval: 0 })
    }

    const { data: pendingPOs, error } = await supabase
      .from('purchase_orders')
      .select('id, authorized_by, viability_state, po_purpose, work_order_type, approval_amount, total_amount, plant_id, work_order_id, is_adjustment')
      .eq('status', 'pending_approval')
      .limit(200)

    if (error) {
      console.error('dashboard pending-actions fetch error:', error)
      return NextResponse.json({ technicalValidation: 0, viabilityReview: 0, gmApproval: 0 })
    }

    const nonAdjustment = (pendingPOs ?? []).filter((po: { is_adjustment?: boolean }) => !po.is_adjustment)

    let technicalValidation = 0
    let viabilityReview = 0
    let gmApproval = 0

    const resolveBuId = await buildBusinessUnitLookup(supabase, nonAdjustment)

    for (const po of nonAdjustment) {
      const amount = Number(po.approval_amount ?? po.total_amount ?? 0)
      const buId = resolveBuId(po)
      const hasScope = checkScopeOverBusinessUnit(actor, buId)

      const policy = resolveWorkflowPath({
        poPurpose: po.po_purpose ?? null,
        workOrderType: po.work_order_type ?? null,
        approvalAmount: amount,
      })

      const needsGMEscalation = policy.requiresGMIfAboveThreshold && amount >= GM_ESCALATION_THRESHOLD_MXN
      const stage = resolveCurrentStage({
        authorizedBy: po.authorized_by ?? null,
        viabilityState: po.viability_state ?? null,
        policy,
        amount,
      })

      const hasAuthLimit = actor.authorizationLimit > 0
      const amountWithinLimit = amount <= actor.authorizationLimit

      const actInput = {
        stage,
        actorRole: actor.profile.role,
        policy,
        needsGMEscalation,
        hasScope,
        hasAuthLimit,
        amountWithinLimit,
      }

      const canApprove = canActorApproveAtStage(actInput)
      const canRecordViability = canActorRecordViabilityAtStage(actInput)

      if (canApprove && stage === 'technical') technicalValidation++
      else if (canRecordViability) viabilityReview++
      else if (canApprove && stage === 'final') gmApproval++
    }

    return NextResponse.json({
      technicalValidation,
      viabilityReview,
      gmApproval,
    })
  } catch (err) {
    console.error('dashboard pending-actions error:', err)
    return NextResponse.json({ technicalValidation: 0, viabilityReview: 0, gmApproval: 0 })
  }
}
