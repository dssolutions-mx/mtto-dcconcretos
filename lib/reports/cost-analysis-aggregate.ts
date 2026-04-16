import { createClient } from '@supabase/supabase-js'
import { getExpenseCategoryById, getExpenseCategoryDisplayName } from '@/lib/constants/expense-categories'
import { runIngresosGastosPost } from '@/lib/reports/ingresos-gastos-compute'

/** Synthetic category for cotizador `plant_indirect_material_costs` (matches ingresos-gastos otros + autoconsumo). */
const AUTOCATEGORY_ID = 'autoconsumo'
const AUTOCATEGORY_NAME = 'Instalación / Autoconsumo'
const AUTOSUBCATEGORY = 'Concreto sin ingresos (autoconsumo, pruebas, consumo interno)'

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

export type CostAnalysisResponse = {
  months: CostAnalysisMonthKey[]
  summary: CostAnalysisSummary
  byCategory: CostAnalysisCategoryRow[]
  byDepartment: CostAnalysisDepartmentRow[]
  byPlant: CostAnalysisPlantRow[]
  reconciliation?: {
    nominaDepartmentSumMatchesSummary: boolean
    otrosCategorySumMatchesSummary: boolean
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
): Promise<Record<string, number>> {
  const out: Record<string, number> = Object.fromEntries(monthYms.map(m => [m, 0]))
  if (plantCodes.length === 0) return out
  if (!process.env.COTIZADOR_SUPABASE_URL || !process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY) {
    return out
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
        out[monthYm] += Number((row as { amount?: unknown }).amount || 0)
      }
    } catch (e) {
      console.error('cost-analysis autoconsumo fetch error:', e)
    }
  }
  return out
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
  const autoconsumoByMonth = await fetchAutoconsumoTotalsByMonth(sortedMonths, plantCodesForAuto)
  const hasAnyAutoconsumo = sortedMonths.some(m => (autoconsumoByMonth[m] || 0) > 0)
  if (hasAnyAutoconsumo) {
    if (!categoryMonthly.has(AUTOCATEGORY_ID)) categoryMonthly.set(AUTOCATEGORY_ID, new Map())
    const acm = categoryMonthly.get(AUTOCATEGORY_ID)!
    if (!subcatMonthly.has(AUTOCATEGORY_ID)) subcatMonthly.set(AUTOCATEGORY_ID, new Map())
    const smRoot = subcatMonthly.get(AUTOCATEGORY_ID)!
    if (!smRoot.has(AUTOSUBCATEGORY)) smRoot.set(AUTOSUBCATEGORY, new Map())
    const subMap = smRoot.get(AUTOSUBCATEGORY)!

    const autoDeptKey = `otros::${AUTOCATEGORY_NAME} - General`
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
      const categoryName = catObj ? getExpenseCategoryDisplayName(catObj) : categoryId === AUTOCATEGORY_ID ? AUTOCATEGORY_NAME : 'Sin Categoría'
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
    .sort((a, b) => {
      if (a.categoryId === AUTOCATEGORY_ID) return 1
      if (b.categoryId === AUTOCATEGORY_ID) return -1
      return a.categoryId.localeCompare(b.categoryId, undefined, { numeric: true })
    })

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
  let nominaDepartmentSumMatchesSummary = true
  for (const m of sortedMonths) {
    const sumDept = byDepartment
      .filter(d => d.type === 'nomina')
      .reduce((s, d) => s + (d.monthlyTotals[m] || 0), 0)
    const sumSummary = summary.nomina[m] || 0
    if (Math.abs(sumDept - sumSummary) > EPS) {
      nominaDepartmentSumMatchesSummary = false
      break
    }
  }

  let otrosCategorySumMatchesSummary = true
  for (const m of sortedMonths) {
    const sumCat = byCategory.reduce((s, c) => s + (c.monthlyTotals[m] || 0), 0)
    const sumSummary = summary.otrosIndirectos[m] || 0
    if (Math.abs(sumCat - sumSummary) > EPS) {
      otrosCategorySumMatchesSummary = false
      break
    }
  }

  return {
    months: sortedMonths,
    summary,
    byCategory,
    byDepartment,
    byPlant,
    reconciliation: {
      nominaDepartmentSumMatchesSummary,
      otrosCategorySumMatchesSummary,
    },
  }
}
