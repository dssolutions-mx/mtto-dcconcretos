/**
 * Verify assets at Plant 5 using the SAME query structure as the executive report route.
 * Uses: business_units → plants → assets, asset_assignment_history, resolveAssetPlantAtTimestamp.
 *
 * Run: npx tsx scripts/verify-plant5-assets-executive-logic.ts
 *      npx tsx scripts/verify-plant5-assets-executive-logic.ts --from 2025-10-01 --to 2025-12-31
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { buildAssignmentHistoryMap, resolveAssetPlantAtTimestamp } from '../lib/reporting/asset-plant-attribution'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!url || !key) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}
const supabase = createClient(url, key)

const args = process.argv.slice(2)
const fromIdx = args.indexOf('--from')
const toIdx = args.indexOf('--to')
const dateFrom = fromIdx >= 0 ? args[fromIdx + 1] : '2025-10-01'
const dateTo = toIdx >= 0 ? args[toIdx + 1] : '2025-12-31'

async function main() {
  const dateFromStr = dateFrom.includes('T') ? dateFrom.split('T')[0] : dateFrom
  const dateToStr = dateTo.includes('T') ? dateTo.split('T')[0] : dateTo
  const attributionDate = `${dateToStr}T23:59:59.999Z`

  console.log('═'.repeat(80))
  console.log('  VERIFY PLANT 5 ASSETS — EXECUTIVE REPORT LOGIC')
  console.log('═'.repeat(80))
  console.log(`\nPeriod end (attribution date): ${attributionDate}`)
  console.log('Using: business_units → plants → assets + asset_assignment_history + resolveAssetPlantAtTimestamp\n')

  // ─── Same as executive route: Get organizational structure ───
  const { data: businessUnits, error: buError } = await supabase
    .from('business_units')
    .select(`
      id, name, code,
      plants:plants(
        id, name, code,
        assets:assets(
          id, asset_id, name, model_id,
          equipment_models:equipment_models(name, manufacturer, category)
        )
      )
    `)
    .order('name')
  if (buError) throw buError

  const plantById = new Map<string, { id: string; name: string; code: string; business_unit_id: string; business_unit_name: string }>()
  const rawAssets: any[] = []

  for (const bu of businessUnits || []) {
    for (const plant of bu.plants || []) {
      plantById.set(plant.id, {
        id: plant.id,
        name: plant.name,
        code: plant.code,
        business_unit_id: bu.id,
        business_unit_name: bu.name,
      })
      for (const asset of plant.assets || []) {
        rawAssets.push({
          ...asset,
          current_plant_id: plant.id,
          current_plant_name: plant.name,
          current_business_unit_id: bu.id,
          current_business_unit_name: bu.name,
        })
      }
    }
  }

  // ─── Same as executive: asset_assignment_history ───
  const rawAssetIds = rawAssets.map((a) => a.id)
  let assignmentRows: any[] = []
  if (rawAssetIds.length > 0) {
    const { data, error } = await supabase
      .from('asset_assignment_history')
      .select('asset_id, previous_plant_id, new_plant_id, created_at')
      .in('asset_id', rawAssetIds)
      .order('created_at', { ascending: true })
    if (error) throw error
    assignmentRows = data || []
  }
  const assignmentHistoryMap = buildAssignmentHistoryMap(assignmentRows)

  // ─── Same as executive: resolve attribution at period end ───
  const allAssets = rawAssets
    .map((asset) => {
      const attributedPlantId = resolveAssetPlantAtTimestamp({
        assetId: asset.id,
        eventDate: attributionDate,
        currentPlantId: asset.current_plant_id,
        historyByAsset: assignmentHistoryMap,
      })
      const attributedPlant = attributedPlantId ? plantById.get(attributedPlantId) : null
      if (!attributedPlant) return null
      return {
        ...asset,
        plant_id: attributedPlant.id,
        plant_name: attributedPlant.name,
        plant_code: attributedPlant.code,
        business_unit_id: attributedPlant.business_unit_id,
        business_unit_name: attributedPlant.business_unit_name,
      }
    })
    .filter((a): a is NonNullable<typeof a> => !!a)

  // ─── Filter to Plant 5 (P005) ───
  const p5 = Array.from(plantById.values()).find((p) => p.code === 'P005')
  if (!p5) {
    console.error('❌ Plant 5 (P005) not found')
    process.exit(1)
  }

  const p5Assets = allAssets.filter((a) => a.plant_id === p5.id)
  p5Assets.sort((a, b) => (a.asset_id || '').localeCompare(b.asset_id || ''))

  console.log('PLANT 5 (P005) ASSETS — per executive report attribution logic')
  console.log('-'.repeat(60))
  console.log(`Total assets attributed to Plant 5 at period end: ${p5Assets.length}\n`)

  for (const a of p5Assets) {
    const isCurrent = a.current_plant_id === p5.id
    const fromHistory = a.current_plant_id !== p5.id
    console.log(`  ${a.asset_id || '?'} — ${a.name}`)
    console.log(`    current_plant: ${a.current_plant_name} | attributed: ${a.plant_name} ${fromHistory ? '(from history)' : ''}`)
  }

  // ─── Summary by plant (all plants for context) ───
  const byPlant = new Map<string, { name: string; count: number; assets: string[] }>()
  for (const a of allAssets) {
    const key = a.plant_id
    if (!byPlant.has(key)) {
      const p = plantById.get(key)!
      byPlant.set(key, { name: p.name, count: 0, assets: [] })
    }
    const ent = byPlant.get(key)!
    ent.count++
    ent.assets.push(a.asset_id || '?')
  }
  console.log('\nAll plants (asset count at period end):')
  for (const [pid, v] of byPlant) {
    const p = plantById.get(pid)
    console.log(`  ${p?.code || pid}: ${v.name} — ${v.count} assets`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
