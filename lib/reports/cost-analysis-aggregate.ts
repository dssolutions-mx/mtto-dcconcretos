import { getExpenseCategoryById, getExpenseCategoryDisplayName } from '@/lib/constants/expense-categories'
import { runIngresosGastosPost } from '@/lib/reports/ingresos-gastos-compute'

export type CostAnalysisMonthKey = string // YYYY-MM

export type CostAnalysisPlantRow = {
  plantId: string
  plantCode: string
  plantName: string
  nomina: Record<CostAnalysisMonthKey, number>
  otrosIndirectos: Record<CostAnalysisMonthKey, number>
  totalCostoOp: Record<CostAnalysisMonthKey, number>
  volume: Record<CostAnalysisMonthKey, number>
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

export type CostAnalysisResponse = {
  months: CostAnalysisMonthKey[]
  summary: {
    nomina: Record<CostAnalysisMonthKey, number>
    otrosIndirectos: Record<CostAnalysisMonthKey, number>
    totalCostoOp: Record<CostAnalysisMonthKey, number>
    totalVolume: Record<CostAnalysisMonthKey, number>
  }
  byCategory: CostAnalysisCategoryRow[]
  byDepartment: CostAnalysisDepartmentRow[]
  byPlant: CostAnalysisPlantRow[]
}

function toPeriodMonth(monthYm: string): string {
  const [y, m] = monthYm.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-01`
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

/**
 * Allocate one manual adjustment to target plants (same rules as ingresos-gastos-compute).
 */
function allocateManualAdjustmentToPlants(params: {
  adj: any
  targetPlantIds: string[]
  /** Full plant list from the same Supabase query as ingresos-gastos (for BU splits). */
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
      summary: {
        nomina: {},
        otrosIndirectos: {},
        totalCostoOp: {},
        totalVolume: {},
      },
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

  const allPlants = plantsData || []
  const targetPlants = plantId
    ? allPlants.filter(p => p.id === plantId)
    : businessUnitId
      ? allPlants.filter(p => p.business_unit_id === businessUnitId)
      : allPlants

  if (targetPlants.length === 0) {
    return {
      months: sortedMonths,
      summary: {
        nomina: Object.fromEntries(sortedMonths.map(m => [m, 0])),
        otrosIndirectos: Object.fromEntries(sortedMonths.map(m => [m, 0])),
        totalCostoOp: Object.fromEntries(sortedMonths.map(m => [m, 0])),
        totalVolume: Object.fromEntries(sortedMonths.map(m => [m, 0])),
      },
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

  const summary = {
    nomina: {} as Record<string, number>,
    otrosIndirectos: {} as Record<string, number>,
    totalCostoOp: {} as Record<string, number>,
    totalVolume: {} as Record<string, number>,
  }
  sortedMonths.forEach(m => {
    summary.nomina[m] = 0
    summary.otrosIndirectos[m] = 0
    summary.totalCostoOp[m] = 0
    summary.totalVolume[m] = 0
  })

  const plantIdSet = new Set(targetPlants.map(p => p.id))
  const byPlantMap = new Map<string, CostAnalysisPlantRow>()
  for (const p of targetPlants) {
    byPlantMap.set(p.id, {
      plantId: p.id,
      plantCode: p.code || '',
      plantName: p.name || '',
      nomina: Object.fromEntries(sortedMonths.map(m => [m, 0])) as Record<string, number>,
      otrosIndirectos: Object.fromEntries(sortedMonths.map(m => [m, 0])) as Record<string, number>,
      totalCostoOp: Object.fromEntries(sortedMonths.map(m => [m, 0])) as Record<string, number>,
      volume: Object.fromEntries(sortedMonths.map(m => [m, 0])) as Record<string, number>,
    })
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
      | Array<{
          plant_id: string
          nomina_total: number
          otros_indirectos_total: number
          total_costo_op: number
          volumen_concreto: number
        }>
      | undefined

    if (!plantsRow) continue

    for (const row of plantsRow) {
      if (!plantIdSet.has(row.plant_id)) continue
      const pr = byPlantMap.get(row.plant_id)
      if (pr) {
        pr.nomina[monthYm] = Number(row.nomina_total || 0)
        pr.otrosIndirectos[monthYm] = Number(row.otros_indirectos_total || 0)
        pr.totalCostoOp[monthYm] = Number(row.total_costo_op || 0)
        pr.volume[monthYm] = Number(row.volumen_concreto || 0)
      }
      summary.nomina[monthYm] += Number(row.nomina_total || 0)
      summary.otrosIndirectos[monthYm] += Number(row.otros_indirectos_total || 0)
      summary.totalCostoOp[monthYm] += Number(row.total_costo_op || 0)
      summary.totalVolume[monthYm] += Number(row.volumen_concreto || 0)
    }
  }

  const byPlant = Array.from(byPlantMap.values()).sort((a, b) =>
    a.plantCode.localeCompare(b.plantCode, 'es')
  )

  return {
    months: sortedMonths,
    summary,
    byCategory,
    byDepartment,
    byPlant,
  }
}
