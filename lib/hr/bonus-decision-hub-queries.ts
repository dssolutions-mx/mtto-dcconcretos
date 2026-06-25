import type { SupabaseClient } from '@supabase/supabase-js'
import type { OperatorSeed } from '@/lib/hr/bonus-decision-summary'
import { buildPlantOperationsRoster } from '@/lib/hr/plant-operations-roster'

export async function resolvePlantIds(
  supabase: SupabaseClient,
  filters: { businessUnitId?: string | null; plantId?: string | null }
): Promise<Array<{ id: string; name: string; business_unit_id: string | null }>> {
  let query = supabase.from('plants').select('id, name, business_unit_id')

  if (filters.plantId && filters.plantId !== 'all') {
    query = query.eq('id', filters.plantId)
  } else if (filters.businessUnitId && filters.businessUnitId !== 'all') {
    query = query.eq('business_unit_id', filters.businessUnitId)
  }

  const { data, error } = await query.order('name')
  if (error) {
    console.error('[bonus-decision-hub] plants', error)
    throw error
  }
  return data ?? []
}

export async function fetchOperatorsForPlants(
  supabase: SupabaseClient,
  plantIds: string[],
  plantNameById?: Map<string, string>
): Promise<OperatorSeed[]> {
  if (plantIds.length === 0) return []

  const byOperator = new Map<string, OperatorSeed>()

  for (const plantId of plantIds) {
    const roster = await buildPlantOperationsRoster(supabase, plantId)
    const plantName = plantNameById?.get(plantId) ?? '—'

    for (const op of roster) {
      if (byOperator.has(op.id)) continue
      byOperator.set(op.id, {
        operator_id: op.id,
        operator_name: `${op.nombre} ${op.apellido}`.trim() || 'Operador',
        employee_code: op.employee_code ?? null,
        plant_id: plantId,
        plant_name: plantName,
      })
    }
  }

  return [...byOperator.values()]
}

export type EvaluationEventRecord = {
  operator_id: string
  plant_id: string
  event_type: string
  event_date: string
  status: string
  period_year: number | null
  period_month: number | null
  metadata: Record<string, unknown> | null
  reason: string | null
  evidence: unknown
  id: string
}

export async function fetchEvaluationEventsForPeriod(
  supabase: SupabaseClient,
  plantIds: string[],
  period: { year: number; month: number; from: string; to: string }
): Promise<EvaluationEventRecord[]> {
  if (plantIds.length === 0) return []

  const { data: datedEvents, error: datedError } = await supabase
    .from('operator_evaluation_events')
    .select(
      'id, operator_id, plant_id, event_type, event_date, status, period_year, period_month, metadata, reason, evidence'
    )
    .in('plant_id', plantIds)
    .in('event_type', ['punctuality', 'cleanliness_weekly', 'security_talk'])
    .gte('event_date', period.from)
    .lte('event_date', period.to)

  if (datedError) {
    console.error('[bonus-decision-hub] dated events', datedError)
    throw datedError
  }

  const { data: closureEvents, error: closureError } = await supabase
    .from('operator_evaluation_events')
    .select(
      'id, operator_id, plant_id, event_type, event_date, status, period_year, period_month, metadata, reason, evidence'
    )
    .in('plant_id', plantIds)
    .eq('event_type', 'cleanliness_closure')
    .eq('period_year', period.year)
    .eq('period_month', period.month)

  if (closureError) {
    console.error('[bonus-decision-hub] closure events', closureError)
    throw closureError
  }

  const merged = [...(datedEvents ?? []), ...(closureEvents ?? [])]
  return merged.map((row) => ({
    id: row.id,
    operator_id: row.operator_id,
    plant_id: row.plant_id,
    event_type: row.event_type,
    event_date: row.event_date,
    status: row.status,
    period_year: row.period_year,
    period_month: row.period_month,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    reason: row.reason,
    evidence: row.evidence,
  }))
}
