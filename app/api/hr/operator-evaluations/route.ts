import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext, canAccessRHReporting } from '@/lib/auth/server-authorization'
import type { OperatorEvaluationEventType } from '@/lib/hr/operator-evaluation-events'

const MAX_LIMIT = 500

const VALID_EVENT_TYPES = new Set<OperatorEvaluationEventType>([
  'punctuality',
  'cleanliness_weekly',
  'cleanliness_closure',
  'security_talk',
])

export type OperatorEvaluationEventResponse = {
  id: string
  plant_id: string
  operator_id: string
  operator_name: string | null
  employee_code: string | null
  event_type: OperatorEvaluationEventType
  event_date: string
  period_year: number | null
  period_month: number | null
  status: string
  source_schedule_id: string | null
  source_completion_id: string | null
  section_id: string | null
  reason: string | null
  evidence: unknown
  metadata: unknown
  created_at: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor || !canAccessRHReporting(actor)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const plantId = searchParams.get('plant_id')
    const operatorId = searchParams.get('operator_id')
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')
    const eventType = searchParams.get('event_type')
    const limitParam = searchParams.get('limit')

    if (eventType && !VALID_EVENT_TYPES.has(eventType as OperatorEvaluationEventType)) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
    }

    const limit = Math.min(
      Math.max(parseInt(limitParam ?? String(MAX_LIMIT), 10) || MAX_LIMIT, 1),
      MAX_LIMIT
    )

    let query = supabase
      .from('operator_evaluation_events')
      .select(
        `
        id,
        plant_id,
        operator_id,
        event_type,
        event_date,
        period_year,
        period_month,
        status,
        source_schedule_id,
        source_completion_id,
        section_id,
        reason,
        evidence,
        metadata,
        created_at,
        profiles:operator_id (
          nombre,
          apellido,
          employee_code
        )
      `
      )
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (plantId) query = query.eq('plant_id', plantId)
    if (operatorId) query = query.eq('operator_id', operatorId)
    if (yearParam) {
      const year = parseInt(yearParam, 10)
      if (!Number.isFinite(year)) {
        return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
      }
      query = query.eq('period_year', year)
    }
    if (monthParam) {
      const month = parseInt(monthParam, 10)
      if (!Number.isFinite(month) || month < 1 || month > 12) {
        return NextResponse.json({ error: 'Invalid month' }, { status: 400 })
      }
      query = query.eq('period_month', month)
    }
    if (eventType) query = query.eq('event_type', eventType)

    const { data, error } = await query

    if (error) {
      console.error('[operator-evaluations] query', error)
      return NextResponse.json(
        { error: 'Error al obtener eventos de evaluación' },
        { status: 500 }
      )
    }

    const events: OperatorEvaluationEventResponse[] = (data ?? []).map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const nombre = profile?.nombre ?? ''
      const apellido = profile?.apellido ?? ''
      const operatorName = `${nombre} ${apellido}`.trim() || null

      return {
        id: row.id,
        plant_id: row.plant_id,
        operator_id: row.operator_id,
        operator_name: operatorName,
        employee_code: profile?.employee_code ?? null,
        event_type: row.event_type as OperatorEvaluationEventType,
        event_date: row.event_date,
        period_year: row.period_year,
        period_month: row.period_month,
        status: row.status,
        source_schedule_id: row.source_schedule_id,
        source_completion_id: row.source_completion_id,
        section_id: row.section_id,
        reason: row.reason,
        evidence: row.evidence,
        metadata: row.metadata,
        created_at: row.created_at,
      }
    })

    return NextResponse.json({
      events,
      total: events.length,
      limit,
    })
  } catch (error) {
    console.error('[operator-evaluations] unexpected', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
