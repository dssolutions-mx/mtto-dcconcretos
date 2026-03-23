/**
 * Phase D: persisted monthly ingresos-gastos plant snapshots.
 * Table: public.ingresos_gastos_kpi_plant_month (see supabase migration).
 */

import { unstable_cache } from 'next/cache'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/supabase-types'
import { INGRESOS_GASTOS_REPORT_TAG } from '@/lib/reports/ingresos-gastos-cache'

export const KPI_ROLLUP_COMPUTE_VERSION = 2

const TABLE = 'ingresos_gastos_kpi_plant_month'

export type KpiRollupPlant = {
  id: string
  name: string
  code: string
  business_unit_id: string | null
}

/** Default on: rollup miss falls back to full compute. Set INGRESOS_GASTOS_KPI_ROLLUP_READ=0 to disable. */
export function kpiRollupReadEnabled(): boolean {
  const v = process.env.INGRESOS_GASTOS_KPI_ROLLUP_READ?.trim()
  if (!v) return true
  const lower = v.toLowerCase()
  if (lower === '0' || lower === 'false' || lower === 'off' || lower === 'no') return false
  return lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on'
}

/** Default 25h so daily pg_cron snapshots stay valid; override with INGRESOS_GASTOS_KPI_ROLLUP_MAX_AGE_SECONDS. */
export function kpiRollupMaxAgeMs(): number {
  const defaultSec = 25 * 3600
  const sec = parseInt(
    process.env.INGRESOS_GASTOS_KPI_ROLLUP_MAX_AGE_SECONDS || String(defaultSec),
    10
  )
  return Math.max(60, Number.isFinite(sec) ? sec : defaultSec) * 1000
}

/** YYYY-MM -> YYYY-MM-01 for Postgres `date`. */
export function monthStringToPeriodDate(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  return `${y}-${String(m).padStart(2, '0')}-01`
}

export function emptyCostOnlyPlantRow(plant: KpiRollupPlant): Record<string, unknown> {
  return {
    plant_id: plant.id,
    plant_name: plant.name,
    plant_code: plant.code,
    business_unit_id: plant.business_unit_id,
    volumen_concreto: 0,
    fc_ponderada: 0,
    edad_ponderada: 0,
    pv_unitario: 0,
    ventas_total: 0,
    costo_mp_unitario: 0,
    consumo_cem_m3: 0,
    costo_cem_m3: 0,
    costo_cem_pct: 0,
    costo_mp_total: 0,
    costo_mp_pct: 0,
    spread_unitario: 0,
    spread_unitario_pct: 0,
    diesel_total: 0,
    diesel_unitario: 0,
    diesel_pct: 0,
    mantto_total: 0,
    mantto_unitario: 0,
    mantto_pct: 0,
    nomina_total: 0,
    nomina_unitario: 0,
    nomina_pct: 0,
    otros_indirectos_total: 0,
    otros_indirectos_unitario: 0,
    otros_indirectos_pct: 0,
    total_costo_op: 0,
    total_costo_op_pct: 0,
    ebitda: 0,
    ebitda_pct: 0,
    ingresos_bombeo_vol: 0,
    ingresos_bombeo_unit: 0,
    ingresos_bombeo_total: 0,
    ebitda_con_bombeo: 0,
    ebitda_con_bombeo_pct: 0,
  }
}

export function plantRowHasReportableData(plant: Record<string, unknown>): boolean {
  const ventas_total = Number(plant.ventas_total ?? 0)
  const diesel_total = Number(plant.diesel_total ?? 0)
  const mantto_total = Number(plant.mantto_total ?? 0)
  const nomina_total = Number(plant.nomina_total ?? 0)
  const otros_indirectos_total = Number(plant.otros_indirectos_total ?? 0)
  return (
    ventas_total > 0 ||
    diesel_total > 0 ||
    mantto_total > 0 ||
    nomina_total > 0 ||
    otros_indirectos_total > 0
  )
}

function normalizePlantToCostsOnly(plant: Record<string, unknown>): Record<string, unknown> {
  const diesel_total = Number(plant.diesel_total ?? 0)
  const mantto_total = Number(plant.mantto_total ?? 0)
  const total_costo_op = diesel_total + mantto_total

  return {
    plant_id: plant.plant_id ?? null,
    plant_name: plant.plant_name ?? null,
    plant_code: plant.plant_code ?? null,
    business_unit_id: plant.business_unit_id ?? null,
    volumen_concreto: 0,
    fc_ponderada: 0,
    edad_ponderada: 0,
    pv_unitario: 0,
    ventas_total: 0,
    costo_mp_unitario: 0,
    consumo_cem_m3: 0,
    costo_cem_m3: 0,
    costo_cem_pct: 0,
    costo_mp_total: 0,
    costo_mp_pct: 0,
    spread_unitario: 0,
    spread_unitario_pct: 0,
    diesel_total,
    diesel_unitario: 0,
    diesel_pct: 0,
    mantto_total,
    mantto_unitario: 0,
    mantto_pct: 0,
    nomina_total: 0,
    nomina_unitario: 0,
    nomina_pct: 0,
    otros_indirectos_total: 0,
    otros_indirectos_unitario: 0,
    otros_indirectos_pct: 0,
    total_costo_op,
    total_costo_op_pct: 0,
    ebitda: -total_costo_op,
    ebitda_pct: 0,
    ingresos_bombeo_vol: 0,
    ingresos_bombeo_unit: 0,
    ingresos_bombeo_total: 0,
    ebitda_con_bombeo: -total_costo_op,
    ebitda_con_bombeo_pct: 0,
  }
}

type RollupRow = {
  period_month: string
  plant_id: string
  payload: Json
  computed_at: string
  compute_version: number
}

const DELTA_METRICS = [
  'volumen_concreto',
  'ventas_total',
  'diesel_total',
  'diesel_unitario',
  'diesel_pct',
  'total_costo_op',
  'ebitda',
  'otros_indirectos_total',
  'nomina_total',
  'mantto_total',
] as const

export function buildIngresosGastosResponseFromRollup(params: {
  month: string
  comparisonMonth: string | null
  targetPlants: KpiRollupPlant[]
  businessUnits: unknown[]
  plants: unknown[]
  currentPlants: Record<string, unknown>[]
  previousPlants: Record<string, unknown>[]
  skipPreviousMonth: boolean
  costsOnly?: boolean
}): Record<string, unknown> {
  const {
    month,
    comparisonMonth,
    businessUnits,
    plants,
    currentPlants,
    previousPlants,
    skipPreviousMonth,
    costsOnly,
  } = params

  const normalizedCurrent = costsOnly
    ? currentPlants.map(normalizePlantToCostsOnly)
    : currentPlants
  const normalizedPrevious = costsOnly
    ? previousPlants.map(normalizePlantToCostsOnly)
    : previousPlants

  const filteredCurrent = normalizedCurrent.filter(plantRowHasReportableData)
  const filteredPrevious = normalizedPrevious.filter(plantRowHasReportableData)

  const previousMap = new Map<string, Record<string, unknown>>()
  for (const plant of filteredPrevious) {
    const key = String(plant.plant_code ?? plant.plant_id ?? '')
    if (key) previousMap.set(key, plant)
  }

  const deltaByPlant: Record<
    string,
    Record<string, { current: number; previous: number; delta: number; deltaPct: number | null }>
  > = {}

  if (!skipPreviousMonth) {
    for (const plant of filteredCurrent) {
      const key = String(plant.plant_code ?? plant.plant_id ?? '')
      if (!key) continue
      const prev = previousMap.get(key) || {}
      deltaByPlant[key] = {}
      for (const metric of DELTA_METRICS) {
        const current = Number(plant[metric] ?? 0)
        const previous = Number(prev[metric] ?? 0)
        const delta = current - previous
        deltaByPlant[key][metric] = {
          current,
          previous,
          delta,
          deltaPct: previous === 0 ? null : (delta / previous) * 100,
        }
      }
    }
  }

  return {
    month,
    comparisonMonth: skipPreviousMonth ? null : comparisonMonth,
    plants: filteredCurrent,
    comparison: skipPreviousMonth
      ? { month: null, plants: [] }
      : {
          month: comparisonMonth,
          plants: filteredPrevious,
        },
    deltas: deltaByPlant,
    filters: {
      businessUnits: businessUnits || [],
      plants: plants || [],
    },
  }
}

export async function tryReadFromKpiRollup(params: {
  supabase: SupabaseClient<Database>
  month: string
  comparisonMonth: string | null
  targetPlants: KpiRollupPlant[]
  businessUnits: unknown[]
  plants: unknown[]
  skipPreviousMonth: boolean
  costsOnly?: boolean
}): Promise<Record<string, unknown> | null> {
  const {
    supabase,
    month,
    comparisonMonth,
    targetPlants,
    businessUnits,
    plants,
    skipPreviousMonth,
    costsOnly,
  } = params
  if (targetPlants.length === 0) return null

  const periodDates = [monthStringToPeriodDate(month)]
  if (!skipPreviousMonth && comparisonMonth) {
    periodDates.push(monthStringToPeriodDate(comparisonMonth))
  }
  const ids = targetPlants.map((p) => p.id)

  const { data: rows, error } = await supabase
    .from(TABLE)
    .select('period_month, plant_id, payload, computed_at, compute_version')
    .in('period_month', periodDates)
    .in('plant_id', ids)

  if (error) {
    console.warn('[KPI rollup read]', error.message)
    return null
  }

  const list = (rows || []) as RollupRow[]
  if (list.length !== ids.length * periodDates.length) return null

  const maxAge = kpiRollupMaxAgeMs()
  const now = Date.now()

  const byPeriodPlant = new Map<string, RollupRow>()
  for (const r of list) {
    if (r.compute_version !== KPI_ROLLUP_COMPUTE_VERSION) return null
    const t = new Date(r.computed_at).getTime()
    if (!Number.isFinite(t) || now - t > maxAge) return null
    byPeriodPlant.set(`${r.period_month}:${r.plant_id}`, r)
  }

  const currentPeriod = monthStringToPeriodDate(month)
  const previousPeriod = !skipPreviousMonth && comparisonMonth
    ? monthStringToPeriodDate(comparisonMonth)
    : null

  const orderedCurrent: Record<string, unknown>[] = []
  const orderedPrevious: Record<string, unknown>[] = []

  for (const id of ids) {
    if (!byPeriodPlant.has(`${currentPeriod}:${id}`)) return null
    if (previousPeriod && !byPeriodPlant.has(`${previousPeriod}:${id}`)) return null
  }

  for (const tp of targetPlants) {
    const current = byPeriodPlant.get(`${currentPeriod}:${tp.id}`)
    if (!current?.payload || typeof current.payload !== 'object' || Array.isArray(current.payload)) {
      return null
    }
    orderedCurrent.push(current.payload as Record<string, unknown>)

    if (previousPeriod) {
      const previous = byPeriodPlant.get(`${previousPeriod}:${tp.id}`)
      if (!previous?.payload || typeof previous.payload !== 'object' || Array.isArray(previous.payload)) {
        return null
      }
      orderedPrevious.push(previous.payload as Record<string, unknown>)
    }
  }

  return buildIngresosGastosResponseFromRollup({
    month,
    comparisonMonth: previousPeriod ? comparisonMonth : null,
    targetPlants,
    businessUnits,
    plants,
    currentPlants: orderedCurrent,
    previousPlants: orderedPrevious,
    skipPreviousMonth,
    costsOnly,
  })
}

/**
 * Dashboard fast path: read rollup with service role scoped to `targetPlants` only (those IDs
 * were already resolved with the user’s RLS). User-scoped SELECT often missed rows (RLS ≠
 * refresh job), forcing a 4s+ full compute + cotizador sales fetch.
 *
 * Cached briefly so repeated dashboard loads don’t hammer Postgres.
 */
export async function attemptKpiRollupRead(params: {
  month: string
  comparisonMonth: string | null
  targetPlants: KpiRollupPlant[]
  businessUnits: unknown[]
  plants: unknown[]
  skipPreviousMonth: boolean
  costsOnly?: boolean
  /** Auth subject for cache partitioning (route passes auth user id). */
  rollupReadUserKey: string
  /** Last-resort read when service role env is missing (e.g. broken deploy). */
  userSupabase: SupabaseClient<Database>
}): Promise<Record<string, unknown> | null> {
  const {
    month,
    comparisonMonth,
    targetPlants,
    businessUnits,
    plants,
    skipPreviousMonth,
    costsOnly,
    rollupReadUserKey,
    userSupabase,
  } = params
  if (targetPlants.length === 0) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url && serviceKey) {
    const sortedIds = [...targetPlants.map((p) => p.id)].sort().join(',')
    const cachedRead = unstable_cache(
      async () => {
        const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false } })
        return tryReadFromKpiRollup({
          supabase: admin,
          month,
          comparisonMonth,
          targetPlants,
          businessUnits,
          plants,
          skipPreviousMonth,
          costsOnly,
        })
      },
      [
        'ingresos-kpi-rollup',
        month,
        comparisonMonth ?? 'none',
        sortedIds,
        String(skipPreviousMonth),
        String(Boolean(costsOnly)),
        rollupReadUserKey,
      ],
      { revalidate: 45, tags: [INGRESOS_GASTOS_REPORT_TAG] }
    )
    try {
      const hit = await cachedRead()
      if (hit) return hit
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('incrementalCache missing')) throw error
    }
  }

  return tryReadFromKpiRollup({
    supabase: userSupabase,
    month,
    comparisonMonth,
    targetPlants,
    businessUnits,
    plants,
    skipPreviousMonth,
    costsOnly,
  })
}

export async function upsertKpiRollupMonth(params: {
  supabaseAdmin: SupabaseClient<Database>
  month: string
  allPlants: KpiRollupPlant[]
  computedPlants: Record<string, unknown>[]
}): Promise<{ upserted: number }> {
  const { supabaseAdmin, month, allPlants, computedPlants } = params
  const periodDate = monthStringToPeriodDate(month)
  const computedById = new Map<string, Record<string, unknown>>()
  for (const row of computedPlants) {
    const id = String((row as { plant_id?: string }).plant_id ?? '')
    if (id) computedById.set(id, row)
  }

  const nowIso = new Date().toISOString()
  const batch: {
    period_month: string
    plant_id: string
    payload: Json
    computed_at: string
    compute_version: number
  }[] = []

  for (const p of allPlants) {
    const payload = computedById.get(p.id) ?? emptyCostOnlyPlantRow(p)
    batch.push({
      period_month: periodDate,
      plant_id: p.id,
      payload: payload as Json,
      computed_at: nowIso,
      compute_version: KPI_ROLLUP_COMPUTE_VERSION,
    })
  }

  const chunk = 200
  for (let i = 0; i < batch.length; i += chunk) {
    const slice = batch.slice(i, i + chunk)
    const { error } = await supabaseAdmin.from(TABLE).upsert(slice, {
      onConflict: 'period_month,plant_id',
    })
    if (error) {
      throw new Error(`KPI rollup upsert: ${error.message}`)
    }
  }

  return { upserted: batch.length }
}
