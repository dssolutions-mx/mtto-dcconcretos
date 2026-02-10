/**
 * Investigate Plant Attribution
 *
 * Queries live Supabase to verify:
 * 1. Current state: PO/WO plant_id fill rates
 * 2. asset_assignment_history coverage
 * 3. Example attribution comparison: po.plant_id vs asset_assignment_history
 * 4. Whether numbers are sound when attribution falls back to asset
 *
 * Run: npx tsx scripts/investigate-plant-attribution.ts
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import {
  buildAssignmentHistoryMap,
  resolveAssetPlantAtTimestamp,
} from '@/lib/reporting/asset-plant-attribution'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  PLANT ATTRIBUTION INVESTIGATION')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // ─── 1. Current state: PO and WO plant_id fill rates ───
  console.log('1. CURRENT STATE: plant_id fill rates\n')

  const { data: poStats, error: poErr } = await supabase
    .from('purchase_orders')
    .select('id, order_id, plant_id, work_order_id, total_amount, actual_amount, created_at, purchase_date')

  if (poErr) {
    console.error('PO fetch error:', poErr)
    return
  }

  const poTotal = poStats?.length ?? 0
  const poWithPlantId = poStats?.filter((p) => p.plant_id != null).length ?? 0
  const poWithWo = poStats?.filter((p) => p.work_order_id != null).length ?? 0
  const poWithWoNoPlant = poStats?.filter((p) => p.work_order_id && !p.plant_id).length ?? 0
  const poStandalone = poStats?.filter((p) => !p.work_order_id).length ?? 0

  console.log('   Purchase Orders:')
  console.log(`     Total: ${poTotal}`)
  console.log(`     With plant_id set: ${poWithPlantId} (${poTotal ? ((poWithPlantId / poTotal) * 100).toFixed(1) : 0}%)`)
  console.log(`     With work_order_id: ${poWithWo}`)
  console.log(`     WO-linked but plant_id NULL: ${poWithWoNoPlant}`)
  console.log(`     Standalone (no WO): ${poStandalone}`)

  const { data: woStats, error: woErr } = await supabase
    .from('work_orders')
    .select('id, plant_id, asset_id')

  if (woErr) {
    console.error('WO fetch error:', woErr)
    return
  }

  const woTotal = woStats?.length ?? 0
  const woWithPlantId = woStats?.filter((w) => w.plant_id != null).length ?? 0

  console.log('\n   Work Orders:')
  console.log(`     Total: ${woTotal}`)
  console.log(`     With plant_id set: ${woWithPlantId} (${woTotal ? ((woWithPlantId / woTotal) * 100).toFixed(1) : 0}%)`)

  // ─── 2. asset_assignment_history coverage ───
  console.log('\n2. ASSET_ASSIGNMENT_HISTORY\n')

  const { data: history, error: histErr } = await supabase
    .from('asset_assignment_history')
    .select('asset_id, previous_plant_id, new_plant_id, created_at')
    .order('created_at', { ascending: true })

  if (histErr) {
    console.error('History fetch error:', histErr)
    return
  }

  const uniqueAssetsWithHistory = new Set(history?.map((h) => h.asset_id) ?? []).size
  const { data: assets } = await supabase.from('assets').select('id, plant_id')
  const assetCount = assets?.length ?? 0

  console.log(`   Records: ${history?.length ?? 0}`)
  console.log(`   Unique assets with movement history: ${uniqueAssetsWithHistory}`)
  console.log(`   Total assets: ${assetCount}`)
  console.log(`   Assets with history: ${uniqueAssetsWithHistory} (${assetCount ? ((uniqueAssetsWithHistory / assetCount) * 100).toFixed(1) : 0}%)`)

  // ─── 3. Plants for reference ───
  const { data: plants } = await supabase
    .from('plants')
    .select('id, name, code')
    .order('code')

  const plantNames = new Map((plants ?? []).map((p) => [p.id, `${p.code || p.name}`]))

  // ─── 4. Example: PO attribution comparison ───
  console.log('\n3. EXAMPLE: PO ATTRIBUTION (po.plant_id vs asset_assignment_history)\n')

  const reportEndDate = new Date()
  reportEndDate.setUTCHours(23, 59, 59, 999)
  const reportEndStr = reportEndDate.toISOString().slice(0, 10) + 'T23:59:59.999Z'

  const historyMap = buildAssignmentHistoryMap(history ?? [])

  // Build asset -> plant as of report end (same logic as executive report)
  const assetToPlantAtEnd = new Map<string, string>()
  for (const a of assets ?? []) {
    const resolved = resolveAssetPlantAtTimestamp({
      assetId: a.id,
      eventDate: reportEndStr,
      currentPlantId: a.plant_id,
      historyByAsset: historyMap,
    })
    if (resolved) assetToPlantAtEnd.set(a.id, resolved)
  }

  // Get POs with WO to compare
  const samplePos = (poStats ?? []).filter((p) => p.work_order_id && p.total_amount != null && Number(p.total_amount) > 0)
  const woIds = [...new Set(samplePos.map((p) => p.work_order_id!))]
  const { data: workOrders } = await supabase
    .from('work_orders')
    .select('id, asset_id, plant_id')
    .in('id', woIds)

  const woMap = new Map((workOrders ?? []).map((w) => [w.id, w]))

  let sameCount = 0
  let diffCount = 0
  let poOnlyNull = 0
  const differences: Array<{ po_id: string; po_plant: string | null; asset_plant: string | null }> = []

  for (const po of samplePos.slice(0, 50)) {
    const wo = woMap.get(po.work_order_id!)
    const poPlant = po.plant_id ?? null
    const assetPlant = wo?.asset_id ? assetToPlantAtEnd.get(wo.asset_id) ?? null : null

    if (poPlant && assetPlant) {
      if (poPlant === assetPlant) sameCount++
      else {
        diffCount++
        if (differences.length < 10) {
          differences.push({
            po_id: po.order_id ?? po.id,
            po_plant: poPlant,
            asset_plant: assetPlant,
          })
        }
      }
    } else if (!poPlant && assetPlant) {
      poOnlyNull++
    }
  }

  console.log('   Sample: up to 50 WO-linked POs with amount > 0')
  console.log(`     PO.plant_id matches asset attribution: ${sameCount}`)
  console.log(`     PO.plant_id differs from asset attribution: ${diffCount}`)
  console.log(`     PO.plant_id NULL, asset attribution available: ${poOnlyNull}`)
  if (differences.length > 0) {
    console.log('\n   Example differences (po.plant_id vs asset-based):')
    differences.forEach((d) => {
      console.log(`     PO ${d.po_id}: po.plant=${plantNames.get(d.po_plant!) ?? d.po_plant} | asset=${plantNames.get(d.asset_plant!) ?? d.asset_plant}`)
    })
  }

  // ─── 5. Totals by plant: PO.plant_id vs asset attribution ───
  console.log('\n4. TOTALS BY PLANT (example period: last 12 months)\n')

  const now = new Date()
  const startDate = new Date(now)
  startDate.setMonth(startDate.getMonth() - 12)
  const dateFrom = startDate.toISOString().slice(0, 10) + 'T00:00:00.000Z'
  const dateTo = now.toISOString().slice(0, 10) + 'T23:59:59.999Z'

  const { data: allPos } = await supabase
    .from('purchase_orders')
    .select('id, order_id, plant_id, work_order_id, total_amount, actual_amount, created_at, purchase_date')
    .neq('status', 'pending_approval')

  const allWoIds = [...new Set((allPos ?? []).map((p) => p.work_order_id).filter(Boolean) as string[])]
  const { data: allWos } = await supabase
    .from('work_orders')
    .select('id, asset_id, completed_at, planned_date, created_at')
    .in('id', allWoIds)

  const allWoMap = new Map((allWos ?? []).map((w) => [w.id, w]))

  const extractDate = (po: any): string => {
    if (po.purchase_date) return String(po.purchase_date).slice(0, 10)
    const wo = po.work_order_id ? allWoMap.get(po.work_order_id) : null
    if (wo?.completed_at) return String(wo.completed_at).slice(0, 10)
    if (wo?.planned_date) return String(wo.planned_date).slice(0, 10)
    if (wo?.created_at) return String(wo.created_at).slice(0, 10)
    return String(po.created_at).slice(0, 10)
  }

  const getAmount = (po: any): number => {
    const v = po.actual_amount ?? po.total_amount
    return Number(v) || 0
  }

  const byPlantDirect = new Map<string, number>()
  const byPlantAsset = new Map<string, number>()

  for (const po of allPos ?? []) {
    const dateStr = extractDate(po)
    if (dateStr < dateFrom.slice(0, 10) || dateStr > dateTo.slice(0, 10)) continue

    const amount = getAmount(po)
    if (amount <= 0) continue

    const wo = po.work_order_id ? allWoMap.get(po.work_order_id) : null
    const assetId = wo?.asset_id

    let plantDirect: string | null = po.plant_id ?? null
    let plantAsset: string | null = assetId ? (assetToPlantAtEnd.get(assetId) ?? null) : po.plant_id ?? null

    if (plantDirect) {
      byPlantDirect.set(plantDirect, (byPlantDirect.get(plantDirect) ?? 0) + amount)
    }
    if (plantAsset) {
      byPlantAsset.set(plantAsset, (byPlantAsset.get(plantAsset) ?? 0) + amount)
    }
  }

  console.log('   Using PO.plant_id (direct):')
  for (const [pid, total] of [...byPlantDirect.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${plantNames.get(pid) ?? pid}: ${total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}`)
  }

  console.log('\n   Using asset_assignment_history (as of report end):')
  for (const [pid, total] of [...byPlantAsset.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${plantNames.get(pid) ?? pid}: ${total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}`)
  }

  const totalDirect = [...byPlantDirect.values()].reduce((a, b) => a + b, 0)
  const totalAsset = [...byPlantAsset.values()].reduce((a, b) => a + b, 0)
  console.log(`\n   Total (direct): ${totalDirect.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}`)
  console.log(`   Total (asset): ${totalAsset.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}`)

  // POs with no plant (direct or asset) - unallocated
  const unallocated = (allPos ?? []).filter((po) => {
    const dateStr = extractDate(po)
    if (dateStr < dateFrom.slice(0, 10) || dateStr > dateTo.slice(0, 10)) return false
    const amount = getAmount(po)
    if (amount <= 0) return false
    const wo = po.work_order_id ? allWoMap.get(po.work_order_id) : null
    const assetId = wo?.asset_id
    const plantDirect = po.plant_id
    const plantAsset = assetId ? assetToPlantAtEnd.get(assetId) : null
    return !plantDirect && !plantAsset
  })
  const unallocatedSum = unallocated.reduce((s, p) => s + getAmount(p), 0)
  console.log(`\n   Unallocated (no plant via direct or asset): ${unallocated.length} POs, ${unallocatedSum.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}`)

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  CONCLUSION')
  console.log('═══════════════════════════════════════════════════════════════\n')
  console.log('  • If PO.plant_id is rarely set, reports rely on asset attribution.')
  console.log('  • asset_assignment_history is used to resolve plant at report end date.')
  console.log('  • plant_id on WO/PO: useful for RLS, direct queries, and when asset moves.')
  console.log('  • Without plant_id at creation, attribution depends on asset assignment history.')
}

main().catch(console.error)
