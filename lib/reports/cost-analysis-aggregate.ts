import { createClient } from '@supabase/supabase-js'
import { getExpenseCategoryById, getExpenseCategoryDisplayName } from '@/lib/constants/expense-categories'
import { runIngresosGastosPost } from '@/lib/reports/ingresos-gastos-compute'

/**
 * Cotizador `plant_indirect_material_costs` (autoconsumo) is bucketed into the same
 * canonical category the details route uses: expense_category = '1' (OPERACIÓN DE PLANTA),
 * expense_subcategory = 'Instalación / Autoconsumo'. Keeps click-through consistent with
 * /api/reports/gerencial/ingresos-gastos/details.
 */
const AUTO_TARGET_CATEGORY_ID = '1'
const AUTO_TARGET_SUBCATEGORY = 'Instalación / Autoconsumo'
const AUTO_DEPARTMENT_LABEL = 'General - Instalación / Autoconsumo'

export type CostAnalysisMonthKey = string // YYYY-MM

/**
 * Per-plant monthly series for every financial metric we get from runIngresosGastosPost.
 * Backwards compatible: existing fields (nomina, otrosIndirectos, totalCostoOp, volume) preserved.
 */
export type CostAnalysisPlantRow = {
  plantId: string
  plantCode: string
  plantName: string
  businessUnitId: string | null
  // volume / mix
  volume: Record<CostAnalysisMonthKey, number>
  fcPonderada: Record<CostAnalysisMonthKey, number>
  // revenue
  pvUnitario: Record<CostAnalysisMonthKey, number>
  ventasTotal: Record<CostAnalysisMonthKey, number>
  ingresosBombeoTotal: Record<CostAnalysisMonthKey, number>
  ingresosBombeoVol: Record<CostAnalysisMonthKey, number>
  // raw material
  costoMpTotal: Record<CostAnalysisMonthKey, number>
  costoMpUnitario: Record<CostAnalysisMonthKey, number>
  consumoCemM3: Record<CostAnalysisMonthKey, number>
  costoCemM3: Record<CostAnalysisMonthKey, number>
  // spread
  spreadUnitario: Record<CostAnalysisMonthKey, number>
  spreadUnitarioPct: Record<CostAnalysisMonthKey, number>
  // operating cost components
  dieselTotal: Record<CostAnalysisMonthKey, number>
  manttoTotal: Record<CostAnalysisMonthKey, number>
  nomina: Record<CostAnalysisMonthKey, number>
  otrosIndirectos: Record<CostAnalysisMonthKey, number>
  totalCostoOp: Record<CostAnalysisMonthKey, number>
  // ebitda
  ebitda: Record<CostAnalysisMonthKey, number>
  ebitdaPct: Record<CostAnalysisMonthKey, number>
  ebitdaConBombeo: Record<CostAnalysisMonthKey, number>
  ebitdaConBombeoPct: Record<CostAnalysisMonthKey, number>
}

export type CostAnalysisCategoryRow = {
  categoryId: string
  categoryName: string
  monthlyTotals: Record<CostAnalysisMonthKey, number>
  subcategories: Array<{
    name: string
    monthlyTotals: Record<CostAnalysisMonthKey, number>
  }>
}

export type CostAnalysisDepartmentRow = {
  department: string
  type: 'nomina' | 'otros_indirectos'
  monthlyTotals: Record<CostAnalysisMonthKey, number>
}

/** Company-wide monthly rollups for every metric. */
export type CostAnalysisSummary = {
  // legacy (kept)
  nomina: Record<CostAnalysisMonthKey, number>
  otrosIndirectos: Record<CostAnalysisMonthKey, number>
  totalCostoOp: Record<CostAnalysisMonthKey, number>
  totalVolume: Record<CostAnalysisMonthKey, number>
  // new: full P&L
  ventasTotal: Record<CostAnalysisMonthKey, number>
  ingresosBombeoTotal: Record<CostAnalysisMonthKey, number>
  costoMpTotal: Record<CostAnalysisMonthKey, number>
  dieselTotal: Record<CostAnalysisMonthKey, number>
  manttoTotal: Record<CostAnalysisMonthKey, number>
  ebitda: Record<CostAnalysisMonthKey, number>
  ebitdaConBombeo: Record<CostAnalysisMonthKey, number>
  // weighted / derived (computed from totals so they stay consistent at rollup time)
  pvUnitario: Record<CostAnalysisMonthKey, number>
  costoMpUnitario: Record<CostAnalysisMonthKey, number>
  spreadUnitario: Record<CostAnalysisMonthKey, number>
  ebitdaPct: Record<CostAnalysisMonthKey, number>
  ebitdaConBombeoPct: Record<CostAnalysisMonthKey, number>
  consumoCemM3: Record<CostAnalysisMonthKey, number>
  fcPonderada: Record<CostAnalysisMonthKey, number>
}

/** Maintenance spend split by linked work-order type (corrective / preventive / inspection / other). */
export type CostAnalysisManttoTypeBucket = {
  corrective: number
  preventive: number
  inspection: number
  /** WOs without a recognized type, or POs without a linked WO. */
  other: number
}

/** Data-coverage signals so the UI can distinguish "no data" from "real zero". */
export type CostAnalysisDataFreshness = {
  manualAdjustments: {
    /** ISO timestamp of the most recent updated_at across all visible months. */
    lastUpdatedAt: string | null
    /** Row count per month (entire DB, not plant-scoped — measures capture completeness). */
    rowCountByMonth: Record<CostAnalysisMonthKey, number>
  }
  autoconsumo: {
    /** Latest period_start with at least one row in cotizador for the target plants. */
    lastPeriodWithData: CostAnalysisMonthKey | null
  }
}

export type CostAnalysisResponse = {
  months: CostAnalysisMonthKey[]
  summary: CostAnalysisSummary
  byCategory: CostAnalysisCategoryRow[]
  byDepartment: CostAnalysisDepartmentRow[]
  byPlant: CostAnalysisPlantRow[]
  /** Maintenance cost split by WO type, per month. Independently sourced from PO↔WO join. */
  manttoByType: Record<CostAnalysisMonthKey, CostAnalysisManttoTypeBucket>
  /** Distinct expense_category buckets touched per month (data-quality glance). */
  categoryCoverage: Record<CostAnalysisMonthKey, number>
  dataFreshness: CostAnalysisDataFreshness
  reconciliation?: {
    nominaDepartmentSumMatchesSummary: boolean
    otrosCategorySumMatchesSummary: boolean
    /** byCategory − summary, per month. Zero when matching. */
    otrosDiffByMonth: Record<CostAnalysisMonthKey, number>
    /** byDepartment(nomina) − summary, per month. Zero when matching. */
    nominaDiffByMonth: Record<CostAnalysisMonthKey, number>
    /** sum(manttoByType.*) − summary.manttoTotal, per month. Independent measurement. */
    manttoTypeDiffByMonth: Record<CostAnalysisMonthKey, number>
  }
}

function toPeriodMonth(monthYm: string): string {
  const [y, m] = monthYm.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-01`
}

function zeroMap(months: string[]): Record<string, number> {
  return Object.fromEntries(months.map(m => [m, 0])) as Record<string, number>
}

function emptyPlantRow(plant: { id: string; code: string | null; name: string | null; business_unit_id: string | null }, months: string[]): CostAnalysisPlantRow {
  return {
    plantId: plant.id,
    plantCode: plant.code || '',
    plantName: plant.name || '',
    businessUnitId: plant.business_unit_id || null,
    volume: zeroMap(months),
    fcPonderada: zeroMap(months),
    pvUnitario: zeroMap(months),
    ventasTotal: zeroMap(months),
    ingresosBombeoTotal: zeroMap(months),
    ingresosBombeoVol: zeroMap(months),
    costoMpTotal: zeroMap(months),
    costoMpUnitario: zeroMap(months),
    consumoCemM3: zeroMap(months),
    costoCemM3: zeroMap(months),
    spreadUnitario: zeroMap(months),
    spreadUnitarioPct: zeroMap(months),
    dieselTotal: zeroMap(months),
    manttoTotal: zeroMap(months),
    nomina: zeroMap(months),
    otrosIndirectos: zeroMap(months),
    totalCostoOp: zeroMap(months),
    ebitda: zeroMap(months),
    ebitdaPct: zeroMap(months),
    ebitdaConBombeo: zeroMap(months),
    ebitdaConBombeoPct: zeroMap(months),
  }
}

function emptySummary(months: string[]): CostAnalysisSummary {
  return {
    nomina: zeroMap(months),
    otrosIndirectos: zeroMap(months),
    totalCostoOp: zeroMap(months),
    totalVolume: zeroMap(months),
    ventasTotal: zeroMap(months),
    ingresosBombeoTotal: zeroMap(months),
    costoMpTotal: zeroMap(months),
    dieselTotal: zeroMap(months),
    manttoTotal: zeroMap(months),
    ebitda: zeroMap(months),
    ebitdaConBombeo: zeroMap(months),
    pvUnitario: zeroMap(months),
    costoMpUnitario: zeroMap(months),
    spreadUnitario: zeroMap(months),
    ebitdaPct: zeroMap(months),
    ebitdaConBombeoPct: zeroMap(months),
    consumoCemM3: zeroMap(months),
    fcPonderada: zeroMap(months),
  }
}

async function fetchAutoconsumoTotalsByMonth(
  monthYms: string[],
  plantCodes: string[]
): Promise<{ byMonth: Record<string, number>; lastPeriodWithData: string | null }> {
  const byMonth: Record<string, number> = Object.fromEntries(monthYms.map(m => [m, 0]))
  if (plantCodes.length === 0) return { byMonth, lastPeriodWithData: null }
  if (!process.env.COTIZADOR_SUPABASE_URL || !process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY) {
    return { byMonth, lastPeriodWithData: null }
  }
  const cotizador = createClient(
    process.env.COTIZADOR_SUPABASE_URL,
    process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
  for (const monthYm of monthYms) {
    const periodMonth = toPeriodMonth(monthYm)
    try {
      const { data: rows, error } = await cotizador
        .from('plant_indirect_material_costs')
        .select('amount')
        .eq('period_start', periodMonth)
        .in('plant_code', plantCodes)
      if (error) {
        console.error('cost-analysis plant_indirect_material_costs:', error)
        continue
      }
      for (const row of rows || []) {
        byMonth[monthYm] += Number((row as { amount?: unknown }).amount || 0)
      }
    } catch (e) {
      console.error('cost-analysis autoconsumo fetch error:', e)
    }
  }
  // Latest period with any data (query once, unbounded by sortedMonths).
  let lastPeriodWithData: string | null = null
  try {
    const { data: latest, error } = await cotizador
      .from('plant_indirect_material_costs')
      .select('period_start')
      .in('plant_code', plantCodes)
      .order('period_start', { ascending: false })
      .limit(1)
    if (!error && latest && latest.length > 0) {
      const period = (latest[0] as { period_start?: string }).period_start
      if (period) lastPeriodWithData = period.slice(0, 7)
    }
  } catch (e) {
    console.error('cost-analysis autoconsumo latest-period error:', e)
  }
  return { byMonth, lastPeriodWithData }
}

/** Normalize work_order.type into the four buckets we report. */
function normalizeWoType(type: string | null | undefined): keyof CostAnalysisManttoTypeBucket {
  const t = (type ?? '').trim().toLowerCase()
  if (t === 'preventive' || t === 'preventivo') return 'preventive'
  if (t === 'inspection' || t === 'inspeccion' || t === 'inspección') return 'inspection'
  if (t === 'corrective' || t === 'correctivo') return 'corrective'
  return 'other'
}

/** First of current YYYY-MM (for date-in-range comparison). */
function firstDayOfMonth(monthYm: string): string {
  return `${monthYm}-01`
}

/** Last day of a YYYY-MM (approximate end-of-month; we use the 1st of next month minus one day). */
function lastDayOfMonth(monthYm: string): string {
  const [y, m] = monthYm.split('-').map(Number)
  // JS Date: month index is 0-based. Day 0 of next month = last day of current.
  const d = new Date(y, m, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Strip any time part to get YYYY-MM-DD. */
function extractDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  if (dateStr.includes('T')) return dateStr.split('T')[0]
  return dateStr.slice(0, 10)
}

/**
 * Fetch maintenance cost split by WO type, independent of the summary mantto_total.
 * Mirrors the PO filter in ingresos-gastos-compute.ts:929-981 (non-pending status, same date
 * fallback chain, actual_amount ?? total_amount) so we can cross-check.
 */
async function fetchManttoByType(params: {
  supabase: any
  sortedMonths: string[]
  targetPlantIds: string[]
}): Promise<Record<string, CostAnalysisManttoTypeBucket>> {
  const { supabase, sortedMonths, targetPlantIds } = params
  const out: Record<string, CostAnalysisManttoTypeBucket> = Object.fromEntries(
    sortedMonths.map(m => [m, { corrective: 0, preventive: 0, inspection: 0, other: 0 }])
  )
  if (sortedMonths.length === 0 || targetPlantIds.length === 0) return out

  const dateFromStr = firstDayOfMonth(sortedMonths[0])
  const dateToStr = lastDayOfMonth(sortedMonths[sortedMonths.length - 1])

  try {
    const { data: purchaseOrders, error: poErr } = await supabase
      .from('purchase_orders')
      .select('id, total_amount, actual_amount, created_at, posting_date, purchase_date, work_order_id, status')
      .neq('status', 'pending_approval')
      .not('work_order_id', 'is', null)

    if (poErr) {
      console.error('cost-analysis manttoByType PO query:', poErr)
      return out
    }

    const workOrderIds = (purchaseOrders || [])
      .map((po: any) => po.work_order_id)
      .filter(Boolean)

    if (workOrderIds.length === 0) return out

    const { data: workOrders, error: woErr } = await supabase
      .from('work_orders')
      .select('id, type, completed_at, planned_date, created_at, asset_id, assets(plant_id)')
      .in('id', workOrderIds)

    if (woErr) {
      console.error('cost-analysis manttoByType WO query:', woErr)
      return out
    }

    const woById = new Map<string, any>((workOrders || []).map((w: any) => [w.id, w]))
    const plantSet = new Set(targetPlantIds)

    for (const po of purchaseOrders || []) {
      const wo = po.work_order_id ? woById.get(po.work_order_id) : null
      if (!wo) continue
      const plantId = wo?.assets?.plant_id
      if (!plantId || !plantSet.has(plantId)) continue

      // Date fallback chain (matches ingresos-gastos-compute.ts:951-968)
      let dateStr = ''
      if (po.purchase_date) dateStr = po.purchase_date
      else if (wo.completed_at) dateStr = wo.completed_at
      else if (wo.planned_date) dateStr = wo.planned_date
      else if (wo.created_at) dateStr = wo.created_at
      else if (po.created_at) dateStr = po.created_at

      const dOnly = extractDateOnly(dateStr)
      if (!dOnly || dOnly < dateFromStr || dOnly > dateToStr) continue

      const monthYm = dOnly.slice(0, 7)
      if (!out[monthYm]) continue

      const amount = po.actual_amount != null
        ? parseFloat(String(po.actual_amount))
        : parseFloat(String(po.total_amount || '0'))
      if (!Number.isFinite(amount) || amount === 0) continue

      const bucket = normalizeWoType(wo.type)
      out[monthYm][bucket] += amount
    }
  } catch (e) {
    console.error('cost-analysis manttoByType fetch error:', e)
  }

  return out
}

/**
 * Data freshness for `manual_financial_adjustments`. Scoped only by months (entire DB),
 * since adjustments can be distributed across BUs/plants post-hoc — what matters is
 * "did capture happen this month".
 */
async function fetchManualAdjustmentsFreshness(params: {
  supabase: any
  periodMonths: string[]
  sortedMonths: string[]
}): Promise<{ lastUpdatedAt: string | null; rowCountByMonth: Record<string, number> }> {
  const { supabase, periodMonths, sortedMonths } = params
  const rowCountByMonth: Record<string, number> = zeroMap(sortedMonths)
  if (periodMonths.length === 0) return { lastUpdatedAt: null, rowCountByMonth }

  try {
    const { data, error } = await supabase
      .from('manual_financial_adjustments')
      .select('period_month, updated_at')
      .in('period_month', periodMonths)

    if (error) {
      console.error('cost-analysis manual adjustments freshness:', error)
      return { lastUpdatedAt: null, rowCountByMonth }
    }

    let lastUpdatedAt: string | null = null
    for (const row of (data || []) as Array<{ period_month: string; updated_at: string | null }>) {
      const ym = (row.period_month || '').slice(0, 7)
      if (ym in rowCountByMonth) rowCountByMonth[ym] += 1
      if (row.updated_at && (!lastUpdatedAt || row.updated_at > lastUpdatedAt)) {
        lastUpdatedAt = row.updated_at
      }
    }
    return { lastUpdatedAt, rowCountByMonth }
  } catch (e) {
    console.error('cost-analysis manual adjustments freshness error:', e)
    return { lastUpdatedAt: null, rowCountByMonth }
  }
}

function buildDepartmentToPlants(
  profiles: Array<{ departamento: string | null; plant_id: string | null }> | null
): Map<string, string[]> {
  const departmentToPlants = new Map<string, string[]>()
  ;(profiles || []).forEach(profile => {
    if (profile.departamento && profile.plant_id) {
      if (!departmentToPlants.has(profile.departamento)) {
        departmentToPlants.set(profile.departamento, [])
      }
      const arr = departmentToPlants.get(profile.departamento)!
      if (!arr.includes(profile.plant_id)) arr.push(profile.plant_id)
    }
  })
  return departmentToPlants
}

function allocateManualAdjustmentToPlants(params: {
  adj: any
  targetPlantIds: string[]
  plantsForBuResolution: Array<{ id: string; code: string; business_unit_id: string }>
  departmentToPlants: Map<string, string[]>
}): Map<string, number> {
  const { adj, targetPlantIds, plantsForBuResolution, departmentToPlants } = params
  const out = new Map<string, number>()
  const targetSet = new Set(targetPlantIds)
  const category = adj.category
  if (category !== 'nomina' && category !== 'otros_indirectos') return out

  const add = (plantId: string, amt: number) => {
    if (!targetSet.has(plantId) || amt === 0) return
    out.set(plantId, (out.get(plantId) || 0) + amt)
  }

  const amount = Number(adj.amount || 0)

  if (adj.plant_id && targetSet.has(adj.plant_id)) {
    add(adj.plant_id, amount)
  }

  if (adj.is_distributed && adj.distributions && Array.isArray(adj.distributions)) {
    adj.distributions.forEach((dist: any) => {
      const distAmount = Number(dist.amount || 0)
      if (dist.plant_id && targetSet.has(dist.plant_id)) {
        add(dist.plant_id, distAmount)
      } else if (dist.business_unit_id) {
        const buPlants = plantsForBuResolution.filter(
          p => p.business_unit_id === dist.business_unit_id && targetSet.has(p.id)
        )
        if (buPlants.length > 0) {
          const per = distAmount / buPlants.length
          buPlants.forEach(p => add(p.id, per))
        }
      } else if (dist.department) {
        const departmentPlants = departmentToPlants.get(dist.department) || []
        const targets = departmentPlants.filter(pid => targetSet.has(pid))
        if (targets.length > 0) {
          const per = distAmount / targets.length
          targets.forEach(pid => add(pid, per))
        }
      }
    })
  }

  return out
}

export async function runCostAnalysis(params: {
  supabase: any
  months: string[]
  businessUnitId: string | null
  plantId: string | null
  requestHost: string | null
  rollupReadUserKey: string | null
}): Promise<CostAnalysisResponse> {
  const { supabase, months, businessUnitId, plantId, requestHost, rollupReadUserKey } = params

  const sortedMonths = [...new Set(months.map(m => m.slice(0, 7)))].sort()
  if (sortedMonths.length === 0) {
    return {
      months: [],
      summary: emptySummary([]),
      byCategory: [],
      byDepartment: [],
      byPlant: [],
      manttoByType: {},
      categoryCoverage: {},
      dataFreshness: {
        manualAdjustments: { lastUpdatedAt: null, rowCountByMonth: {} },
        autoconsumo: { lastPeriodWithData: null },
      },
    }
  }

  const plantsPromise = businessUnitId
    ? supabase.from('plants').select('id, name, code, business_unit_id').eq('business_unit_id', businessUnitId).order('name')
    : supabase.from('plants').select('id, name, code, business_unit_id').order('name')

  const [{ data: plantsData }, { data: profilesData }] = await Promise.all([
    plantsPromise,
    supabase
      .from('profiles')
      .select('departamento, plant_id')
      .not('departamento', 'is', null)
      .not('plant_id', 'is', null),
  ])

  type PlantRecord = { id: string; name: string; code: string; business_unit_id: string }
  const allPlants = (plantsData || []) as PlantRecord[]
  const targetPlants: PlantRecord[] = plantId
    ? allPlants.filter((p: PlantRecord) => p.id === plantId)
    : businessUnitId
      ? allPlants.filter((p: PlantRecord) => p.business_unit_id === businessUnitId)
      : allPlants

  if (targetPlants.length === 0) {
    return {
      months: sortedMonths,
      summary: emptySummary(sortedMonths),
      byCategory: [],
      byDepartment: [],
      byPlant: [],
      manttoByType: Object.fromEntries(sortedMonths.map(m => [m, { corrective: 0, preventive: 0, inspection: 0, other: 0 }])),
      categoryCoverage: zeroMap(sortedMonths),
      dataFreshness: {
        manualAdjustments: { lastUpdatedAt: null, rowCountByMonth: zeroMap(sortedMonths) },
        autoconsumo: { lastPeriodWithData: null },
      },
    }
  }

  const targetPlantIds = targetPlants.map(p => p.id)
  const departmentToPlants = buildDepartmentToPlants(profilesData)

  const periodMonths = sortedMonths.map(toPeriodMonth)

  const { data: adjustments } = await supabase
    .from('manual_financial_adjustments')
    .select(
      `
      *,
      distributions:manual_financial_adjustment_distributions(
        id,
        plant_id,
        business_unit_id,
        department,
        amount
      )
    `
    )
    .in('period_month', periodMonths)

  const categoryMonthly = new Map<string, Map<string, number>>()
  const subcatMonthly = new Map<string, Map<string, Map<string, number>>>()
  const deptMonthly = new Map<string, Map<string, number>>()

  const monthYmFromPeriod = (period: string) => period.slice(0, 7)

  for (const adj of adjustments || []) {
    const monthKey = monthYmFromPeriod(adj.period_month as string)
    if (!sortedMonths.includes(monthKey)) continue

    const byPlant = allocateManualAdjustmentToPlants({
      adj,
      targetPlantIds,
      plantsForBuResolution: allPlants,
      departmentToPlants,
    })

    if (adj.category === 'otros_indirectos') {
      const catId = (adj.expense_category as string) || 'sin'
      if (!categoryMonthly.has(catId)) categoryMonthly.set(catId, new Map())
      const cm = categoryMonthly.get(catId)!
      const subName = (adj.expense_subcategory as string) || 'Sin Subcategoría'
      if (!subcatMonthly.has(catId)) subcatMonthly.set(catId, new Map())
      const sm = subcatMonthly.get(catId)!
      if (!sm.has(subName)) sm.set(subName, new Map())

      let sumAlloc = 0
      for (const amt of byPlant.values()) sumAlloc += amt
      cm.set(monthKey, (cm.get(monthKey) || 0) + sumAlloc)
      const subMap = sm.get(subName)!
      subMap.set(monthKey, (subMap.get(monthKey) || 0) + sumAlloc)
    }

    if (adj.category === 'nomina') {
      const dept = (adj.department as string) || 'Sin Departamento'
      const key = `nomina::${dept}`
      if (!deptMonthly.has(key)) deptMonthly.set(key, new Map())
      const dm = deptMonthly.get(key)!
      let sumAlloc = 0
      for (const amt of byPlant.values()) sumAlloc += amt
      dm.set(monthKey, (dm.get(monthKey) || 0) + sumAlloc)
    }

    if (adj.category === 'otros_indirectos') {
      const dept = (adj.department as string) || 'General'
      const catObj = adj.expense_category ? getExpenseCategoryById(String(adj.expense_category)) : undefined
      const catLabel = catObj ? getExpenseCategoryDisplayName(catObj) : 'Sin Categoría'
      const key = `otros::${catLabel} - ${dept}`
      if (!deptMonthly.has(key)) deptMonthly.set(key, new Map())
      const dm = deptMonthly.get(key)!
      let sumAlloc = 0
      for (const amt of byPlant.values()) sumAlloc += amt
      dm.set(monthKey, (dm.get(monthKey) || 0) + sumAlloc)
    }
  }

  const plantCodesForAuto = targetPlants.map(p => p.code).filter(Boolean) as string[]
  const [
    { byMonth: autoconsumoByMonth, lastPeriodWithData: autoconsumoLastPeriod },
    manttoByType,
    manualFreshness,
  ] = await Promise.all([
    fetchAutoconsumoTotalsByMonth(sortedMonths, plantCodesForAuto),
    fetchManttoByType({ supabase, sortedMonths, targetPlantIds }),
    fetchManualAdjustmentsFreshness({ supabase, periodMonths, sortedMonths }),
  ])
  const hasAnyAutoconsumo = sortedMonths.some(m => (autoconsumoByMonth[m] || 0) > 0)
  if (hasAnyAutoconsumo) {
    if (!categoryMonthly.has(AUTO_TARGET_CATEGORY_ID)) categoryMonthly.set(AUTO_TARGET_CATEGORY_ID, new Map())
    const acm = categoryMonthly.get(AUTO_TARGET_CATEGORY_ID)!
    if (!subcatMonthly.has(AUTO_TARGET_CATEGORY_ID)) subcatMonthly.set(AUTO_TARGET_CATEGORY_ID, new Map())
    const smRoot = subcatMonthly.get(AUTO_TARGET_CATEGORY_ID)!
    if (!smRoot.has(AUTO_TARGET_SUBCATEGORY)) smRoot.set(AUTO_TARGET_SUBCATEGORY, new Map())
    const subMap = smRoot.get(AUTO_TARGET_SUBCATEGORY)!

    // Department key matches the format used elsewhere: `otros::<categoryLabel> - <department>`
    const autoCatLabel = (() => {
      const co = getExpenseCategoryById(AUTO_TARGET_CATEGORY_ID)
      return co ? getExpenseCategoryDisplayName(co) : AUTO_TARGET_CATEGORY_ID
    })()
    const autoDeptKey = `otros::${autoCatLabel} - ${AUTO_DEPARTMENT_LABEL}`
    if (!deptMonthly.has(autoDeptKey)) deptMonthly.set(autoDeptKey, new Map())
    const adm = deptMonthly.get(autoDeptKey)!

    for (const m of sortedMonths) {
      const amt = autoconsumoByMonth[m] || 0
      if (amt <= 0) continue
      acm.set(m, (acm.get(m) || 0) + amt)
      subMap.set(m, (subMap.get(m) || 0) + amt)
      adm.set(m, (adm.get(m) || 0) + amt)
    }
  }

  const byCategory: CostAnalysisCategoryRow[] = Array.from(categoryMonthly.entries())
    .map(([categoryId, monthlyMap]) => {
      const catObj = categoryId !== 'sin' ? getExpenseCategoryById(categoryId) : undefined
      const categoryName = catObj ? getExpenseCategoryDisplayName(catObj) : 'Sin Categoría'
      const monthlyTotals: Record<string, number> = {}
      sortedMonths.forEach(m => {
        monthlyTotals[m] = monthlyMap.get(m) || 0
      })
      const subMap = subcatMonthly.get(categoryId) || new Map()
      const subcategories = Array.from(subMap.entries()).map(([name, subM]) => {
        const monthlyTotalsSub: Record<string, number> = {}
        sortedMonths.forEach(m => {
          monthlyTotalsSub[m] = subM.get(m) || 0
        })
        return { name, monthlyTotals: monthlyTotalsSub }
      })
      subcategories.sort((a, b) => a.name.localeCompare(b.name, 'es'))
      return { categoryId, categoryName, monthlyTotals, subcategories }
    })
    .sort((a, b) => a.categoryId.localeCompare(b.categoryId, undefined, { numeric: true }))

  const byDepartment: CostAnalysisDepartmentRow[] = Array.from(deptMonthly.entries()).map(([key, monthlyMap]) => {
    const [typePrefix, ...rest] = key.split('::')
    const type = typePrefix === 'nomina' ? 'nomina' : 'otros_indirectos'
    const department = rest.join('::')
    const monthlyTotals: Record<string, number> = {}
    sortedMonths.forEach(m => {
      monthlyTotals[m] = monthlyMap.get(m) || 0
    })
    return { department, type, monthlyTotals }
  })
  byDepartment.sort((a, b) => a.department.localeCompare(b.department, 'es'))

  const summary = emptySummary(sortedMonths)

  // volume-weighted accumulators for fc_ponderada and consumo_cem_m3
  const fcWeighted: Record<string, number> = zeroMap(sortedMonths)
  const cemWeighted: Record<string, number> = zeroMap(sortedMonths)

  const plantIdSet = new Set(targetPlants.map(p => p.id))
  const byPlantMap = new Map<string, CostAnalysisPlantRow>()
  for (const p of targetPlants) {
    byPlantMap.set(p.id, emptyPlantRow(p, sortedMonths))
  }

  for (const monthYm of sortedMonths) {
    const payload = await runIngresosGastosPost({
      body: {
        month: monthYm,
        businessUnitId: businessUnitId || undefined,
        plantId: plantId || undefined,
        skipPreviousMonth: true,
      },
      supabase,
      requestHost,
      rollupReadUserKey: rollupReadUserKey ?? 'anonymous',
    })

    const plantsRow = (payload as any).plants as
      | Array<Record<string, any>>
      | undefined

    if (!plantsRow) continue

    for (const row of plantsRow) {
      if (!plantIdSet.has(row.plant_id)) continue
      const pr = byPlantMap.get(row.plant_id)
      const v = (k: string) => Number(row[k] || 0)
      const volume = v('volumen_concreto')
      const fc = v('fc_ponderada')
      const cem = v('consumo_cem_m3')

      if (pr) {
        pr.volume[monthYm] = volume
        pr.fcPonderada[monthYm] = fc
        pr.pvUnitario[monthYm] = v('pv_unitario')
        pr.ventasTotal[monthYm] = v('ventas_total')
        pr.ingresosBombeoTotal[monthYm] = v('ingresos_bombeo_total')
        pr.ingresosBombeoVol[monthYm] = v('ingresos_bombeo_vol')
        pr.costoMpTotal[monthYm] = v('costo_mp_total')
        pr.costoMpUnitario[monthYm] = v('costo_mp_unitario')
        pr.consumoCemM3[monthYm] = cem
        pr.costoCemM3[monthYm] = v('costo_cem_m3')
        pr.spreadUnitario[monthYm] = v('spread_unitario')
        pr.spreadUnitarioPct[monthYm] = v('spread_unitario_pct')
        pr.dieselTotal[monthYm] = v('diesel_total')
        pr.manttoTotal[monthYm] = v('mantto_total')
        pr.nomina[monthYm] = v('nomina_total')
        pr.otrosIndirectos[monthYm] = v('otros_indirectos_total')
        pr.totalCostoOp[monthYm] = v('total_costo_op')
        pr.ebitda[monthYm] = v('ebitda')
        pr.ebitdaPct[monthYm] = v('ebitda_pct')
        pr.ebitdaConBombeo[monthYm] = v('ebitda_con_bombeo')
        pr.ebitdaConBombeoPct[monthYm] = v('ebitda_con_bombeo_pct')
      }

      summary.totalVolume[monthYm] += volume
      summary.ventasTotal[monthYm] += v('ventas_total')
      summary.ingresosBombeoTotal[monthYm] += v('ingresos_bombeo_total')
      summary.costoMpTotal[monthYm] += v('costo_mp_total')
      summary.dieselTotal[monthYm] += v('diesel_total')
      summary.manttoTotal[monthYm] += v('mantto_total')
      summary.nomina[monthYm] += v('nomina_total')
      summary.otrosIndirectos[monthYm] += v('otros_indirectos_total')
      summary.totalCostoOp[monthYm] += v('total_costo_op')
      summary.ebitda[monthYm] += v('ebitda')
      summary.ebitdaConBombeo[monthYm] += v('ebitda_con_bombeo')

      fcWeighted[monthYm] += fc * volume
      cemWeighted[monthYm] += cem * volume
    }
  }

  // Derived summary metrics — recompute from totals so rollups stay consistent.
  for (const m of sortedMonths) {
    const ventas = summary.ventasTotal[m]
    const vol = summary.totalVolume[m]
    const bombeo = summary.ingresosBombeoTotal[m]
    summary.pvUnitario[m] = vol > 0 ? ventas / vol : 0
    summary.costoMpUnitario[m] = vol > 0 ? summary.costoMpTotal[m] / vol : 0
    summary.spreadUnitario[m] = summary.pvUnitario[m] - summary.costoMpUnitario[m]
    summary.ebitdaPct[m] = ventas > 0 ? (summary.ebitda[m] / ventas) * 100 : 0
    summary.ebitdaConBombeoPct[m] = ventas + bombeo > 0 ? (summary.ebitdaConBombeo[m] / (ventas + bombeo)) * 100 : 0
    summary.fcPonderada[m] = vol > 0 ? fcWeighted[m] / vol : 0
    summary.consumoCemM3[m] = vol > 0 ? cemWeighted[m] / vol : 0
  }

  const byPlant = Array.from(byPlantMap.values()).sort((a, b) =>
    a.plantCode.localeCompare(b.plantCode, 'es')
  )

  const EPS = 0.02
  const nominaDiffByMonth: Record<string, number> = zeroMap(sortedMonths)
  let nominaDepartmentSumMatchesSummary = true
  for (const m of sortedMonths) {
    const sumDept = byDepartment
      .filter(d => d.type === 'nomina')
      .reduce((s, d) => s + (d.monthlyTotals[m] || 0), 0)
    const sumSummary = summary.nomina[m] || 0
    const diff = sumDept - sumSummary
    nominaDiffByMonth[m] = diff
    if (Math.abs(diff) > EPS) nominaDepartmentSumMatchesSummary = false
  }

  const otrosDiffByMonth: Record<string, number> = zeroMap(sortedMonths)
  let otrosCategorySumMatchesSummary = true
  for (const m of sortedMonths) {
    const sumCat = byCategory.reduce((s, c) => s + (c.monthlyTotals[m] || 0), 0)
    const sumSummary = summary.otrosIndirectos[m] || 0
    const diff = sumCat - sumSummary
    otrosDiffByMonth[m] = diff
    if (Math.abs(diff) > EPS) otrosCategorySumMatchesSummary = false
  }

  /**
   * manttoByType is measured independently (PO↔WO join), so the diff vs summary.manttoTotal
   * is an informational signal rather than a pass/fail. A non-zero delta usually means
   * POs fell outside the plant scope via WO asset joins or a status filter edge case.
   */
  const manttoTypeDiffByMonth: Record<string, number> = zeroMap(sortedMonths)
  for (const m of sortedMonths) {
    const bucket = manttoByType[m] || { corrective: 0, preventive: 0, inspection: 0, other: 0 }
    const sumByType = bucket.corrective + bucket.preventive + bucket.inspection + bucket.other
    manttoTypeDiffByMonth[m] = sumByType - (summary.manttoTotal[m] || 0)
  }

  // Coverage: how many of the 14 expense_category buckets have at least one row this month.
  // Only real buckets count — 'sin' (uncategorized) doesn't indicate coverage.
  const categoryCoverage: Record<string, number> = zeroMap(sortedMonths)
  for (const m of sortedMonths) {
    let n = 0
    for (const cat of byCategory) {
      if (cat.categoryId === 'sin') continue
      if ((cat.monthlyTotals[m] || 0) > 0) n += 1
    }
    categoryCoverage[m] = n
  }

  return {
    months: sortedMonths,
    summary,
    byCategory,
    byDepartment,
    byPlant,
    manttoByType,
    categoryCoverage,
    dataFreshness: {
      manualAdjustments: {
        lastUpdatedAt: manualFreshness.lastUpdatedAt,
        rowCountByMonth: manualFreshness.rowCountByMonth,
      },
      autoconsumo: {
        lastPeriodWithData: autoconsumoLastPeriod,
      },
    },
    reconciliation: {
      nominaDepartmentSumMatchesSummary,
      otrosCategorySumMatchesSummary,
      otrosDiffByMonth,
      nominaDiffByMonth,
      manttoTypeDiffByMonth,
    },
  }
}
