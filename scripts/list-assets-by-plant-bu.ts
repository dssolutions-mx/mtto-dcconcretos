/**
 * List assets by plant and by business unit using executive report API logic.
 * Attribution at period end via asset_assignment_history.
 *
 * Run: npx tsx scripts/list-assets-by-plant-bu.ts
 *      npx tsx scripts/list-assets-by-plant-bu.ts --from 2025-10-01 --to 2025-12-31
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
  const dateToStr = dateTo.includes('T') ? dateTo.split('T')[0] : dateTo
  const attributionDate = `${dateToStr}T23:59:59.999Z`

  console.log('═'.repeat(80))
  console.log('  ASSETS BY PLANT & BUSINESS UNIT — Q4 2025 (Executive Report Logic)')
  console.log('═'.repeat(80))
  console.log(`\nAttribution date (period end): ${attributionDate}`)
  console.log('')

  const { data: businessUnits, error: buError } = await supabase
    .from('business_units')
    .select(`
      id, name, code,
      plants:plants(
        id, name, code,
        assets:assets(
          id, asset_id, name,
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
          current_business_unit_id: bu.id,
        })
      }
    }
  }

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
        id: asset.id,
        asset_id: asset.asset_id,
        name: asset.name,
        model: (asset as any).equipment_models?.name,
        manufacturer: (asset as any).equipment_models?.manufacturer,
        category: (asset as any).equipment_models?.category,
        plant_id: attributedPlant.id,
        plant_code: attributedPlant.code,
        plant_name: attributedPlant.name,
        business_unit_id: attributedPlant.business_unit_id,
        business_unit_name: attributedPlant.business_unit_name,
      }
    })
    .filter((a): a is NonNullable<typeof a> => !!a)

  // ─── BY PLANT ───
  const byPlant = new Map<string, { code: string; name: string; bu: string; assets: typeof allAssets }>()
  for (const a of allAssets) {
    const p = plantById.get(a.plant_id)!
    if (!byPlant.has(a.plant_id)) {
      byPlant.set(a.plant_id, { code: p.code, name: p.name, bu: p.business_unit_name, assets: [] })
    }
    byPlant.get(a.plant_id)!.assets.push(a)
  }
  const plantsSorted = Array.from(byPlant.entries()).sort(([, a], [, b]) => a.code.localeCompare(b.code))

  console.log('BY PLANT')
  console.log('─'.repeat(80))
  for (const [plantId, ent] of plantsSorted) {
    ent.assets.sort((a, b) => (a.asset_id || '').localeCompare(b.asset_id || ''))
    console.log(`\n${ent.code} — ${ent.name} (${ent.bu}) — ${ent.assets.length} assets`)
    for (const a of ent.assets) {
      const cat = a.category || 'Sin categoría'
      const model = a.model ? ` | ${a.model}` : ''
      console.log(`    ${a.asset_id || '?'} — ${a.name}`)
      console.log(`        ${cat}${model}`)
    }
  }

  // ─── BY BUSINESS UNIT ───
  const byBU = new Map<string, { name: string; plants: Map<string, typeof allAssets> }>()
  for (const a of allAssets) {
    const buId = a.business_unit_id
    const buName = a.business_unit_name
    if (!byBU.has(buId)) {
      byBU.set(buId, { name: buName, plants: new Map() })
    }
    const buEnt = byBU.get(buId)!
    if (!buEnt.plants.has(a.plant_id)) {
      buEnt.plants.set(a.plant_id, [])
    }
    buEnt.plants.get(a.plant_id)!.push(a)
  }

  console.log('\n\n')
  console.log('BY BUSINESS UNIT')
  console.log('─'.repeat(80))
  for (const [buId, ent] of byBU) {
    const plantCodes = Array.from(ent.plants.keys())
      .map((pid) => plantById.get(pid)!.code)
      .sort()
    const totalAssets = Array.from(ent.plants.values()).reduce((s, arr) => s + arr.length, 0)
    console.log(`\n${ent.name} — plants: ${plantCodes.join(', ')} — ${totalAssets} assets`)
    const plantEntries = Array.from(ent.plants.entries()).sort(([ida], [idb]) => {
      const ca = plantById.get(ida)!.code
      const cb = plantById.get(idb)!.code
      return ca.localeCompare(cb)
    })
    for (const [plantId, assets] of plantEntries) {
      const p = plantById.get(plantId)!
      assets.sort((a, b) => (a.asset_id || '').localeCompare(b.asset_id || ''))
      console.log(`  ${p.code} — ${p.name} (${assets.length})`)
      for (const a of assets) {
        const cat = a.category || 'Sin categoría'
        const model = a.model ? ` | ${a.model}` : ''
        console.log(`      ${a.asset_id || '?'} — ${a.name}`)
        console.log(`          ${cat}${model}`)
      }
    }
  }

  console.log('\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
