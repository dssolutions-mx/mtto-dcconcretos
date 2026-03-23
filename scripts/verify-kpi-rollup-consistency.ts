/**
 * Compare live ingresos-gastos KPI compute vs ingresos_gastos_kpi_plant_month snapshots.
 *
 * Verifies every stored rollup row: for each (period_month, plant_id), runs full compute
 * with that plantId (bypass rollup read) and compares to DB payload — same as refresh,
 * including empty placeholder rows when the global report would filter the plant out.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/verify-kpi-rollup-consistency.ts [YYYY-MM]
 *   npx tsx --env-file=.env.local scripts/verify-kpi-rollup-consistency.ts --from 2025-09
 *
 * Optional: INTERNAL_REQUEST_HOST=localhost:3000 (with `next dev`) for gerencial parity.
 * Optional: VERIFY_KPI_ROLLUP_FROM=2025-09 (same as --from when no positional month).
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase-types'
import { runIngresosGastosPost } from '@/lib/reports/ingresos-gastos-compute'
import {
  emptyCostOnlyPlantRow,
  monthStringToPeriodDate,
  plantRowHasReportableData,
  type KpiRollupPlant,
} from '@/lib/reports/ingresos-gastos-kpi-rollup'

const EPS = 0.02

const NUMERIC_KEYS = [
  'volumen_concreto',
  'ventas_total',
  'diesel_total',
  'diesel_unitario',
  'diesel_pct',
  'mantto_total',
  'mantto_unitario',
  'mantto_pct',
  'nomina_total',
  'otros_indirectos_total',
  'total_costo_op',
  'total_costo_op_pct',
  'ebitda',
  'ebitda_pct',
  'costo_mp_total',
  'spread_unitario',
  'ingresos_bombeo_total',
] as const

const ID_KEYS = ['plant_id', 'plant_code', 'plant_name'] as const

function num(x: unknown): number {
  return Number(x ?? 0)
}

function strNorm(v: unknown): string {
  return v == null ? '' : String(v)
}

function periodDateToMonthString(periodDate: string): string {
  return periodDate.slice(0, 7)
}

function compareExpectedToRollup(
  plantId: string,
  expected: Record<string, unknown>,
  rollupPayload: Record<string, unknown>
): number {
  let mismatches = 0
  for (const k of ID_KEYS) {
    if (strNorm(expected[k]) !== strNorm(rollupPayload[k])) {
      mismatches++
      console.warn('Field mismatch', plantId, k, { expected: expected[k], rollup: rollupPayload[k] })
    }
  }
  if (strNorm(expected.business_unit_id) !== strNorm(rollupPayload.business_unit_id)) {
    mismatches++
    console.warn('Field mismatch', plantId, 'business_unit_id', {
      expected: expected.business_unit_id,
      rollup: rollupPayload.business_unit_id,
    })
  }
  for (const k of NUMERIC_KEYS) {
    const dExp = num(expected[k])
    const dRoll = num(rollupPayload[k])
    if (Math.abs(dExp - dRoll) > EPS) {
      mismatches++
      console.warn('Numeric mismatch', plantId, k, { expected: dExp, rollup: dRoll })
    }
  }
  return mismatches
}

async function verifyMonthExhaustive(params: {
  admin: ReturnType<typeof createClient<Database>>
  month: string
  requestHost: string | null
  plantById: Map<string, KpiRollupPlant>
}): Promise<{ rows: number; mismatches: number; errors: number }> {
  const { admin, month, requestHost, plantById } = params
  const periodDate = monthStringToPeriodDate(month)

  const { data: rollupRows, error: rollErr } = await admin
    .from('ingresos_gastos_kpi_plant_month')
    .select('plant_id, payload')
    .eq('period_month', periodDate)

  if (rollErr) {
    console.error('Rollup query error:', month, rollErr.message)
    return { rows: 0, mismatches: 0, errors: 1 }
  }

  const rows = rollupRows || []
  let mismatches = 0
  let errors = 0

  if (rows.length === 0) {
    console.warn(month, '| no rollup rows in DB for this month (run refresh-ingresos-kpi-rollup-once or internal refresh).')
    return { rows: 0, mismatches: 0, errors: 0 }
  }

  for (const r of rows) {
    const id = r.plant_id
    const meta = plantById.get(id)
    if (!meta) {
      console.error('Rollup row for unknown plant_id (not in plants table):', id, month)
      errors++
      continue
    }
    if (typeof r.payload !== 'object' || r.payload === null || Array.isArray(r.payload)) {
      console.error('Invalid payload for', id, month)
      errors++
      continue
    }
    const rollupPayload = r.payload as Record<string, unknown>

    const full = await runIngresosGastosPost({
      body: {
        month,
        businessUnitId: null,
        plantId: id,
        skipPreviousMonth: true,
      },
      supabase: admin,
      requestHost,
      bypassKpiRollupRead: true,
    })

    if ((full as { error?: string }).error) {
      console.error('Full compute error', month, id, (full as { error: string }).error)
      errors++
      continue
    }

    const plantsOut = ((full as { plants?: unknown[] }).plants || []) as Record<string, unknown>[]
    if (plantsOut.length > 1) {
      console.error('Unexpected multiple plants for plantId filter', month, id, plantsOut.length)
      errors++
      continue
    }

    let expected: Record<string, unknown>
    if (plantsOut.length === 1) {
      expected = plantsOut[0]
      if (!plantRowHasReportableData(expected)) {
        console.warn(
          'Per-plant compute returned row without reportable data (unexpected)',
          month,
          id,
          meta.code
        )
      }
    } else {
      expected = emptyCostOnlyPlantRow(meta) as Record<string, unknown>
      if (plantRowHasReportableData(rollupPayload)) {
        console.error(
          'Rollup has reportable data but per-plant full compute returned no row',
          month,
          id,
          meta.code
        )
        errors++
        continue
      }
    }

    mismatches += compareExpectedToRollup(id, expected, rollupPayload)
  }

  return { rows: rows.length, mismatches, errors }
}

function parseArgs(argv: string[]): {
  fromMonth: string | null
  /** If set, only verify this month (still exhaustive per plant). */
  onlyMonth: string | null
} {
  const monthTokens = argv.filter((a) => /^\d{4}-\d{2}$/.test(a))
  const fromIdx = argv.indexOf('--from')
  const fromFlag =
    fromIdx >= 0 && argv[fromIdx + 1] && /^\d{4}-\d{2}$/.test(argv[fromIdx + 1])
      ? argv[fromIdx + 1]
      : null

  const envFrom = process.env.VERIFY_KPI_ROLLUP_FROM?.trim()
  const fromEnv = envFrom && /^\d{4}-\d{2}$/.test(envFrom) ? envFrom : null

  const fromMonth = fromFlag || fromEnv

  let onlyMonth: string | null = null
  if (fromMonth) {
    const other = monthTokens.find((m) => m !== fromMonth)
    if (other) onlyMonth = other
  } else if (monthTokens.length >= 1) {
    onlyMonth = monthTokens[0]
  }

  if (!fromMonth && !onlyMonth) {
    const now = new Date()
    onlyMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  return { fromMonth, onlyMonth }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient<Database>(url, key, { auth: { persistSession: false } })

  const { data: allPlants, error: plantsError } = await admin
    .from('plants')
    .select('id, name, code, business_unit_id')
    .order('name')

  if (plantsError || !allPlants?.length) {
    console.error('Plants:', plantsError?.message ?? 'empty')
    process.exit(1)
  }

  const plantById = new Map<string, KpiRollupPlant>()
  for (const p of allPlants as KpiRollupPlant[]) {
    plantById.set(p.id, p)
  }

  const requestHost =
    process.env.INTERNAL_REQUEST_HOST?.trim() ||
    process.env.INGRESOS_KPI_INTERNAL_HOST?.trim() ||
    null

  const { fromMonth, onlyMonth } = parseArgs(process.argv.slice(2))

  if (requestHost) {
    console.log('requestHost:', requestHost)
  }

  let monthsToRun: string[]

  if (fromMonth) {
    const from = monthStringToPeriodDate(fromMonth)
    const { data: periodRows, error: pErr } = await admin
      .from('ingresos_gastos_kpi_plant_month')
      .select('period_month')
      .gte('period_month', from)

    if (pErr) {
      console.error('Failed to list rollup months:', pErr.message)
      process.exit(1)
    }

    const unique = [...new Set((periodRows || []).map((r) => r.period_month as string))].sort()
    monthsToRun = unique.map(periodDateToMonthString)

    if (onlyMonth) {
      monthsToRun = monthsToRun.filter((m) => m === onlyMonth)
      if (monthsToRun.length === 0) {
        console.warn('No rollup rows for', onlyMonth, 'since', fromMonth, '— verifying that month anyway.')
        monthsToRun = [onlyMonth]
      }
    }

    console.log(
      'Exhaustive verify from',
      fromMonth,
      onlyMonth ? `(filter ${onlyMonth})` : '',
      '| months:',
      monthsToRun.length,
      monthsToRun.join(', ')
    )
  } else {
    monthsToRun = [onlyMonth!]
    console.log('Exhaustive verify single month:', onlyMonth)
  }

  let totalRows = 0
  let totalMismatches = 0
  let totalErrors = 0

  for (const month of monthsToRun) {
    const { rows, mismatches, errors } = await verifyMonthExhaustive({
      admin,
      month,
      requestHost,
      plantById,
    })
    totalRows += rows
    totalMismatches += mismatches
    totalErrors += errors
    const status =
      mismatches === 0 && errors === 0
        ? 'OK'
        : `FAIL mismatches=${mismatches} errors=${errors}`
    console.log(`${month} | rollup rows=${rows} | ${status}`)
  }

  console.log(
    'TOTAL | months=',
    monthsToRun.length,
    '| rollup rows checked=',
    totalRows,
    '| mismatches=',
    totalMismatches,
    '| errors=',
    totalErrors
  )

  if (totalMismatches > 0 || totalErrors > 0) {
    process.exit(2)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
