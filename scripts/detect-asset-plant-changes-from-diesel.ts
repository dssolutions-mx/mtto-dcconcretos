/**
 * Detect Asset Plant Changes from Diesel Transactions
 *
 * Compares diesel consumption (plant_id per transaction) with asset_assignment_history
 * to identify:
 * - Plant moves inferred from diesel that are NOT in asset_assignment_history
 * - Returns to a plant (e.g. Planta 4 → Planta 2) that were never recorded
 * - Current assets.plant_id mismatches with last diesel location or history
 *
 * Run: npx tsx scripts/detect-asset-plant-changes-from-diesel.ts
 *      npx tsx scripts/detect-asset-plant-changes-from-diesel.ts --from 2025-01-01 --to 2026-02-09
 *      npx tsx scripts/detect-asset-plant-changes-from-diesel.ts --high-only  # solo severidad alta
 *      npx tsx scripts/detect-asset-plant-changes-from-diesel.ts --json > report.json
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ─── Types ───
type DieselMove = {
  from_plant_id: string
  from_plant_name: string
  to_plant_id: string
  to_plant_name: string
  first_tx_date: string
  last_tx_in_prev_plant: string
}

type HistoryMove = {
  previous_plant_id: string
  previous_plant_name: string
  new_plant_id: string
  new_plant_name: string
  created_at: string
}

type Inconsistency = {
  asset_id: string
  asset_code: string
  asset_name: string
  type: 'MISSING_RETURN' | 'MISSING_MOVE' | 'CURRENT_VS_DIESEL_MISMATCH' | 'CURRENT_VS_HISTORY_MISMATCH'
  severity: 'high' | 'medium' | 'low'
  details: string
  diesel_evidence?: DieselMove
  history_record?: HistoryMove
  current_plant_id?: string
  current_plant_name?: string
  last_diesel_plant_id?: string
  last_diesel_plant_name?: string
  last_diesel_date?: string
  suggested_return_date?: string
}

// ─── Parse CLI ───
const args = process.argv.slice(2)
const jsonOutput = args.includes('--json')
const highOnly = args.includes('--high-only')
const fromIdx = args.indexOf('--from')
const toIdx = args.indexOf('--to')
const dateFrom = fromIdx >= 0 ? args[fromIdx + 1] : '2025-01-01'
const dateTo = toIdx >= 0 ? args[toIdx + 1] : new Date().toISOString().split('T')[0]

async function main() {
  const report: {
    date_range: { from: string; to: string }
    summary: { total_assets_with_diesel: number; inconsistencies: number; by_type: Record<string, number> }
    inconsistencies: Inconsistency[]
  } = {
    date_range: { from: dateFrom, to: dateTo },
    summary: { total_assets_with_diesel: 0, inconsistencies: 0, by_type: {} },
    inconsistencies: [],
  }

  if (!jsonOutput) {
    console.log('═'.repeat(80))
    console.log('  DETECT ASSET PLANT CHANGES FROM DIESEL TRANSACTIONS')
    console.log('═'.repeat(80))
    console.log(`\nDate range: ${dateFrom} to ${dateTo}`)
    console.log('Excluding: transfers (is_transfer=true)\n')
  }

  const dateFromT = `${dateFrom}T00:00:00.000Z`
  const dateToEnd = `${dateTo}T23:59:59.999Z`

  // ─── 1. Load plants ───
  const { data: plants, error: plantsErr } = await supabase
    .from('plants')
    .select('id, name')
  if (plantsErr) throw plantsErr
  const plantById = new Map((plants || []).map((p) => [p.id, p.name]))

  // ─── 2. Load diesel transactions (consumption, exclude transfers) ───
  const dieselRows: { asset_id: string; plant_id: string; transaction_date: string }[] = []
  const pageSize = 1000
  let offset = 0
  let hasMore = true
  while (hasMore) {
    const { data: batch, error: dieselErr } = await supabase
      .from('diesel_transactions')
      .select('asset_id, plant_id, transaction_date')
      .gte('transaction_date', dateFromT)
      .lte('transaction_date', dateToEnd)
      .eq('transaction_type', 'consumption')
      .or('is_transfer.is.null,is_transfer.eq.false')
      .order('transaction_date', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (dieselErr) throw dieselErr
    if (!batch || batch.length === 0) break
    dieselRows.push(...batch)
    if (batch.length < pageSize) break
    offset += pageSize
  }

  if (!jsonOutput) console.log(`  Diesel transactions loaded: ${dieselRows.length}`)

  // Group by asset
  const dieselByAsset = new Map<string, { plant_id: string; transaction_date: string }[]>()
  for (const row of dieselRows || []) {
    if (!row.asset_id || !row.plant_id) continue
    const list = dieselByAsset.get(row.asset_id) || []
    list.push({
      plant_id: row.plant_id,
      transaction_date: row.transaction_date,
    })
    dieselByAsset.set(row.asset_id, list)
  }

  // For each asset with multiple plants: order by date, dedupe consecutive same plant
  const dieselMovesByAsset = new Map<string, DieselMove[]>()
  for (const [assetId, txs] of dieselByAsset) {
    if (txs.length < 2) continue
    txs.sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime())
    const moves: DieselMove[] = []
    for (let i = 1; i < txs.length; i++) {
      const prev = txs[i - 1]
      const curr = txs[i]
      if (prev.plant_id !== curr.plant_id) {
        moves.push({
          from_plant_id: prev.plant_id,
          from_plant_name: plantById.get(prev.plant_id) || prev.plant_id,
          to_plant_id: curr.plant_id,
          to_plant_name: plantById.get(curr.plant_id) || curr.plant_id,
          first_tx_date: curr.transaction_date,
          last_tx_in_prev_plant: prev.transaction_date,
        })
      }
    }
    if (moves.length > 0) dieselMovesByAsset.set(assetId, moves)
  }

  report.summary.total_assets_with_diesel = dieselByAsset.size

  // ─── 3. Load asset_assignment_history ───
  const { data: historyRows, error: histErr } = await supabase
    .from('asset_assignment_history')
    .select('asset_id, previous_plant_id, new_plant_id, created_at')
    .order('created_at', { ascending: true })

  if (histErr) throw histErr

  const historyByAsset = new Map<string, HistoryMove[]>()
  for (const row of historyRows || []) {
    const list = historyByAsset.get(row.asset_id) || []
    list.push({
      previous_plant_id: row.previous_plant_id,
      previous_plant_name: plantById.get(row.previous_plant_id) || row.previous_plant_id,
      new_plant_id: row.new_plant_id,
      new_plant_name: plantById.get(row.new_plant_id) || row.new_plant_id,
      created_at: row.created_at,
    })
    historyByAsset.set(row.asset_id, list)
  }

  // ─── 4. Load assets (current plant) ───
  const assetIds = new Set([...dieselByAsset.keys(), ...historyByAsset.keys()])
  const { data: assets, error: assetsErr } = await supabase
    .from('assets')
    .select('id, asset_id, name, plant_id')
    .in('id', Array.from(assetIds))
  if (assetsErr) throw assetsErr
  const assetById = new Map((assets || []).map((a) => [a.id, a]))

  // ─── 5. Detect inconsistencies ───
  const inconsistencies: Inconsistency[] = []

  for (const assetId of assetIds) {
    const asset = assetById.get(assetId)
    const assetCode = asset?.asset_id ?? '?'
    const assetName = asset?.name ?? '?'
    const currentPlantId = asset?.plant_id ?? null
    const currentPlantName = currentPlantId ? plantById.get(currentPlantId) ?? currentPlantId : null

    const dieselTxs = dieselByAsset.get(assetId) || []
    const dieselMoves = dieselMovesByAsset.get(assetId) || []
    const historyMoves = historyByAsset.get(assetId) || []

    if (dieselTxs.length === 0) continue

    const lastDieselTx = dieselTxs[dieselTxs.length - 1]
    const lastDieselPlantId = lastDieselTx.plant_id
    const lastDieselPlantName = plantById.get(lastDieselPlantId) ?? lastDieselPlantId
    const lastDieselDate = lastDieselTx.transaction_date

    // A) Current assets.plant_id ≠ last diesel plant
    if (currentPlantId && currentPlantId !== lastDieselPlantId) {
      inconsistencies.push({
        asset_id: assetId,
        asset_code: assetCode,
        asset_name: assetName,
        type: 'CURRENT_VS_DIESEL_MISMATCH',
        severity: 'high',
        details: `assets.plant_id=${currentPlantName} but last diesel (${lastDieselDate}) was at ${lastDieselPlantName}`,
        current_plant_id: currentPlantId,
        current_plant_name: currentPlantName ?? undefined,
        last_diesel_plant_id: lastDieselPlantId,
        last_diesel_plant_name: lastDieselPlantName,
        last_diesel_date: lastDieselDate,
      })
    }

    // B) Last history says asset moved to X, but current plant ≠ X (return not recorded)
    if (historyMoves.length > 0) {
      const lastHist = historyMoves[historyMoves.length - 1]
      const lastHistNewPlant = lastHist.new_plant_id
      if (currentPlantId && lastHistNewPlant && currentPlantId !== lastHistNewPlant) {
        // History says asset is in lastHistNewPlant, but current is different → return was not recorded
        const returnMoves = dieselMoves.filter(
          (m) => m.from_plant_id === lastHistNewPlant && m.to_plant_id === currentPlantId
        )
        const lastReturnMove = returnMoves.length > 0 ? returnMoves[returnMoves.length - 1] : undefined
        inconsistencies.push({
          asset_id: assetId,
          asset_code: assetCode,
          asset_name: assetName,
          type: 'MISSING_RETURN',
          severity: 'high',
          details: `History says moved to ${lastHist.new_plant_name} but current plant is ${currentPlantName}. Return not in asset_assignment_history.`,
          history_record: lastHist,
          current_plant_id: currentPlantId,
          current_plant_name: currentPlantName ?? undefined,
          diesel_evidence: lastReturnMove,
          suggested_return_date: lastReturnMove?.first_tx_date,
        })
      }
    }

    // C) Diesel shows moves not in history (looser check: any diesel move not approximated in history)
    for (const dm of dieselMoves) {
      const hasMatchingHistory = historyMoves.some(
        (hm) =>
          (hm.previous_plant_id === dm.from_plant_id || hm.previous_plant_id === null) &&
          hm.new_plant_id === dm.to_plant_id
      )
      if (!hasMatchingHistory) {
        // Only flag if it's a "return" type (to plant different from last history) or significant
        const lastHist = historyMoves[historyMoves.length - 1]
        const isReturnNotRecorded =
          lastHist && lastHist.new_plant_id === dm.from_plant_id && dm.to_plant_id === currentPlantId
        if (isReturnNotRecorded) {
          // Already covered by MISSING_RETURN
          continue
        }
        // Flag as missing move only if diesel shows many moves and history is sparse
        if (dieselMoves.length > historyMoves.length + 1) {
          inconsistencies.push({
            asset_id: assetId,
            asset_code: assetCode,
            asset_name: assetName,
            type: 'MISSING_MOVE',
            severity: 'medium',
            details: `Diesel: ${dm.from_plant_name} → ${dm.to_plant_name} at ~${dm.first_tx_date.split('T')[0]}, no matching asset_assignment_history`,
            diesel_evidence: dm,
          })
        }
      }
    }
  }

  // Dedupe by asset+type where we have multiple MISSING_RETURN/MISSING_MOVE for same asset
  const seen = new Set<string>()
  const deduped = inconsistencies.filter((i) => {
    const key = `${i.asset_id}:${i.type}`
    if (i.type === 'MISSING_RETURN' || i.type === 'CURRENT_VS_DIESEL_MISMATCH') {
      if (seen.has(key)) return false
      seen.add(key)
    }
    return true
  })

  const filtered = highOnly ? deduped.filter((i) => i.severity === 'high') : deduped
  report.inconsistencies = filtered
  report.summary.inconsistencies = filtered.length
  report.summary.by_type = filtered.reduce(
    (acc, i) => {
      acc[i.type] = (acc[i.type] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  // ─── Console output ───
  console.log('SUMMARY')
  console.log('-'.repeat(40))
  console.log(`Assets with diesel in range: ${report.summary.total_assets_with_diesel}`)
  console.log(`Inconsistencies found: ${report.summary.inconsistencies}`)
  console.log('By type:', report.summary.by_type)
  console.log()

  if (filtered.length === 0) {
    console.log('✅ No inconsistencies detected.')
    return
  }

  console.log('INCONSISTENCIES')
  console.log('='.repeat(80))
  for (const inc of filtered) {
    console.log(`\n[${inc.severity.toUpperCase()}] ${inc.asset_code} (${inc.asset_name})`)
    console.log(`  Type: ${inc.type}`)
    console.log(`  ${inc.details}`)
    if (inc.diesel_evidence) {
      console.log(`  Diesel: ${inc.diesel_evidence.from_plant_name} → ${inc.diesel_evidence.to_plant_name} at ${inc.diesel_evidence.first_tx_date.split('T')[0]}`)
    }
    if (inc.suggested_return_date) {
      console.log(`  Suggested return date for asset_assignment_history: ${inc.suggested_return_date.split('T')[0]}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
