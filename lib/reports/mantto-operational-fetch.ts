import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase-types'
import { buildAssignmentHistoryMap, resolveAssetPlantAtTimestamp } from '@/lib/reporting/asset-plant-attribution'
import { shouldIncludePurchaseOrderInExpenseReport } from '@/lib/reports/purchase-order-report-eligibility'
import {
  classifyManttoWoType,
  type GerencialAssetLike,
  type GerencialPlantLike,
  type GerencialPlantOtherLine,
} from '@/lib/reports/ingresos-gastos-operational-details'

type ManttoSupabase = SupabaseClient<Database>

type PurchaseOrderRow = {
  id: string
  total_amount: string | number | null
  actual_amount: string | number | null
  created_at: string
  posting_date?: string | null
  purchase_date?: string | null
  plant_id?: string | null
  work_order_id?: string | null
  status: string | null
  po_purpose?: string | null
}

type WorkOrderRow = {
  id: string
  type: string | null
  asset_id: string | null
  planned_date?: string | null
  completed_at?: string | null
  created_at?: string | null
}

function extractDateOnly(dateStr: string): string {
  if (!dateStr) return ''
  if (dateStr.includes('T')) return dateStr.split('T')[0]
  return dateStr.slice(0, 10)
}

function poAmount(po: PurchaseOrderRow): number {
  const raw = po.actual_amount != null ? po.actual_amount : po.total_amount
  const n = parseFloat(String(raw ?? '0'))
  return Number.isFinite(n) ? n : 0
}

function poInDateRange(
  po: PurchaseOrderRow,
  wo: WorkOrderRow | undefined,
  dateFromStr: string,
  dateToStr: string
): boolean {
  let dateToCheckStr = ''
  if (po.purchase_date) dateToCheckStr = po.purchase_date
  else if (po.work_order_id && wo) {
    if (wo.completed_at) dateToCheckStr = wo.completed_at
    else if (wo.planned_date) dateToCheckStr = wo.planned_date
    else if (wo.created_at) dateToCheckStr = wo.created_at
    else dateToCheckStr = po.created_at
  } else {
    dateToCheckStr = po.created_at
  }
  const dOnly = extractDateOnly(dateToCheckStr)
  return dOnly >= dateFromStr && dOnly <= dateToStr
}

/**
 * Scoped maintenance breakdown for ingresos-gastos operational drill-down.
 * Matches gerencial PO rules without running the full gerencial report (diesel, sales, FIFO).
 */
export async function fetchManttoOperationalBreakdown(params: {
  supabase: ManttoSupabase
  dateFromStr: string
  dateToStr: string
  scopePlantIds: Set<string>
  businessUnitId?: string | null
  plantId?: string | null
}): Promise<{
  plants: GerencialPlantLike[]
  assets: GerencialAssetLike[]
  plantOtherLines: GerencialPlantOtherLine[]
}> {
  const { supabase, dateFromStr, dateToStr, scopePlantIds, businessUnitId, plantId } = params

  let scopedPlantIds = Array.from(scopePlantIds)
  if (plantId) scopedPlantIds = scopedPlantIds.filter(id => id === plantId)
  if (scopedPlantIds.length === 0) {
    return { plants: [], assets: [], plantOtherLines: [] }
  }

  let plantsQuery = supabase
    .from('plants')
    .select('id, name, code, business_unit_id')
    .in('id', scopedPlantIds)

  if (businessUnitId) plantsQuery = plantsQuery.eq('business_unit_id', businessUnitId)

  const { data: plantsRows, error: plantsErr } = await plantsQuery
  if (plantsErr) throw plantsErr

  const plantsInScope = (plantsRows || []).filter(p => scopePlantIds.has(p.id))
  const plantIds = plantsInScope.map(p => p.id)
  if (plantIds.length === 0) return { plants: [], assets: [], plantOtherLines: [] }

  const { data: rawAssets, error: assetsErr } = await supabase
    .from('assets')
    .select('id, asset_id, name, plant_id')
    .in('plant_id', plantIds)

  if (assetsErr) throw assetsErr

  const assetIds = (rawAssets || []).map(a => a.id)
  const attributionDate = `${dateToStr}T23:59:59.999Z`

  let assignmentRows: Array<{
    asset_id: string
    previous_plant_id: string | null
    new_plant_id: string | null
    created_at: string
  }> = []

  if (assetIds.length > 0) {
    const { data, error: assignmentError } = await supabase
      .from('asset_assignment_history')
      .select('asset_id, previous_plant_id, new_plant_id, created_at')
      .in('asset_id', assetIds)
      .order('created_at', { ascending: true })
    if (assignmentError) throw assignmentError
    assignmentRows = data || []
  }

  const historyByAsset = buildAssignmentHistoryMap(assignmentRows)

  const assetMap = new Map<
    string,
    {
      id: string
      asset_code: string
      plant_id: string
      maintenance_cost: number
      preventive_cost: number
      corrective_cost: number
    }
  >()

  for (const asset of rawAssets || []) {
    const attributedPlantId = resolveAssetPlantAtTimestamp({
      assetId: asset.id,
      eventDate: attributionDate,
      currentPlantId: asset.plant_id,
      historyByAsset,
    })
    if (!attributedPlantId || !scopePlantIds.has(attributedPlantId)) continue

    assetMap.set(asset.id, {
      id: asset.id,
      asset_code: asset.asset_id || asset.id.slice(0, 8),
      plant_id: attributedPlantId,
      maintenance_cost: 0,
      preventive_cost: 0,
      corrective_cost: 0,
      other_cost: 0,
    })
  }

  const scopedAssetIds = Array.from(assetMap.keys())
  const workOrdersMap = new Map<string, WorkOrderRow>()

  const CHUNK = 200
  if (scopedAssetIds.length > 0) {
    for (let i = 0; i < scopedAssetIds.length; i += CHUNK) {
      const chunk = scopedAssetIds.slice(i, i + CHUNK)
      const { data: workOrders, error: woErr } = await supabase
        .from('work_orders')
        .select('id, type, asset_id, planned_date, completed_at, created_at')
        .in('asset_id', chunk)
      if (woErr) throw woErr
      for (const wo of workOrders || []) {
        workOrdersMap.set(wo.id, wo)
      }
    }
  }

  const workOrderIds = Array.from(workOrdersMap.keys())
  const purchaseOrders: PurchaseOrderRow[] = []

  for (let i = 0; i < workOrderIds.length; i += CHUNK) {
    const chunk = workOrderIds.slice(i, i + CHUNK)
    const { data: pos, error: poErr } = await supabase
      .from('purchase_orders')
      .select(
        'id, total_amount, actual_amount, created_at, posting_date, purchase_date, plant_id, work_order_id, status, po_purpose'
      )
      .in('work_order_id', chunk)
    if (poErr) throw poErr
    purchaseOrders.push(...((pos || []) as PurchaseOrderRow[]))
  }

  for (let i = 0; i < plantIds.length; i += CHUNK) {
    const chunk = plantIds.slice(i, i + CHUNK)
    const { data: standalonePos, error: standaloneErr } = await supabase
      .from('purchase_orders')
      .select(
        'id, total_amount, actual_amount, created_at, posting_date, purchase_date, plant_id, work_order_id, status, po_purpose'
      )
      .is('work_order_id', null)
      .in('plant_id', chunk)
    if (standaloneErr) throw standaloneErr
    purchaseOrders.push(...((standalonePos || []) as PurchaseOrderRow[]))
  }

  const eligible = purchaseOrders.filter(po =>
    shouldIncludePurchaseOrderInExpenseReport({ status: po.status })
  )

  const workOrderPOs = eligible.filter(
    po => po.work_order_id && po.po_purpose !== 'inventory_restock'
  )
  const standalonePOs = eligible.filter(
    po => !po.work_order_id && po.po_purpose !== 'inventory_restock' && po.plant_id
  )

  for (const po of workOrderPOs) {
    const wo = po.work_order_id ? workOrdersMap.get(po.work_order_id) : undefined
    if (!wo?.asset_id) continue
    if (!poInDateRange(po, wo, dateFromStr, dateToStr)) continue

    const asset = assetMap.get(wo.asset_id)
    if (!asset) continue

    const amount = poAmount(po)
    if (amount === 0) continue

    asset.maintenance_cost += amount
    const bucket = classifyManttoWoType(wo.type)
    if (bucket === 'preventive') asset.preventive_cost += amount
    else if (bucket === 'corrective') asset.corrective_cost += amount
    else asset.other_cost += amount
  }

  const plantMap = new Map<
    string,
    {
      id: string
      maintenance_cost: number
      preventive_cost: number
      corrective_cost: number
      other_cost: number
    }
  >()

  for (const plant of plantsInScope) {
    plantMap.set(plant.id, {
      id: plant.id,
      maintenance_cost: 0,
      preventive_cost: 0,
      corrective_cost: 0,
      other_cost: 0,
    })
  }

  const plantOtherLines: GerencialPlantOtherLine[] = []

  assetMap.forEach(asset => {
    const plant = plantMap.get(asset.plant_id)
    if (!plant) return
    plant.maintenance_cost += asset.maintenance_cost
    plant.preventive_cost += asset.preventive_cost
    plant.corrective_cost += asset.corrective_cost
    plant.other_cost += asset.other_cost
  })

  for (const po of standalonePOs) {
    const plantId = po.plant_id
    if (!plantId || !scopePlantIds.has(plantId)) continue
    if (!poInDateRange(po, undefined, dateFromStr, dateToStr)) continue

    let plant = plantMap.get(plantId)
    if (!plant) {
      plant = {
        id: plantId,
        maintenance_cost: 0,
        preventive_cost: 0,
        corrective_cost: 0,
        other_cost: 0,
      }
      plantMap.set(plantId, plant)
    }
    const amount = poAmount(po)
    if (amount === 0) continue
    plant.maintenance_cost += amount
    plant.other_cost += amount
    plantOtherLines.push({
      plant_id: plantId,
      id: `po-${po.id}`,
      label: 'OC sin orden de trabajo',
      amount,
    })
  }

  const plants: GerencialPlantLike[] = []
  for (const plantId of scopePlantIds) {
    const p = plantMap.get(plantId)
    plants.push({
      id: plantId,
      maintenance_cost: p?.maintenance_cost ?? 0,
      preventive_cost: p?.preventive_cost ?? 0,
      corrective_cost: p?.corrective_cost ?? 0,
      other_cost: p?.other_cost ?? 0,
    })
  }

  const assets: GerencialAssetLike[] = Array.from(assetMap.values()).map(a => ({
    id: a.id,
    asset_code: a.asset_code,
    plant_id: a.plant_id,
    preventive_cost: a.preventive_cost,
    corrective_cost: a.corrective_cost,
    other_cost: a.other_cost,
    maintenance_cost: a.maintenance_cost,
  }))

  return { plants, assets, plantOtherLines }
}
