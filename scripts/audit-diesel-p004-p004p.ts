/**
 * Diesel Audit: P004 and P004P
 *
 * Compares diesel liter totals using:
 * 1. Raw SQL (all consumptions, excludes transfers) - matches DB truth
 * 2. Gerencial route logic (only consumptions WITH asset_id) - matches report
 *
 * Run: npx tsx scripts/audit-diesel-p004-p004p.ts [dateFrom] [dateTo]
 * Default: 2026-02-01 to 2026-02-28 (P004P 6930L in Feb 2026)
 *
 * Supabase MCP: Run scripts/audit-diesel-p004-p004p.sql with execute_sql(project_id, query)
 * Or use SQL Editor - the script prints equivalent queries at the end.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const dateFrom = process.argv[2] || '2026-02-01'
const dateTo = process.argv[3] || '2026-02-28'

// Gerencial route uses exclusive end: lt(dateTo + 1 day)
const dateToExclusive = new Date(`${dateTo}T00:00:00.000Z`)
dateToExclusive.setUTCDate(dateToExclusive.getUTCDate() + 1)
const dateToExclusiveStr = dateToExclusive.toISOString().slice(0, 10)

// FIFO uses GMT-6 for date filtering (Mexico)
function getLocalDateStr(utcTimestamp: string): string {
  const utcDate = new Date(utcTimestamp)
  const localTimeMs = utcDate.getTime() - 6 * 60 * 60 * 1000
  const localDate = new Date(localTimeMs)
  const year = localDate.getUTCFullYear()
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(localDate.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function audit() {
  console.log('\n' + '='.repeat(80))
  console.log('Diesel Audit: P004 & P004P')
  console.log('='.repeat(80))
  console.log(`Date range: ${dateFrom} to ${dateTo} (inclusive)`)
  console.log(`Gerencial uses: gte(${dateFrom}), lt(${dateToExclusiveStr})`)
  console.log('')

  // --- 1. Plants and warehouses ---
  const { data: plants, error: plantsErr } = await supabase
    .from('plants')
    .select('id, name, code')
    .in('code', ['P004', 'P004P'])
    .order('code')

  if (plantsErr || !plants?.length) {
    console.error('Plants error:', plantsErr?.message)
    if (!plants?.length) console.warn('No P004 or P004P plants found')
  }

  console.log('📋 Plants:')
  ;(plants || []).forEach((p: any) => {
    console.log(`   ${p.code}: ${p.name} (id: ${p.id})`)
  })
  console.log('')

  const { data: warehouses, error: whErr } = await supabase
    .from('diesel_warehouses')
    .select('id, warehouse_code, name, plant_id, product_type')
    .eq('product_type', 'diesel')
    .in('plant_id', (plants || []).map((p: any) => p.id))

  if (whErr) {
    console.error('Warehouses error:', whErr.message)
    return
  }

  const plantCodeById = new Map((plants || []).map((p: any) => [p.id, p.code]))
  const warehouseToPlant = new Map<string, string>()
  ;(warehouses || []).forEach((w: any) => {
    const code = plantCodeById.get(w.plant_id)
    if (code) warehouseToPlant.set(w.id, code)
  })

  console.log('📦 Diesel warehouses:')
  ;(warehouses || []).forEach((w: any) => {
    const code = plantCodeById.get(w.plant_id) || '?'
    console.log(`   ${w.warehouse_code} (${code}) - ${w.name}`)
  })
  console.log('')

  if (!warehouses?.length) {
    console.warn('⚠️ No diesel warehouses for P004/P004P. Check plant_id on diesel_warehouses.')
    console.log('\n--- SQL for Supabase MCP validation ---\n')
    printValidationSql()
    return
  }

  const warehouseIds = (warehouses || []).map((w: any) => w.id)

  // --- 2. Raw consumptions (route-style filters) ---
  const { data: consumptions, error: consErr } = await supabase
    .from('diesel_transactions')
    .select('id, warehouse_id, asset_id, quantity_liters, transaction_date, is_transfer')
    .eq('transaction_type', 'consumption')
    .neq('is_transfer', true)
    .gte('transaction_date', dateFrom)
    .lt('transaction_date', dateToExclusiveStr)
    .in('warehouse_id', warehouseIds)

  if (consErr) {
    console.error('Consumptions error:', consErr.message)
    return
  }

  const allCons = consumptions || []

  // --- 3. Aggregate by plant ---
  const byPlantRaw = new Map<string, number>() // all consumptions
  const byPlantAssetOnly = new Map<string, number>() // only with asset_id (route logic)
  const byWarehouseRaw = new Map<string, number>()
  const byWarehouseAssetOnly = new Map<string, number>()

  allCons.forEach((c: any) => {
    const plantCode = warehouseToPlant.get(c.warehouse_id)
    if (!plantCode) return

    const liters = Number(c.quantity_liters || 0)

    // Raw total
    byPlantRaw.set(plantCode, (byPlantRaw.get(plantCode) || 0) + liters)
    byWarehouseRaw.set(c.warehouse_id, (byWarehouseRaw.get(c.warehouse_id) || 0) + liters)

    // Route: only with asset_id
    if (c.asset_id) {
      byPlantAssetOnly.set(plantCode, (byPlantAssetOnly.get(plantCode) || 0) + liters)
      byWarehouseAssetOnly.set(
        c.warehouse_id,
        (byWarehouseAssetOnly.get(c.warehouse_id) || 0) + liters
      )
    }
  })

  // --- 4. Output ---
  console.log('📊 Results (liters, transfers excluded)')
  console.log('')
  console.log('By Plant:')
  console.log('  Plant | ALL consumptions | Asset-only (gerencial route) | Diff (general consumptions)')
  console.log('  ' + '-'.repeat(70))
  ;['P004', 'P004P'].forEach(code => {
    const raw = byPlantRaw.get(code) || 0
    const assetOnly = byPlantAssetOnly.get(code) || 0
    const diff = raw - assetOnly
    const diffLabel = diff > 0 ? `+${diff.toFixed(1)}L general` : '-'
    console.log(`  ${code}   | ${raw.toFixed(1).padStart(12)} L | ${assetOnly.toFixed(1).padStart(20)} L | ${diffLabel}`)
  })
  const totalRaw = Array.from(byPlantRaw.values()).reduce((a, b) => a + b, 0)
  const totalAssetOnly = Array.from(byPlantAssetOnly.values()).reduce((a, b) => a + b, 0)
  console.log('  ' + '-'.repeat(70))
  console.log(`  TOTAL | ${totalRaw.toFixed(1).padStart(12)} L | ${totalAssetOnly.toFixed(1).padStart(20)} L |`)
  console.log('')

  console.log('By Warehouse:')
  ;(warehouses || []).forEach((w: any) => {
    const code = plantCodeById.get(w.plant_id) || '?'
    const raw = byWarehouseRaw.get(w.id) || 0
    const assetOnly = byWarehouseAssetOnly.get(w.id) || 0
    console.log(`  ${w.warehouse_code} (${code}): raw=${raw.toFixed(1)} L, asset-only=${assetOnly.toFixed(1)} L`)
  })
  console.log('')

  // General consumptions count
  const generalCount = allCons.filter((c: any) => !c.asset_id).length
  const generalLiters = allCons
    .filter((c: any) => !c.asset_id)
    .reduce((s: number, c: any) => s + Number(c.quantity_liters || 0), 0)
  if (generalCount > 0) {
    console.log(`⚠️  General consumptions (no asset): ${generalCount} tx, ${generalLiters.toFixed(1)} L total`)
    console.log('   These are excluded from the gerencial report plant diesel totals.')
    console.log('')
  }

  // Feb 2026: P004P raw=6930L, gerencial=6380L (550L general excluded)
  const p004pTotal = byPlantRaw.get('P004P') ?? 0
  const p004pAsset = byPlantAssetOnly.get('P004P') ?? 0
  console.log(`📌 P004P: raw=${p004pTotal.toFixed(1)} L, gerencial=${p004pAsset.toFixed(1)} L`)
  if (p004pTotal > 0 && p004pTotal !== p004pAsset) {
    console.log(`   ⚠️  Route excludes ${(p004pTotal - p004pAsset).toFixed(0)} L general consumptions from plant total`)
  }
  console.log('')

  printValidationSql()
  printRouteContrast()
}

function printValidationSql() {
  console.log('--- SQL for Supabase MCP execute_sql validation ---')
  console.log('')
  console.log('-- 1. Plants P004, P004P')
  console.log(`
SELECT id, code, name FROM plants WHERE code IN ('P004', 'P004P');
`)
  console.log('-- 2. Diesel warehouses for P004/P004P')
  console.log(`
SELECT dw.id, dw.warehouse_code, dw.name, p.code as plant_code
FROM diesel_warehouses dw
JOIN plants p ON p.id = dw.plant_id
WHERE dw.product_type = 'diesel' AND p.code IN ('P004', 'P004P');
`)
  console.log('-- 3. Total consumption liters by plant (excl transfers, date range)')
  console.log(`
SELECT p.code,
  COUNT(*) FILTER (WHERE dt.asset_id IS NOT NULL) as tx_with_asset,
  COUNT(*) FILTER (WHERE dt.asset_id IS NULL) as tx_general,
  SUM(CASE WHEN dt.asset_id IS NOT NULL THEN dt.quantity_liters ELSE 0 END) as liters_asset_only,
  SUM(dt.quantity_liters) as liters_total
FROM diesel_transactions dt
JOIN diesel_warehouses dw ON dw.id = dt.warehouse_id
JOIN plants p ON p.id = dw.plant_id
WHERE dt.transaction_type = 'consumption'
  AND (dt.is_transfer IS NULL OR dt.is_transfer = false)
  AND dw.product_type = 'diesel'
  AND p.code IN ('P004', 'P004P')
  AND dt.transaction_date >= '${dateFrom}'
  AND dt.transaction_date < '${dateToExclusiveStr}'
GROUP BY p.code
ORDER BY p.code;
`)
  console.log('--- End SQL ---')
  console.log('')
}

function printRouteContrast() {
  console.log('--- Route vs Audit Calculation Contrast ---')
  console.log('')
  console.log('GERENCIAL ROUTE (app/api/reports/gerencial/route.ts):')
  console.log('  • Liters: UTC dates (gte/lt), asset_id IS NOT NULL only')
  console.log('  • plant.diesel_liters = asset-only (general consumptions excluded)')
  console.log('')
  console.log('FIFO (lib/fifo-diesel-costs.ts + ingresos-gastos):')
  console.log('  • Cost: GMT-6 for period filter. Liters: now logged [FIFO] Diesel liters by plant')
  console.log('  • FIFO logs total + asset_only per plant (matches audit)')
  console.log('  • Date discrepancy: UTC vs GMT-6 can shift boundary txs between months')
  console.log('')
  console.log('THIS AUDIT:')
  console.log('  • UTC dates (matches gerencial route liters query)')
  console.log('  • total = raw (all consumptions), asset_only = gerencial-style')
  console.log('')
}

audit().catch(console.error)
