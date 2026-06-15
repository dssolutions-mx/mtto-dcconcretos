/**
 * Import May 2026 indirect expenses from GASTOS_MAYO2026_CLASIFICADOS.csv
 *
 * Mirrors scripts/import-april-expenses.ts (same distribution logic + classifier
 * output contract), with three differences:
 *   - PERIOD_MONTH = '2026-05-01'
 *   - Dry-run by default (pass --import to write to the DB)
 *   - Scoped idempotency: only deletes May otros_indirectos rows whose
 *     (description, amount) match this batch, so the 4 nómina "COMIDA" rows
 *     already present for May are never touched.
 *
 * Usage:
 *   npx tsx scripts/import-may-expenses.ts            # dry-run (no DB writes)
 *   npx tsx scripts/import-may-expenses.ts --import   # real import
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

import { normalizeManualAdjustmentSpanishLabel } from '../lib/reports/manual-adjustment-typography'

require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const COTIZADOR_SUPABASE_URL = process.env.COTIZADOR_SUPABASE_URL!
const COTIZADOR_SUPABASE_SERVICE_ROLE_KEY = process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables')
}
if (!COTIZADOR_SUPABASE_URL || !COTIZADOR_SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Cotizador Supabase environment variables')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})
const cotizadorSupabase = createClient(
  COTIZADOR_SUPABASE_URL,
  COTIZADOR_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

interface ExpenseRow {
  CONCEPTO: string
  VALOR: string
  PLANTA_O_BU: string
  DEPARTAMENTO: string
  CATEGORIA_GASTO: string
  SUBCATEGORIA_GASTO: string
  TIPO_ASIGNACION: string
  IS_CASH: string
  NOTAS: string
}

const PERIOD_MONTH = '2026-05-01'
const CSV_PATH = 'D:\\Downloads\\GASTOS_MAYO2026_CLASIFICADOS.csv'
const DRY_RUN = !process.argv.includes('--import')

function parseIsCash(raw: string | undefined): boolean {
  const t = (raw || '').trim().toLowerCase()
  return t === 'true' || t === '1' || t === 'yes'
}

async function getPlantMapping(): Promise<Map<string, string>> {
  const { data: plants, error } = await supabase
    .from('plants')
    .select('id, code, name')
    .eq('status', 'active')
  if (error) throw error

  const mapping = new Map<string, string>()
  plants?.forEach(plant => {
    const codeMatch = plant.code.match(/P0?(\d+)/i)
    if (codeMatch) {
      const numInt = parseInt(codeMatch[1], 10)
      mapping.set(String(numInt), plant.id)
      mapping.set(`P${numInt}`, plant.id)
      mapping.set(`p${numInt}`, plant.id)
      mapping.set(`P00${numInt}`, plant.id)
      mapping.set(`p00${numInt}`, plant.id)
    }
    if (plant.code === 'P004P' || plant.code === 'p004p') {
      mapping.set('P004P', plant.id)
      mapping.set('p004p', plant.id)
    }
    mapping.set(plant.code, plant.id)
    mapping.set(plant.code.toLowerCase(), plant.id)
  })
  // P4 → P004P (Pitahaya), matching April otros_indirectos convention. The generic
  // /P0?(\d+)/ loop maps 'P4'/'4' to whichever plant row is iterated last; pin it.
  const p004p = plants?.find(p => p.code === 'P004P')
  if (p004p) {
    mapping.set('4', p004p.id)
    mapping.set('P4', p004p.id)
    mapping.set('p4', p004p.id)
  }
  return mapping
}

async function getBusinessUnitMapping(): Promise<Map<string, string>> {
  const { data: businessUnits, error } = await supabase
    .from('business_units')
    .select('id, code, name')
  if (error) throw error

  const mapping = new Map<string, string>()
  businessUnits?.forEach(bu => {
    const nameLower = bu.name.toLowerCase()
    if (nameLower.includes('tijuana')) {
      mapping.set('tj', bu.id)
      mapping.set('TJ', bu.id)
    }
    if (
      nameLower.includes('bajio') ||
      nameLower.includes('baja california') ||
      nameLower.includes('baja')
    ) {
      mapping.set('bj', bu.id)
      mapping.set('BJ', bu.id)
    }
    if (bu.code) {
      mapping.set(bu.code.toLowerCase(), bu.id)
      mapping.set(bu.code, bu.id)
    }
    mapping.set(bu.name.toLowerCase(), bu.id)
  })
  return mapping
}

async function getPlantVolumes(): Promise<Map<string, number>> {
  const { data: viewData, error } = await cotizadorSupabase
    .from('vw_plant_financial_analysis_unified')
    .select('plant_code, volumen_concreto_m3')
    .eq('period_start', PERIOD_MONTH)

  if (error) {
    console.warn('Warning: Could not fetch volumes from cotizador:', error.message)
    return new Map()
  }

  const volumes = new Map<string, number>()
  viewData?.forEach((row: any) => {
    const code = row.plant_code
    const volume = Number(row.volumen_concreto_m3 || 0)
    if (code) volumes.set(code, (volumes.get(code) || 0) + volume)
  })
  return volumes
}

async function getPlantVolumesByPlantId(plantIds: string[]): Promise<Map<string, number>> {
  const { data: plants } = await supabase.from('plants').select('id, code').in('id', plantIds)
  if (!plants) return new Map()

  const plantIdToCode = new Map<string, string>()
  plants.forEach(p => plantIdToCode.set(p.id, p.code))

  const volumesByCode = await getPlantVolumes()
  const volumesByPlantId = new Map<string, number>()
  plantIdToCode.forEach((code, plantId) => {
    volumesByPlantId.set(plantId, volumesByCode.get(code) || 0)
  })
  return volumesByPlantId
}

async function getAdminProfileId(): Promise<string> {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .order('created_at', { ascending: true })
  if (error || !profiles || profiles.length === 0) {
    throw new Error('No profile found for import - need at least one user profile')
  }
  return profiles[0].id
}

async function createManualCost(
  entry: {
    plantId?: string
    businessUnitId?: string
    department: string
    expenseCategory: string
    expenseSubcategory: string
    description: string
    amount: number
    notes?: string
    isCashPayment?: boolean
    distributionMethod?: 'volume'
    distributions?: Array<{ plantId: string; percentage: number; amount: number; volumeM3?: number }>
  },
  adminProfileId: string
) {
  const adjustmentData: any = {
    business_unit_id: entry.businessUnitId || null,
    plant_id: entry.plantId || null,
    period_month: PERIOD_MONTH,
    category: 'otros_indirectos',
    department:
      (normalizeManualAdjustmentSpanishLabel(entry.department) ?? entry.department) || null,
    expense_category:
      normalizeManualAdjustmentSpanishLabel(entry.expenseCategory) ?? entry.expenseCategory,
    expense_subcategory:
      (normalizeManualAdjustmentSpanishLabel(entry.expenseSubcategory) ??
        entry.expenseSubcategory) || null,
    description: entry.description,
    amount: entry.amount,
    notes: entry.notes || null,
    is_cash_payment: Boolean(entry.isCashPayment),
    is_distributed: !!(entry.distributions && entry.distributions.length > 0),
    distribution_method: entry.distributionMethod || null,
    created_by: adminProfileId,
    updated_by: adminProfileId
  }

  const { data: adjustment, error: adjError } = await supabase
    .from('manual_financial_adjustments')
    .insert(adjustmentData)
    .select()
    .single()
  if (adjError) throw new Error(`Failed to create adjustment: ${adjError.message}`)

  if (entry.distributions && entry.distributions.length > 0) {
    const distributionRecords = entry.distributions.map(dist => ({
      adjustment_id: adjustment.id,
      plant_id: dist.plantId,
      percentage: dist.percentage,
      amount: dist.amount,
      volume_m3: dist.volumeM3 || null,
      created_by: adminProfileId
    }))
    const { error: distError } = await supabase
      .from('manual_financial_adjustment_distributions')
      .insert(distributionRecords)
    if (distError) {
      await supabase.from('manual_financial_adjustments').delete().eq('id', adjustment.id)
      throw new Error(`Failed to create distributions: ${distError.message}`)
    }
  }
  return adjustment
}

/** Parses classified CSV including quoted CONCEPTO / SUBCATEGORIA and IS_CASH column */
function parseCSVLine(line: string): string[] {
  const parts: string[] = []
  let i = 0
  const parseField = (): string => {
    if (i >= line.length) return ''
    if (line[i] === '"') {
      i++
      let field = ''
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            field += '"'
            i += 2
          } else {
            i++
            if (i < line.length && line[i] === ',') i++
            break
          }
        } else {
          field += line[i]
          i++
        }
      }
      return field.trim()
    } else {
      let field = ''
      while (i < line.length && line[i] !== ',') {
        field += line[i]
        i++
      }
      if (i < line.length && line[i] === ',') i++
      return field.trim()
    }
  }
  while (parts.length < 9 && i < line.length) parts.push(parseField())
  return parts
}

const batchKey = (desc: string, amount: number) => `${desc.trim()}__${amount.toFixed(2)}`

async function main() {
  console.log(`\n🗓  Import May 2026 Indirect Expenses — ${DRY_RUN ? 'DRY RUN' : 'REAL IMPORT'}\n`)

  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
  const lines = csvContent.split('\n').filter(line => line.trim())
  const headers = parseCSVLine(lines[0])
  const records: ExpenseRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const record: any = {}
    headers.forEach((header, idx) => (record[header] = values[idx] || ''))
    records.push(record as ExpenseRow)
  }
  console.log(`📊 Loaded ${records.length} expense records`)

  const [plantMapping, buMapping, volumesByCode, adminProfileId] = await Promise.all([
    getPlantMapping(),
    getBusinessUnitMapping(),
    getPlantVolumes(),
    getAdminProfileId()
  ])
  console.log(
    `   Plants: ${plantMapping.size} | BUs: ${buMapping.size} | Volumes (May): ${volumesByCode.size} | Admin: ${adminProfileId}`
  )

  const { data: allPlants } = await supabase
    .from('plants')
    .select('id, code, business_unit_id')
    .eq('status', 'active')
  if (!allPlants) throw new Error('Could not fetch plants')

  // --- Scoped idempotency: remove prior runs of THIS batch only ---
  if (!DRY_RUN) {
    const batchSet = new Set(
      records.map(r => batchKey(r.CONCEPTO, parseFloat(r.VALOR.replace(/,/g, ''))))
    )
    const { data: existing } = await supabase
      .from('manual_financial_adjustments')
      .select('id, description, amount')
      .eq('period_month', PERIOD_MONTH)
      .eq('category', 'otros_indirectos')
    const toDelete = (existing || []).filter(e =>
      batchSet.has(batchKey(e.description || '', Number(e.amount)))
    )
    if (toDelete.length > 0) {
      console.log(`🗑  Removing ${toDelete.length} rows from a prior run of this batch...`)
      const { error } = await supabase
        .from('manual_financial_adjustments')
        .delete()
        .in('id', toDelete.map(e => e.id))
      if (error) throw new Error(`Idempotency delete failed: ${error.message}`)
    }
  }

  let successCount = 0
  let errorCount = 0
  const errors: Array<{ row: ExpenseRow; error: string }> = []
  const catTotals = new Map<string, number>()

  for (let i = 0; i < records.length; i++) {
    const row = records[i]
    const amount = parseFloat(row.VALOR.replace(/,/g, ''))
    const isCash = parseIsCash(row.IS_CASH)
    if (isNaN(amount)) {
      errorCount++
      errors.push({ row, error: 'Invalid amount' })
      continue
    }

    const baseEntry = {
      department: row.DEPARTAMENTO,
      expenseCategory: row.CATEGORIA_GASTO,
      expenseSubcategory: row.SUBCATEGORIA_GASTO,
      description: row.CONCEPTO,
      amount,
      notes: row.NOTAS || undefined,
      isCashPayment: isCash
    }

    try {
      let scopeLabel = ''
      let entry: Parameters<typeof createManualCost>[0]

      if (row.TIPO_ASIGNACION === 'DIRECTO') {
        const plantId = plantMapping.get(row.PLANTA_O_BU)
        if (!plantId) throw new Error(`Plant not found: ${row.PLANTA_O_BU}`)
        entry = { ...baseEntry, plantId }
        scopeLabel = `plant:${row.PLANTA_O_BU}`
      } else if (row.TIPO_ASIGNACION === 'DISTRIBUIR_VOLUMEN') {
        const plantIds = allPlants.map(p => p.id)
        const volsByPlantId = await getPlantVolumesByPlantId(plantIds)
        const totalVolume = Array.from(volsByPlantId.values()).reduce((s, v) => s + v, 0)
        const distributions = allPlants.map(p => {
          if (totalVolume === 0) {
            return { plantId: p.id, percentage: 100 / allPlants.length, amount: amount / allPlants.length, volumeM3: 0 }
          }
          const volume = volsByPlantId.get(p.id) || 0
          const percentage = (volume / totalVolume) * 100
          return { plantId: p.id, percentage, amount: (amount * percentage) / 100, volumeM3: volume }
        })
        entry = { ...baseEntry, distributionMethod: 'volume', distributions }
        scopeLabel = `volume:${allPlants.length}p`
      } else {
        throw new Error(`Unknown assignment type: ${row.TIPO_ASIGNACION}`)
      }

      catTotals.set(row.CATEGORIA_GASTO, (catTotals.get(row.CATEGORIA_GASTO) || 0) + amount)

      if (DRY_RUN) {
        console.log(
          `Row ${String(i + 1).padStart(3)}: $${amount.toFixed(2).padStart(11)} | cat ${row.CATEGORIA_GASTO.padStart(2)} | ${scopeLabel.padEnd(12)} | ${isCash ? 'cash ' : '     '}| ${row.CONCEPTO.substring(0, 42)}`
        )
      } else {
        await createManualCost(entry, adminProfileId)
        console.log(`✅ ${i + 1}/${records.length}: ${row.CONCEPTO.substring(0, 45)} → $${amount.toFixed(2)}`)
      }
      successCount++
    } catch (error: any) {
      errorCount++
      errors.push({ row, error: error.message })
      console.error(`❌ ${i + 1}/${records.length}: ${row.CONCEPTO} → ERROR: ${error.message}`)
    }
  }

  const grand = Array.from(catTotals.values()).reduce((s, v) => s + v, 0)
  console.log('\n' + '='.repeat(64))
  console.log(`📊 SUMMARY — ${DRY_RUN ? 'DRY RUN' : 'IMPORT'}`)
  console.log('='.repeat(64))
  console.log(`✅ Processed: ${successCount}   ❌ Errors: ${errorCount}   Rows: ${records.length}`)
  console.log(`💰 Total amount: $${grand.toFixed(2)}`)
  if (errors.length > 0) {
    console.log('\n❌ ERRORS:')
    errors.forEach(({ row, error }) => console.log(`   - ${row.CONCEPTO}: ${error}`))
  }
  if (DRY_RUN) console.log('\n💡 Re-run with --import to execute DB writes.')
  else console.log('\n✨ Import complete!')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
