import type {
  BonusPaySheetRow,
  BonusSystemRecommendation,
  BonusTrafficLight,
} from '@/types/bonus-decision-hub'

export type OperatorSeed = {
  operator_id: string
  operator_name: string
  employee_code: string | null
  plant_id: string
  plant_name: string
}

export type EvaluationEventSeed = {
  operator_id: string
  plant_id: string
  event_type: string
  event_date: string
  status: string
  period_year?: number | null
  period_month?: number | null
  metadata?: Record<string, unknown> | null
}

function roundPct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

export function computeTrafficLight(row: {
  punctuality_pct: number | null
  cleanliness_pass_rate: number | null
  closure_official: boolean | null
  system_recommendation: BonusSystemRecommendation
}): BonusTrafficLight {
  const hasMetrics =
    row.punctuality_pct != null ||
    row.cleanliness_pass_rate != null ||
    row.closure_official != null

  if (!hasMetrics) return 'gray'

  if (row.closure_official === false) return 'red'
  if (row.closure_official === true) return 'green'

  if (row.system_recommendation === 'ineligible') return 'red'
  if (row.system_recommendation === 'eligible') {
    if (row.punctuality_pct != null && row.punctuality_pct < 70) return 'yellow'
    if (row.cleanliness_pass_rate != null && row.cleanliness_pass_rate < 60) return 'yellow'
    return 'green'
  }

  if (
    row.punctuality_pct != null &&
    row.cleanliness_pass_rate != null &&
    row.punctuality_pct >= 85 &&
    row.cleanliness_pass_rate >= 75
  ) {
    return 'green'
  }

  if (
    (row.punctuality_pct != null && row.punctuality_pct < 60) ||
    (row.cleanliness_pass_rate != null && row.cleanliness_pass_rate < 50)
  ) {
    return 'red'
  }

  return 'yellow'
}

export function aggregateBonusPaySheetRows(
  operators: OperatorSeed[],
  events: EvaluationEventSeed[],
  period: { year: number; month: number }
): BonusPaySheetRow[] {
  const operatorMap = new Map<string, OperatorSeed>()
  for (const op of operators) {
    operatorMap.set(op.operator_id, op)
  }

  for (const event of events) {
    if (!operatorMap.has(event.operator_id)) {
      operatorMap.set(event.operator_id, {
        operator_id: event.operator_id,
        operator_name: 'Operador',
        employee_code: null,
        plant_id: event.plant_id,
        plant_name: '—',
      })
    }
  }

  const punctualityByOp = new Map<string, { total: number; onTime: number }>()
  const cleanlinessByOp = new Map<string, { total: number; passed: number }>()
  const closureByOp = new Map<
    string,
    { eligible: boolean; systemSuggested: boolean | null }
  >()

  for (const event of events) {
    if (event.event_type === 'punctuality') {
      const bucket = punctualityByOp.get(event.operator_id) ?? { total: 0, onTime: 0 }
      bucket.total += 1
      if (event.status === 'on_time') bucket.onTime += 1
      punctualityByOp.set(event.operator_id, bucket)
      continue
    }

    if (event.event_type === 'cleanliness_weekly') {
      const bucket = cleanlinessByOp.get(event.operator_id) ?? { total: 0, passed: 0 }
      bucket.total += 1
      if (event.status === 'pass') bucket.passed += 1
      cleanlinessByOp.set(event.operator_id, bucket)
      continue
    }

    if (event.event_type === 'cleanliness_closure') {
      if (event.period_year !== period.year || event.period_month !== period.month) continue
      const meta = event.metadata ?? {}
      const systemSuggested =
        typeof meta.system_suggested_eligible === 'boolean'
          ? meta.system_suggested_eligible
          : null
      closureByOp.set(event.operator_id, {
        eligible: event.status === 'eligible',
        systemSuggested,
      })
    }
  }

  const rows: BonusPaySheetRow[] = []

  for (const op of operatorMap.values()) {
    const punct = punctualityByOp.get(op.operator_id)
    const clean = cleanlinessByOp.get(op.operator_id)
    const closure = closureByOp.get(op.operator_id)

    const punctuality_pct = roundPct(punct?.onTime ?? 0, punct?.total ?? 0)
    const cleanliness_pass_rate = roundPct(clean?.passed ?? 0, clean?.total ?? 0)

    let system_recommendation: BonusSystemRecommendation = 'pending'
    if (closure) {
      if (closure.systemSuggested === true) system_recommendation = 'eligible'
      else if (closure.systemSuggested === false) system_recommendation = 'ineligible'
      else system_recommendation = closure.eligible ? 'eligible' : 'ineligible'
    } else if (cleanliness_pass_rate != null) {
      system_recommendation = cleanliness_pass_rate >= 80 ? 'eligible' : 'ineligible'
    }

    const closure_official = closure ? closure.eligible : null

    const row: BonusPaySheetRow = {
      operator_id: op.operator_id,
      operator_name: op.operator_name,
      employee_code: op.employee_code,
      plant_id: op.plant_id,
      plant_name: op.plant_name,
      punctuality_pct,
      cleanliness_pass_rate,
      closure_official,
      system_recommendation,
      traffic_light: 'gray',
      punctuality_days_total: punct?.total ?? 0,
      punctuality_days_on_time: punct?.onTime ?? 0,
      cleanliness_evals_total: clean?.total ?? 0,
      cleanliness_evals_passed: clean?.passed ?? 0,
    }

    row.traffic_light = computeTrafficLight(row)
    rows.push(row)
  }

  rows.sort((a, b) => {
    const nameCmp = a.operator_name.localeCompare(b.operator_name, 'es')
    if (nameCmp !== 0) return nameCmp
    return (a.employee_code ?? '').localeCompare(b.employee_code ?? '', 'es')
  })

  return rows
}

export function summarizeBonusPaySheet(rows: BonusPaySheetRow[]): {
  total_operators: number
  closure_completed: number
  closure_eligible: number
  avg_punctuality_pct: number | null
  avg_cleanliness_pass_rate: number | null
} {
  const withPunct = rows.filter((r) => r.punctuality_pct != null)
  const withClean = rows.filter((r) => r.cleanliness_pass_rate != null)

  const avg = (values: number[]) =>
    values.length > 0
      ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
      : null

  return {
    total_operators: rows.length,
    closure_completed: rows.filter((r) => r.closure_official != null).length,
    closure_eligible: rows.filter((r) => r.closure_official === true).length,
    avg_punctuality_pct: avg(withPunct.map((r) => r.punctuality_pct as number)),
    avg_cleanliness_pass_rate: avg(withClean.map((r) => r.cleanliness_pass_rate as number)),
  }
}

export function monthDateKeysUTC(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}
