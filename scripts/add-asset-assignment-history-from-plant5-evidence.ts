/**
 * Add asset_assignment_history for Plant 5 assets based on diesel + remisiones evidence
 *
 * Same procedure as fix for MISSING_RETURN: use diesel transactions and (optionally)
 * Cotizador remisiones to identify assets at P005, then generate INSERTs.
 *
 * Run: npx tsx scripts/add-asset-assignment-history-from-plant5-evidence.ts
 *      npx tsx scripts/add-asset-assignment-history-from-plant5-evidence.ts --from 2025-10-01 --to 2025-12-31
 *      npx tsx scripts/add-asset-assignment-history-from-plant5-evidence.ts --apply  # actually insert
 *      npx tsx scripts/add-asset-assignment-history-from-plant5-evidence.ts --sql     # output SQL only
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const maintUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const maintKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const cotizadorUrl = process.env.COTIZADOR_SUPABASE_URL
const cotizadorKey = process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY

if (!maintUrl || !maintKey) {
  console.error('❌ Missing Maintenance Supabase credentials')
  process.exit(1)
}

const maint = createClient(maintUrl, maintKey)
const cotizador =
  cotizadorUrl && cotizadorKey
    ? createClient(cotizadorUrl, cotizadorKey, { auth: { persistSession: false } })
    : null

const CHANGED_BY = 'c34258ca-cc26-409d-b541-046d53b89b21'
const CHANGE_REASON = 'Corrección por script add-asset-assignment-history-from-plant5-evidence (diesel + remisiones P005)'

// Exclude new assets placed at P5 from the start (no move to record needed)
const EXCLUDE_ASSET_CODES = ['CF-04']

type SuggestedRecord = {
  asset_id: string
  asset_code: string
  asset_name: string
  previous_plant_id: string | null
  previous_plant_name: string | null
  new_plant_id: string
  new_plant_name: string
  created_at: string
  evidence: 'diesel' | 'remisiones' | 'both'
  first_diesel_at_p5?: string
  first_remision_day?: string
}

// ─── Parse CLI ───
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const sqlOnly = args.includes('--sql')
const fromIdx = args.indexOf('--from')
const toIdx = args.indexOf('--to')
const dateFrom = fromIdx >= 0 ? args[fromIdx + 1] : '2025-10-01'
const dateTo = toIdx >= 0 ? args[toIdx + 1] : '2025-12-31'

async function main() {
  const dateFromT = `${dateFrom}T00:00:00.000Z`
  const dateToEnd = `${dateTo}T23:59:59.999Z`

  console.log('═'.repeat(80))
  console.log('  ADD ASSET ASSIGNMENT HISTORY FROM PLANT 5 EVIDENCE (diesel + remisiones)')
  console.log('═'.repeat(80))
  console.log(`\nDate range: ${dateFrom} to ${dateTo}`)
  console.log(`Mode: ${apply ? 'APPLY (will insert)' : sqlOnly ? 'SQL output only' : 'Dry run (print only)'}\n`)

  // ─── 1. Get Plant 5 (P005) ───
  const { data: p5, error: p5Err } = await maint
    .from('plants')
    .select('id, name, code')
    .eq('code', 'P005')
    .single()
  if (p5Err || !p5) {
    console.error('❌ Plant 5 (P005) not found:', p5Err?.message || 'No row')
    process.exit(1)
  }
  const p005Id = p5.id

  // ─── 2. Load all plants for names ───
  const { data: plants } = await maint.from('plants').select('id, name')
  const plantById = new Map((plants || []).map((p) => [p.id, p.name]))

  // ─── 3. Diesel at P005 ───
  const dieselRows: { asset_id: string; plant_id: string; transaction_date: string }[] = []
  let offset = 0
  const pageSize = 1000
  while (true) {
    const { data: batch, error } = await maint
      .from('diesel_transactions')
      .select('asset_id, plant_id, transaction_date')
      .eq('plant_id', p005Id)
      .eq('transaction_type', 'consumption')
      .or('is_transfer.is.null,is_transfer.eq.false')
      .gte('transaction_date', dateFromT)
      .lte('transaction_date', dateToEnd)
      .order('transaction_date', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    if (!batch?.length) break
    dieselRows.push(...batch)
    if (batch.length < pageSize) break
    offset += pageSize
  }

  // Group diesel by asset: first and last date at P5
  const dieselByAsset = new Map<string, { first: string; last: string }[]>()
  for (const row of dieselRows) {
    if (!row.asset_id) continue
    const list = dieselByAsset.get(row.asset_id) || []
    list.push({ first: row.transaction_date, last: row.transaction_date })
    dieselByAsset.set(row.asset_id, list)
  }
  // Collapse to first/last overall per asset
  const dieselFirstLast = new Map<string, { first: string; last: string }>()
  for (const [aid, arr] of dieselByAsset) {
    const dates = arr.flatMap((d) => [d.first, d.last]).sort()
    dieselFirstLast.set(aid, { first: dates[0], last: dates[dates.length - 1] })
  }

  // ─── 4. Remisiones at P005 (Cotizador) ───
  let remisionesByAssetName = new Map<string, { first: string; last: string }>()
  if (cotizador) {
    const { data: cotPlants } = await cotizador.from('plants').select('id, code').eq('code', 'P005')
    const cotP5Id = cotPlants?.[0]?.id
    if (cotP5Id) {
      const { data: sales } = await cotizador
        .from('sales_assets_daily')
        .select('asset_name, day')
        .eq('plant_id', cotP5Id)
        .gte('day', dateFrom)
        .lte('day', dateTo)
        .order('day', { ascending: true })
      const byName = new Map<string, string[]>()
      for (const row of sales || []) {
        if (!row.asset_name) continue
        const list = byName.get(row.asset_name) || []
        list.push(row.day)
        byName.set(row.asset_name, list)
      }
      for (const [name, days] of byName) {
        const sorted = [...days].sort()
        remisionesByAssetName.set(name, { first: sorted[0], last: sorted[sorted.length - 1] })
      }
    }
  } else {
    console.log('  ⚠ Cotizador not configured — diesel evidence only\n')
  }

  // ─── 5. Map Cotizador asset_name → Maintenance asset_id ───
  const assetNameToId = new Map<string, string>()
  const assetIdToCotizadorNames = new Map<string, string[]>()
  const assetIdToCode = new Map<string, string>()
  const assetIdToName = new Map<string, string>()
  const { data: mappings } = await maint
    .from('asset_name_mappings')
    .select('external_unit, asset_id, source_system')
    .or('source_system.eq.cotizador,source_system.is.null')
  for (const m of mappings || []) {
    if (m.external_unit && m.asset_id) {
      const key = m.external_unit.toUpperCase().trim()
      assetNameToId.set(key, m.asset_id)
      const list = assetIdToCotizadorNames.get(m.asset_id) || []
      list.push(m.external_unit)
      assetIdToCotizadorNames.set(m.asset_id, list)
    }
  }
  const allAssetIds = new Set(dieselFirstLast.keys())
  for (const name of remisionesByAssetName.keys()) {
    const id = assetNameToId.get(name.toUpperCase().trim())
    if (id) allAssetIds.add(id)
  }
  if (allAssetIds.size > 0) {
    const { data: assets } = await maint
      .from('assets')
      .select('id, asset_id, name')
      .in('id', Array.from(allAssetIds))
    for (const a of assets || []) {
      assetIdToCode.set(a.id, a.asset_id || '')
      assetIdToName.set(a.id, a.name || '')
      if (a.asset_id) {
        assetNameToId.set(a.asset_id.toUpperCase(), a.id)
        if (!assetIdToCotizadorNames.has(a.id)) {
          assetIdToCotizadorNames.set(a.id, [a.asset_id])
        }
      }
    }
  }

  // ─── 6. Get previous plant from diesel (last tx at another plant before first P5) ───
  const assetIds = Array.from(allAssetIds)
  const prevPlantByAsset = new Map<string, string | null>()
  if (assetIds.length > 0) {
    const { data: allTxs } = await maint
      .from('diesel_transactions')
      .select('asset_id, plant_id, transaction_date')
      .in('asset_id', assetIds)
      .eq('transaction_type', 'consumption')
      .or('is_transfer.is.null,is_transfer.eq.false')
      .lt('transaction_date', dateFromT)
      .order('transaction_date', { ascending: false })
    const byAsset = new Map<string, { plant_id: string; transaction_date: string }[]>()
    for (const row of allTxs || []) {
      if (!row.asset_id || !row.plant_id || row.plant_id === p005Id) continue
      const list = byAsset.get(row.asset_id) || []
      list.push({ plant_id: row.plant_id, transaction_date: row.transaction_date })
      byAsset.set(row.asset_id, list)
    }
    for (const [aid, txs] of byAsset) {
      const sorted = txs.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
      prevPlantByAsset.set(aid, sorted[0]?.plant_id || null)
    }
  }

  // ─── 7. Load existing history ───
  const { data: historyRows } = await maint
    .from('asset_assignment_history')
    .select('asset_id, new_plant_id, created_at')
    .in('asset_id', assetIds)
    .order('created_at', { ascending: true })
  const historyHasP5 = new Set<string>()
  for (const row of historyRows || []) {
    if (row.new_plant_id === p005Id) historyHasP5.add(row.asset_id)
  }

  // ─── 8. Build suggested records ───
  const suggested: SuggestedRecord[] = []
  const added = new Set<string>()
  for (const assetId of assetIds) {
    if (historyHasP5.has(assetId)) continue
    const code = assetIdToCode.get(assetId)
    if (code && EXCLUDE_ASSET_CODES.includes(code.toUpperCase())) continue
    const diesel = dieselFirstLast.get(assetId)
    let remision: { first: string; last: string } | undefined
    const cotNames = assetIdToCotizadorNames.get(assetId) || []
    if (code) cotNames.push(code)
    for (const name of [...new Set(cotNames)]) {
      const r = remisionesByAssetName.get(name) || remisionesByAssetName.get(name.toUpperCase())
      if (r) {
        remision = r
        break
      }
    }
    if (!diesel && !remision) continue

    const firstDiesel = diesel?.first
    const firstRemision = remision?.first
    let created_at: string
    let evidence: 'diesel' | 'remisiones' | 'both'
    if (firstDiesel && firstRemision) {
      evidence = 'both'
      created_at =
        new Date(firstDiesel) <= new Date(firstRemision) ? firstDiesel : `${firstRemision}T12:00:00.000Z`
    } else if (firstDiesel) {
      evidence = 'diesel'
      created_at = firstDiesel
    } else {
      evidence = 'remisiones'
      created_at = `${firstRemision}T12:00:00.000Z`
    }

    const prevId = prevPlantByAsset.get(assetId) ?? null
    const key = `${assetId}:${created_at.slice(0, 10)}`
    if (added.has(key)) continue
    added.add(key)

    suggested.push({
      asset_id: assetId,
      asset_code: assetIdToCode.get(assetId) || '?',
      asset_name: assetIdToName.get(assetId) || '?',
      previous_plant_id: prevId,
      previous_plant_name: prevId ? plantById.get(prevId) || prevId : null,
      new_plant_id: p005Id,
      new_plant_name: plantById.get(p005Id) || 'Planta 5',
      created_at,
      evidence,
      first_diesel_at_p5: firstDiesel,
      first_remision_day: remision?.first,
    })
  }

  suggested.sort((a, b) => a.created_at.localeCompare(b.created_at))

  // ─── 9. Output / Apply ───
  console.log('SUMMARY')
  console.log('-'.repeat(40))
  console.log(`Diesel transactions at P005 in range: ${dieselRows.length}`)
  console.log(`Assets with diesel at P005: ${dieselFirstLast.size}`)
  console.log(`Assets with remisiones at P005: ${remisionesByAssetName.size}`)
  console.log(`Suggested records (no existing history at P5): ${suggested.length}`)
  console.log()

  if (suggested.length === 0) {
    console.log('✅ No records to add. All assets with evidence at P005 already have asset_assignment_history.')
    return
  }

  console.log('SUGGESTED RECORDS')
  console.log('='.repeat(80))
  for (const r of suggested) {
    console.log(`  ${r.asset_code} (${r.asset_name})`)
    console.log(`    previous_plant: ${r.previous_plant_name || 'NULL'}`)
    console.log(`    new_plant: ${r.new_plant_name}`)
    console.log(`    created_at: ${r.created_at}`)
    console.log(`    evidence: ${r.evidence}`)
    console.log()
  }

  if (sqlOnly) {
    console.log('SQL (copy to migration):')
    console.log('-'.repeat(40))
    console.log(`-- Add asset_assignment_history for Plant 5 assets (diesel + remisiones evidence)`)
    console.log(`INSERT INTO asset_assignment_history (asset_id, previous_plant_id, new_plant_id, changed_by, change_reason, created_at) VALUES`)
    suggested.forEach((r, i) => {
      const prev = r.previous_plant_id ? `'${r.previous_plant_id}'` : 'NULL'
      const comma = i < suggested.length - 1 ? ',' : ';'
      console.log(`  ('${r.asset_id}', ${prev}, '${r.new_plant_id}', '${CHANGED_BY}'::uuid, '${CHANGE_REASON}', '${r.created_at}')${comma}`)
    })
    return
  }

  if (apply) {
    console.log('Applying inserts...')
    for (const r of suggested) {
      const { error } = await maint.from('asset_assignment_history').insert({
        asset_id: r.asset_id,
        previous_plant_id: r.previous_plant_id,
        new_plant_id: r.new_plant_id,
        changed_by: CHANGED_BY,
        change_reason: CHANGE_REASON,
        created_at: r.created_at,
      })
      if (error) {
        console.error(`  ❌ ${r.asset_code}: ${error.message}`)
      } else {
        console.log(`  ✅ ${r.asset_code} inserted`)
      }
    }
    console.log(`\nDone. ${suggested.length} records inserted.`)
  } else {
    console.log('Dry run. Use --apply to insert, or --sql to output SQL.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
