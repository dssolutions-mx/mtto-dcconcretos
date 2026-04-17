/**
 * READ-ONLY analysis of manual_financial_adjustments for typography duplicates
 * and semantic-drift heuristics (human review; no DB writes).
 *
 * Period: period_month from 2025-10-01 through 2026-03-31 inclusive.
 *
 * Usage:
 *   npx tsx scripts/analyze-manual-adjustments-semantic-drift.ts
 *
 * Output:
 *   Console summary + scripts/output/semantic-drift-manual-adjustments.json
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const PERIOD_START = '2025-10-01'
const PERIOD_END = '2026-03-31'

const OUT_DIR = path.join(__dirname, 'output')
const OUT_FILE = path.join(OUT_DIR, 'semantic-drift-manual-adjustments.json')

/** Accent-fold + lower (same approach as checklist normalizeEquipmentCategory). */
function accentFold(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function normalizeDescription(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function levenshtein(a: string, b: string): number {
  if (a.length > b.length) return levenshtein(b, a)
  const m = a.length
  const n = b.length
  if (m === 0) return n
  let prev = new Array<number>(n + 1)
  let cur = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[n]
}

function amountsClose(a: number, b: number): boolean {
  const rel = 0.02 * Math.max(Math.abs(a), Math.abs(b))
  return Math.abs(a - b) <= rel + 0.01
}

function descriptionsSimilar(a: string, b: string): boolean {
  if (!a || !b || a === b) return false
  const minLen = Math.min(a.length, b.length)
  if (minLen < 5) return false
  if (levenshtein(a, b) <= 2) return true
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  if (longer.startsWith(shorter) && longer.length - shorter.length <= 6) return true
  return false
}

interface AdjustmentRow {
  id: string
  period_month: string
  plant_id: string | null
  amount: number
  department: string | null
  expense_category: string | null
  expense_subcategory: string | null
  subcategory: string | null
  description: string | null
}

async function fetchAdjustments(): Promise<AdjustmentRow[]> {
  const pageSize = 1000
  let from = 0
  const all: AdjustmentRow[] = []
  for (;;) {
    const { data, error } = await supabase
      .from('manual_financial_adjustments')
      .select(
        'id, period_month, plant_id, amount, department, expense_category, expense_subcategory, subcategory, description'
      )
      .gte('period_month', PERIOD_START)
      .lte('period_month', PERIOD_END)
      .order('period_month', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data?.length) break
    all.push(...(data as AdjustmentRow[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

function typographyDuplicates(
  rows: AdjustmentRow[],
  field: keyof Pick<
    AdjustmentRow,
    'department' | 'expense_category' | 'expense_subcategory' | 'subcategory'
  >
) {
  const byFold = new Map<string, Set<string>>()
  for (const r of rows) {
    const raw = r[field]
    const display = (raw ?? '').trim()
    const fold = accentFold(raw)
    const key = fold || '(empty)'
    if (!byFold.has(key)) byFold.set(key, new Set())
    byFold.get(key)!.add(display || '(empty)')
  }
  const groups: { foldKey: string; variants: string[]; rowCount: number }[] = []
  for (const [foldKey, variants] of byFold) {
    if (variants.size <= 1) continue
    const rowCount = rows.filter((r) => (accentFold(r[field]) || '(empty)') === foldKey).length
    groups.push({ foldKey, variants: [...variants].sort(), rowCount })
  }
  groups.sort((a, b) => b.rowCount - a.rowCount)
  return { field, duplicateFoldKeys: groups.length, groups }
}

function departmentAliasCounts(rows: AdjustmentRow[]) {
  const foldDept = (r: AdjustmentRow) => accentFold(r.department)

  let rhAbbrev = 0
  let rhFull = 0
  let mttoAbbrev = 0
  let mttoFull = 0

  const rhAbbrevRe = /^(rh|rrhh|r\.h\.?|r\.h|rec\.hum\.?)$/
  for (const r of rows) {
    const f = foldDept(r)
    if (!f) continue
    if (rhAbbrevRe.test(f) || f === 'r h') rhAbbrev += 1
    if (f.includes('recurso') && f.includes('humano')) rhFull += 1
    if (f === 'mtto' || f === 'mttos' || /^mant\.?$/.test(f)) mttoAbbrev += 1
    if (f.includes('mantenimiento')) mttoFull += 1
  }

  return { rhAbbrev, rhFull, mttoAbbrev, mttoFull }
}

function exactDescriptionCrossMonthConflicts(rows: AdjustmentRow[]) {
  const byDesc = new Map<
    string,
    { months: Set<string>; departments: Set<string>; categories: Set<string>; sampleIds: string[] }
  >()

  for (const r of rows) {
    const nd = normalizeDescription(r.description)
    if (!nd) continue
    if (!byDesc.has(nd)) {
      byDesc.set(nd, {
        months: new Set(),
        departments: new Set(),
        categories: new Set(),
        sampleIds: [],
      })
    }
    const g = byDesc.get(nd)!
    g.months.add(r.period_month)
    if (r.department != null && String(r.department).trim()) {
      g.departments.add(String(r.department).trim())
    } else {
      g.departments.add('(empty)')
    }
    if (r.expense_category != null && String(r.expense_category).trim()) {
      g.categories.add(String(r.expense_category).trim())
    } else {
      g.categories.add('(empty)')
    }
    if (g.sampleIds.length < 8) g.sampleIds.push(r.id)
  }

  const conflicts: {
    normalizedDescription: string
    months: string[]
    departments: string[]
    expenseCategories: string[]
    sampleIds: string[]
  }[] = []

  for (const [normalizedDescription, g] of byDesc) {
    if (g.months.size < 2) continue
    const deptConflict = g.departments.size > 1
    const catConflict = g.categories.size > 1
    if (!deptConflict && !catConflict) continue
    conflicts.push({
      normalizedDescription,
      months: [...g.months].sort(),
      departments: [...g.departments].sort(),
      expenseCategories: [...g.categories].sort(),
      sampleIds: g.sampleIds,
    })
  }
  conflicts.sort((a, b) => b.months.length - a.months.length)
  return conflicts
}

function similarDescriptionPairs(rows: AdjustmentRow[]) {
  type Pair = {
    idA: string
    idB: string
    periodMonthA: string
    periodMonthB: string
    plantId: string
    amountA: number
    amountB: number
    descriptionA: string
    descriptionB: string
    normalizedA: string
    normalizedB: string
    reason: 'levenshtein' | 'prefix'
  }
  const pairs: Pair[] = []
  const byPlant = new Map<string, AdjustmentRow[]>()
  for (const r of rows) {
    if (!r.plant_id) continue
    const nd = normalizeDescription(r.description)
    if (nd.length < 5) continue
    if (!byPlant.has(r.plant_id)) byPlant.set(r.plant_id, [])
    byPlant.get(r.plant_id)!.push(r)
  }

  for (const [, list] of byPlant) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        if (!amountsClose(a.amount, b.amount)) continue
        const na = normalizeDescription(a.description)
        const nb = normalizeDescription(b.description)
        if (na === nb) continue
        const lev = levenshtein(na, nb)
        const minLen = Math.min(na.length, nb.length)
        const isLev = lev <= 2 && minLen >= 6
        const isPrefix =
          minLen >= 5 &&
          (na.length <= nb.length
            ? nb.startsWith(na) && nb.length - na.length <= 6
            : na.startsWith(nb) && na.length - nb.length <= 6)
        if (!isLev && !isPrefix) continue
        pairs.push({
          idA: a.id,
          idB: b.id,
          periodMonthA: a.period_month,
          periodMonthB: b.period_month,
          plantId: a.plant_id!,
          amountA: a.amount,
          amountB: b.amount,
          descriptionA: (a.description ?? '').trim(),
          descriptionB: (b.description ?? '').trim(),
          normalizedA: na,
          normalizedB: nb,
          reason: isLev ? 'levenshtein' : 'prefix',
        })
      }
    }
  }
  return pairs
}

async function main() {
  console.log('\n' + '='.repeat(72))
  console.log('Manual adjustments: typography + semantic drift (read-only)')
  console.log('='.repeat(72))
  console.log(`Period: ${PERIOD_START} .. ${PERIOD_END} (period_month)`)

  const rows = await fetchAdjustments()
  console.log(`Rows loaded: ${rows.length}`)

  const typography = {
    department: typographyDuplicates(rows, 'department'),
    expense_category: typographyDuplicates(rows, 'expense_category'),
    expense_subcategory: typographyDuplicates(rows, 'expense_subcategory'),
    subcategory: typographyDuplicates(rows, 'subcategory'),
  }

  const alias = departmentAliasCounts(rows)
  const exactConflicts = exactDescriptionCrossMonthConflicts(rows)
  const similarPairs = similarDescriptionPairs(rows)

  const report = {
    generatedAt: new Date().toISOString(),
    period: { start: PERIOD_START, end: PERIOD_END },
    rowCount: rows.length,
    typography,
    departmentAliasClusters: alias,
    semanticDrift: {
      exactNormalizedDescriptionCrossMonth: exactConflicts,
      similarDescriptionSamePlantSimilarAmount: similarPairs,
    },
  }

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2), 'utf8')

  console.log('\n--- Typography (accent-fold duplicate spellings) ---')
  for (const k of ['department', 'expense_category', 'expense_subcategory', 'subcategory'] as const) {
    const t = typography[k]
    console.log(`  ${t.field}: ${t.duplicateFoldKeys} fold-keys with multiple raw variants`)
  }

  console.log('\n--- Department alias clusters (counts may overlap) ---')
  console.log(`  RH-style abbrev (rh, rrhh, …): ${alias.rhAbbrev}`)
  console.log(`  Recursos humanos phrasing:     ${alias.rhFull}`)
  console.log(`  MTTO / mant. abbrev:           ${alias.mttoAbbrev}`)
  console.log(`  Mantenimiento phrasing:       ${alias.mttoFull}`)

  console.log('\n--- Semantic drift (heuristic; review only) ---')
  console.log(`  Exact norm. description, ≥2 months, dept or category differs: ${exactConflicts.length}`)
  console.log(`  Similar description + same plant + ~same amount:             ${similarPairs.length}`)

  console.log(`\nWrote: ${OUT_FILE}`)
  console.log('='.repeat(72) + '\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
