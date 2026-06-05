/**
 * Import May 2026 Payroll (Nómina) from GASTO_DE_NOMINA_MAYO_2026_PROCESSED.xlsx
 *
 * Usage:
 *   npx tsx scripts/import-may-nomina.ts          # dry-run (no DB writes)
 *   npx tsx scripts/import-may-nomina.ts --import  # real import
 */

import { createClient } from '@supabase/supabase-js'
import * as ExcelJS from 'exceljs'

require('dotenv').config({ path: '.env.local' })

const XLSX_PATH =
  'D:\\Downloads\\DC CONCRETOS\\GASTO_DE_NOMINA_MAYO_2026_PROCESSED.xlsx'
const SHEET_NAME = 'IMPORTACIÓN'
const PERIOD_MONTH = '2026-05-01'
const DRY_RUN = !process.argv.includes('--import')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const COTIZADOR_SUPABASE_URL = process.env.COTIZADOR_SUPABASE_URL!
const COTIZADOR_SUPABASE_SERVICE_ROLE_KEY =
  process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
  throw new Error('Missing Supabase env vars')
if (!COTIZADOR_SUPABASE_URL || !COTIZADOR_SUPABASE_SERVICE_ROLE_KEY)
  throw new Error('Missing Cotizador Supabase env vars')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})
const cotizadorSupabase = createClient(
  COTIZADOR_SUPABASE_URL,
  COTIZADOR_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NominaRow {
  rowNum: number
  concept: string
  ptu: number | null
  amount: number
  planta: string // raw PLANTA column
  bu: string // raw UN. NEGOCIO column
  dept: string
  tipo: string // NÓMINA | EFECTIVO
  tipoPago: string // TRUE | FALSE (cash flag)
  alcance: string // PLANTA | DISTRIBUIDO
  subcategoryDb: string
  notas: string
}

interface DistributionTarget {
  plantId: string
  plantCode: string
  percentage: number
  amount: number
  volumeM3: number
}

// ---------------------------------------------------------------------------
// Helpers: cash concept → subcategory / category
// ---------------------------------------------------------------------------

function classifyCashConcept(concept: string): {
  category: string
  expenseSubcategory: string
} {
  const u = concept.toUpperCase()

  // Comidas → indirect cost
  if (u.includes('COMIDA') || u.includes('ALIMENTAC')) {
    return {
      category: 'otros_indirectos',
      expenseSubcategory: 'Atención al Personal (Comidas, Almuerzo)'
    }
  }
  if (u.includes('TIEMPO EXTRA')) {
    return { category: 'nomina', expenseSubcategory: 'Tiempo Extra' }
  }
  if (u.includes('BONO')) {
    return { category: 'nomina', expenseSubcategory: 'Bono Producción' }
  }
  // All other cash (apoyo, nómina efectivo, celular, vigilante…) → nomina
  return { category: 'nomina', expenseSubcategory: '' }
}

// ---------------------------------------------------------------------------
// DB lookups
// ---------------------------------------------------------------------------

async function getPlantMapping(): Promise<Map<string, string>> {
  const { data: plants, error } = await supabase
    .from('plants')
    .select('id, code, name')
    .eq('status', 'active')
  if (error) throw error

  const m = new Map<string, string>()
  ;(plants || []).forEach(p => {
    const numMatch = p.code.match(/P0*(\d+)/i)
    if (numMatch) {
      const n = numMatch[1]
      const ni = parseInt(n, 10)
      m.set(String(ni), p.id)
      m.set(`P${ni}`, p.id)
      m.set(`p${ni}`, p.id)
    }
    // 4P variants
    if (p.code === 'P004P') {
      m.set('4P', p.id)
      m.set('4p', p.id)
      m.set('P004P', p.id)
      m.set('p004p', p.id)
    }
    m.set(p.code, p.id)
    m.set(p.code.toLowerCase(), p.id)
  })
  return m
}

async function getBusinessUnitMapping(): Promise<Map<string, string>> {
  const { data: bus, error } = await supabase
    .from('business_units')
    .select('id, code, name')
  if (error) throw error

  const m = new Map<string, string>()
  ;(bus || []).forEach(bu => {
    const nl = bu.name.toLowerCase()
    if (nl.includes('bajio') || nl.includes('bajío')) {
      m.set('BJ', bu.id)
      m.set('bj', bu.id)
      m.set('BU001', bu.id)
    }
    if (nl.includes('tijuana')) {
      m.set('BU002', bu.id)
      m.set('TJ', bu.id)
    }
    if (bu.code) {
      m.set(bu.code, bu.id)
      m.set(bu.code.toLowerCase(), bu.id)
    }
    m.set(bu.name.toLowerCase(), bu.id)
  })
  return m
}

async function getAllPlants(): Promise<
  Array<{ id: string; code: string; business_unit_id: string }>
> {
  const { data, error } = await supabase
    .from('plants')
    .select('id, code, business_unit_id')
    .eq('status', 'active')
  if (error) throw error
  return data || []
}

async function getPlantVolumes(): Promise<Map<string, number>> {
  const { data, error } = await cotizadorSupabase
    .from('vw_plant_financial_analysis_unified')
    .select('plant_code, volumen_concreto_m3')
    .eq('period_start', PERIOD_MONTH)

  if (error) {
    console.warn('Could not fetch volumes from cotizador:', error.message)
    return new Map()
  }

  const vols = new Map<string, number>()
  ;(data || []).forEach((r: any) => {
    const code = r.plant_code
    const vol = Number(r.volumen_concreto_m3 || 0)
    vols.set(code, (vols.get(code) || 0) + vol)
  })
  return vols
}

async function getAdminProfileId(): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
  if (error || !data?.length) throw new Error('No profile found')
  return data[0].id
}

// ---------------------------------------------------------------------------
// Distribution builder
// ---------------------------------------------------------------------------

function buildDistributions(
  targetPlants: Array<{ id: string; code: string }>,
  volumesByCode: Map<string, number>,
  totalAmount: number
): DistributionTarget[] {
  const vols = targetPlants.map(p => ({
    plantId: p.id,
    plantCode: p.code,
    vol: volumesByCode.get(p.code) || 0
  }))
  const totalVol = vols.reduce((s, v) => s + v.vol, 0)

  if (totalVol === 0) {
    const n = vols.length
    return vols.map(v => ({
      plantId: v.plantId,
      plantCode: v.plantCode,
      percentage: 100 / n,
      amount: totalAmount / n,
      volumeM3: 0
    }))
  }

  return vols.map(v => {
    const pct = (v.vol / totalVol) * 100
    return {
      plantId: v.plantId,
      plantCode: v.plantCode,
      percentage: pct,
      amount: (totalAmount * pct) / 100,
      volumeM3: v.vol
    }
  })
}

// ---------------------------------------------------------------------------
// Insert one manual cost
// ---------------------------------------------------------------------------

async function insertManualCost(
  entry: {
    plantId?: string
    businessUnitId?: string
    category: string
    department: string
    expenseSubcategory: string
    description: string
    amount: number
    notes: string
    isCashPayment: boolean
    distributions?: DistributionTarget[]
  },
  adminId: string
) {
  const isDistributed = !!(entry.distributions && entry.distributions.length > 0)

  const { data: adj, error: adjErr } = await supabase
    .from('manual_financial_adjustments')
    .insert({
      business_unit_id: entry.businessUnitId || null,
      plant_id: entry.plantId || null,
      period_month: PERIOD_MONTH,
      category: entry.category,
      department: entry.department || null,
      expense_category: null,
      expense_subcategory: entry.expenseSubcategory || null,
      description: entry.description,
      amount: entry.amount,
      notes: entry.notes || null,
      is_cash_payment: entry.isCashPayment,
      is_distributed: isDistributed,
      distribution_method: isDistributed ? 'volume' : null,
      created_by: adminId,
      updated_by: adminId
    })
    .select()
    .single()

  if (adjErr) throw new Error(`Insert adjustment failed: ${adjErr.message}`)

  if (isDistributed && entry.distributions!.length > 0) {
    const distRows = entry.distributions!.map(d => ({
      adjustment_id: adj.id,
      plant_id: d.plantId,
      percentage: d.percentage,
      amount: d.amount,
      volume_m3: d.volumeM3 || null,
      created_by: adminId
    }))

    const { error: distErr } = await supabase
      .from('manual_financial_adjustment_distributions')
      .insert(distRows)

    if (distErr) {
      await supabase.from('manual_financial_adjustments').delete().eq('id', adj.id)
      throw new Error(`Insert distributions failed: ${distErr.message}`)
    }
  }

  return adj
}

// ---------------------------------------------------------------------------
// Parse IMPORTACIÓN sheet
// ---------------------------------------------------------------------------

async function parseSheet(): Promise<NominaRow[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(XLSX_PATH)

  const ws = wb.getWorksheet(SHEET_NAME)
  if (!ws) throw new Error(`Sheet "${SHEET_NAME}" not found`)

  const rows: NominaRow[] = []

  ws.eachRow((row, rowNum) => {
    if (rowNum <= 2) return // title + header

    const c = (i: number) => {
      const cell = row.getCell(i)
      const v = cell.value
      if (v === null || v === undefined) return ''
      if (typeof v === 'object' && 'result' in (v as any)) return String((v as any).result)
      return String(v).trim()
    }
    const n = (i: number) => {
      const cell = row.getCell(i)
      const v = cell.value
      if (v === null || v === undefined) return null
      if (typeof v === 'object' && 'result' in (v as any)) {
        const r = Number((v as any).result)
        return isNaN(r) ? null : r
      }
      const num = Number(v)
      return isNaN(num) ? null : num
    }

    const concept = c(2)
    const monto = n(4)

    // Skip empties, section headers, subtotals, totals
    if (!concept) return
    const cu = concept.toUpperCase()
    if (cu.startsWith('SUBTOTAL') || cu.startsWith('TOTAL') || cu.startsWith('SECCIÓN')) return
    if (cu.startsWith('HOJA DE')) return
    if (monto === null || monto === 0) return

    const planta = c(5)
    const bu = c(6)
    const alcance = c(10)

    // Section header rows: no code, no recognised alcance → skip
    const code = c(1)
    if (!code && alcance !== 'PLANTA' && alcance !== 'DISTRIBUIDO') return

    rows.push({
      rowNum,
      concept,
      ptu: n(3),
      amount: monto,
      planta,
      bu,
      dept: c(7),
      tipo: c(8),
      tipoPago: c(9),
      alcance,
      subcategoryDb: c(11),
      notas: c(12)
    })
  })

  return rows
}

// ---------------------------------------------------------------------------
// Resolve scope for a row
// ---------------------------------------------------------------------------

type ScopeResult =
  | { kind: 'plant'; plantId: string }
  | { kind: 'multi'; plantIds: string[] }
  | { kind: 'bu'; buId: string; plantIds: string[] }
  | { kind: 'company'; plantIds: string[] }

function resolveScope(
  row: NominaRow,
  plantMapping: Map<string, string>,
  buMapping: Map<string, string>,
  allPlants: Array<{ id: string; code: string; business_unit_id: string }>
): ScopeResult {
  const planta = row.planta.trim()
  const bu = row.bu.trim()

  // Single plant (any value that maps to a plant code)
  if (planta && !planta.includes('/') && !planta.toUpperCase().includes(' Y ')) {
    const plantId = plantMapping.get(planta) || plantMapping.get(planta.toLowerCase())
    if (plantId) return { kind: 'plant', plantId }
  }

  // Multiple plants: "4P Y 5", "4p y 5", "2/3"
  if (planta) {
    const pu = planta.toUpperCase()
    if (pu.includes('4P') && pu.includes('5')) {
      const p4p = plantMapping.get('4P')!
      const p5 = plantMapping.get('5')!
      return { kind: 'multi', plantIds: [p4p, p5] }
    }
    if (planta === '2/3') {
      const p2 = plantMapping.get('2')!
      const p3 = plantMapping.get('3')!
      return { kind: 'multi', plantIds: [p2, p3] }
    }
  }

  // Business unit
  if (bu) {
    // Normalise BU002 (TIJUANA) → BU002, BU001 (BAJIO) → BU001, BJ → BJ, etc.
    let buKey = bu
    const parenMatch = bu.match(/^(BU\d+)/)
    if (parenMatch) buKey = parenMatch[1]

    const buId = buMapping.get(buKey) || buMapping.get(buKey.toUpperCase())
    if (!buId) throw new Error(`BU not found: "${bu}"`)
    const buPlants = allPlants.filter(p => p.business_unit_id === buId)
    return { kind: 'bu', buId, plantIds: buPlants.map(p => p.id) }
  }

  // Whole company
  return { kind: 'company', plantIds: allPlants.map(p => p.id) }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🗓  Import May 2026 Nómina — ${DRY_RUN ? 'DRY RUN' : 'REAL IMPORT'}\n`)

  console.log('📂 Parsing Excel sheet...')
  const rows = await parseSheet()
  console.log(`   Parsed ${rows.length} data rows\n`)

  // Sanity check total
  const parsedTotal = rows.reduce((s, r) => s + r.amount, 0)
  console.log(`   Sum of amounts: $${parsedTotal.toFixed(2)}`)
  if (Math.abs(parsedTotal - 3537899.06) > 1) {
    console.warn(`⚠️  Expected $3,537,899.06 — difference: ${(parsedTotal - 3537899.06).toFixed(2)}`)
  } else {
    console.log('   ✅ Total matches expected $3,537,899.06\n')
  }

  console.log('🔍 Loading DB lookups...')
  const [plantMapping, buMapping, allPlants, volsByCode, adminId] = await Promise.all([
    getPlantMapping(),
    getBusinessUnitMapping(),
    getAllPlants(),
    getPlantVolumes(),
    getAdminProfileId()
  ])
  console.log(`   Plants: ${plantMapping.size} codes | BUs: ${buMapping.size} codes`)
  console.log(`   Volumes: ${volsByCode.size} plant codes with data`)
  console.log(`   Admin profile: ${adminId}\n`)

  // Build a P002 fallback id for Tijuana zero-volume override
  const p002Id = plantMapping.get('2')

  // Idempotency: delete existing May nomina rows before real import
  if (!DRY_RUN) {
    const { data: existing } = await supabase
      .from('manual_financial_adjustments')
      .select('id', { count: 'exact', head: false })
      .eq('period_month', PERIOD_MONTH)
      .eq('category', 'nomina')

    const existingCount = existing?.length || 0
    if (existingCount > 0) {
      console.log(`🗑  Deleting ${existingCount} existing May 2026 nómina rows...`)
      const { error } = await supabase
        .from('manual_financial_adjustments')
        .delete()
        .eq('period_month', PERIOD_MONTH)
        .eq('category', 'nomina')
      if (error) throw new Error(`Delete failed: ${error.message}`)
      console.log('   Done.\n')
    }
  }

  let successCount = 0
  let errorCount = 0
  const errors: Array<{ row: NominaRow; error: string }> = []

  for (const row of rows) {
    try {
      // --- Category / subcategory ---
      let category: string
      let expenseSubcategory: string

      if (row.tipo === 'EFECTIVO') {
        const classified = classifyCashConcept(row.concept)
        category = classified.category
        // Keep explicit subcategoryDb if not overridden by classifier
        expenseSubcategory =
          classified.expenseSubcategory || row.subcategoryDb || ''
      } else {
        // Formal payroll
        category = 'nomina'
        expenseSubcategory = row.subcategoryDb || ''
      }

      const isCash = row.tipo === 'EFECTIVO'

      // --- Scope ---
      const scope = resolveScope(row, plantMapping, buMapping, allPlants)

      // --- Build entry ---
      let entry: Parameters<typeof insertManualCost>[0]

      if (scope.kind === 'plant') {
        entry = {
          plantId: scope.plantId,
          category,
          department: row.dept,
          expenseSubcategory,
          description: row.concept,
          amount: row.amount,
          notes: row.notas,
          isCashPayment: isCash
        }
      } else {
        // Distributed: resolve plant objects for target ids
        let targetIds = scope.plantIds
        let buId: string | undefined

        if (scope.kind === 'bu') {
          buId = scope.buId
          // Tijuana BU with all-zero volume → assign to P002 only
          const allZero = targetIds.every(id => {
            const plant = allPlants.find(p => p.id === id)
            return !plant || (volsByCode.get(plant.code) || 0) === 0
          })
          if (allZero && p002Id && targetIds.includes(p002Id)) {
            targetIds = [p002Id]
          }
        }

        const targetPlants = targetIds
          .map(id => allPlants.find(p => p.id === id))
          .filter(Boolean) as Array<{ id: string; code: string }>

        const distributions = buildDistributions(targetPlants, volsByCode, row.amount)

        entry = {
          businessUnitId: buId,
          category,
          department: row.dept,
          expenseSubcategory,
          description: row.concept,
          amount: row.amount,
          notes: row.notas,
          isCashPayment: isCash,
          distributions
        }
      }

      // --- Dry-run: just print ---
      if (DRY_RUN) {
        const scopeLabel =
          scope.kind === 'plant'
            ? `plant:${allPlants.find(p => p.id === scope.plantId)?.code}`
            : scope.kind === 'multi'
              ? `multi:${scope.plantIds.map(id => allPlants.find(p => p.id === id)?.code).join('+')}`
              : scope.kind === 'bu'
                ? `bu:${row.bu}`
                : 'company'
        const catLabel = category === 'otros_indirectos' ? '[INDIRECT]' : '[NOMINA]'
        console.log(
          `Row ${String(row.rowNum).padStart(3)}: ${catLabel} $${row.amount.toFixed(2).padStart(12)} | ${scopeLabel.padEnd(22)} | ${row.concept.substring(0, 45)}`
        )
      } else {
        await insertManualCost(entry, adminId)
        console.log(
          `✅ Row ${row.rowNum}: ${row.concept.substring(0, 45)} → $${row.amount.toFixed(2)}`
        )
      }

      successCount++
    } catch (err: any) {
      errorCount++
      errors.push({ row, error: err.message })
      console.error(`❌ Row ${row.rowNum}: ${row.concept} → ${err.message}`)
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log(`📊 SUMMARY — ${DRY_RUN ? 'DRY RUN' : 'IMPORT'}`)
  console.log('='.repeat(70))
  console.log(`✅ Processed:  ${successCount}`)
  console.log(`❌ Errors:     ${errorCount}`)
  console.log(`   Total rows: ${rows.length}`)

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:')
    errors.forEach(({ row, error }) =>
      console.log(`   Row ${row.rowNum}: ${row.concept} → ${error}`)
    )
  }

  if (DRY_RUN) {
    console.log('\n💡 Re-run with --import to execute DB writes.')
  } else {
    console.log('\n✨ Import complete!')
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
