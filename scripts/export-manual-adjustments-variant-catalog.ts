/**
 * Read-only export: typography clusters, department distribution, and
 * stakeholder-facing semantic alias notes for manual_financial_adjustments.
 *
 * Usage:
 *   npx tsx scripts/export-manual-adjustments-variant-catalog.ts
 *
 * Output:
 *   scripts/output/manual-adjustments-variant-catalog.json
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
const OUT_FILE = path.join(OUT_DIR, 'manual-adjustments-variant-catalog.json')

function accentFold(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

interface Row {
  id: string
  period_month: string
  department: string | null
  expense_category: string | null
  expense_subcategory: string | null
  subcategory: string | null
  category: string
}

async function fetchRows(): Promise<Row[]> {
  const pageSize = 1000
  let from = 0
  const all: Row[] = []
  for (;;) {
    const { data, error } = await supabase
      .from('manual_financial_adjustments')
      .select(
        'id, period_month, department, expense_category, expense_subcategory, subcategory, category'
      )
      .gte('period_month', PERIOD_START)
      .lte('period_month', PERIOD_END)
      .order('period_month', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data?.length) break
    all.push(...(data as Row[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

function typographyGroups(
  rows: Row[],
  field: keyof Pick<Row, 'department' | 'expense_category' | 'expense_subcategory' | 'subcategory'>
) {
  const byFold = new Map<string, Map<string, string[]>>()
  for (const r of rows) {
    const raw = r[field]
    const display = (raw ?? '').trim()
    const fold = accentFold(raw) || '(empty)'
    if (!byFold.has(fold)) byFold.set(fold, new Map())
    const m = byFold.get(fold)!
    if (!m.has(display)) m.set(display, [])
    m.get(display)!.push(r.id)
  }
  const duplicates: {
    foldKey: string
    variants: { value: string; count: number; sampleIds: string[] }[]
    rowCount: number
  }[] = []

  for (const [foldKey, variantMap] of byFold) {
    if (variantMap.size <= 1) continue
    let rowCount = 0
    const variants = [...variantMap.entries()]
      .map(([value, ids]) => {
        rowCount += ids.length
        return { value, count: ids.length, sampleIds: ids.slice(0, 5) }
      })
      .sort((a, b) => b.count - a.count)
    duplicates.push({ foldKey, variants, rowCount })
  }
  duplicates.sort((a, b) => b.rowCount - a.rowCount)
  return duplicates
}

function departmentRollup(rows: Row[]) {
  const byDept = new Map<string, string[]>()
  for (const r of rows) {
    const k = r.department ?? '(null)'
    if (!byDept.has(k)) byDept.set(k, [])
    byDept.get(k)!.push(r.id)
  }
  return [...byDept.entries()]
    .map(([department, ids]) => ({
      department,
      count: ids.length,
      sampleIds: ids.slice(0, 5),
    }))
    .sort((a, b) => b.count - a.count)
}

async function main() {
  console.log('Fetching manual_financial_adjustments…')
  const rows = await fetchRows()
  console.log(`Loaded ${rows.length} rows`)

  const catalog = {
    generatedAt: new Date().toISOString(),
    periodMonthRange: { gte: PERIOD_START, lte: PERIOD_END },
    rowCount: rows.length,
    typographyAccentFoldDuplicates: {
      department: typographyGroups(rows, 'department'),
      expense_category: typographyGroups(rows, 'expense_category'),
      expense_subcategory: typographyGroups(rows, 'expense_subcategory'),
      subcategory: typographyGroups(rows, 'subcategory'),
    },
    departmentDistribution: departmentRollup(rows),
    categoryDistribution: (() => {
      const m = new Map<string, number>()
      for (const r of rows) {
        m.set(r.category, (m.get(r.category) ?? 0) + 1)
      }
      return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]))
    })(),
    canonicalMapApproved: {
      typography: {
        PRODUCCIÓN: 'Replaces ASCII PRODUCCION in department and in compound labels.',
        ADMINISTRACIÓN: 'Replaces ASCII ADMINISTRACION.',
        NÓMINA: 'Replaces ASCII NOMINA in subcategory / label strings.',
        appliedLiveBackfill:
          'archive/legacy-db-migrations/sql/20260416_manual_adjustments_typography_backfill_oct2025_mar2026.sql',
      },
      semanticPendingStakeholderDecision: [
        {
          cluster: 'RH_vs_RECURSOS_HUMANOS',
          note: 'RH (abbrev.) vs RECURSOS HUMANOS — decide single canonical department label.',
        },
        {
          cluster: 'MTTO_vs_MANTENIMIENTO',
          note: 'MTTO vs MANTENIMIENTO — likely same; confirm before merging.',
        },
        {
          cluster: 'GERENCIA_VENTAS_POR_DEFINIR',
          note: 'Review whether GERENCIA, VENTAS, POR DEFINIR stay distinct or roll into another department.',
        },
      ],
    },
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(catalog, null, 2), 'utf-8')
  console.log(`Wrote ${OUT_FILE}`)

  const dupTotal =
    catalog.typographyAccentFoldDuplicates.department.length +
    catalog.typographyAccentFoldDuplicates.expense_category.length +
    catalog.typographyAccentFoldDuplicates.expense_subcategory.length +
    catalog.typographyAccentFoldDuplicates.subcategory.length
  console.log(`Accent-fold duplicate groups (should be 0): ${dupTotal}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
