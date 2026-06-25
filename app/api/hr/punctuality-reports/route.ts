import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext, canAccessRHReporting } from '@/lib/auth/server-authorization'
import { monthDateKeysUTC } from '@/lib/hr/bonus-decision-summary'
import { resolvePlantIds } from '@/lib/hr/bonus-decision-hub-queries'
import type { PunctualityOperatorReport, PunctualityReportsPayload } from '@/types/bonus-decision-hub'

function parsePeriod(searchParams: URLSearchParams): { year: number; month: number } | null {
  const now = new Date()
  const year = parseInt(searchParams.get('year') ?? String(now.getUTCFullYear()), 10)
  const month = parseInt(searchParams.get('month') ?? String(now.getUTCMonth() + 1), 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null
  }
  return { year, month }
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
    const period = parsePeriod(searchParams)
    if (!period) {
      return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 })
    }

    const businessUnitId = searchParams.get('business_unit')
    const plantId = searchParams.get('plant')
    const operatorId = searchParams.get('operator_id')

    const plants = await resolvePlantIds(supabase, {
      businessUnitId,
      plantId,
    })
    const plantIds = plants.map((p) => p.id)
    const plantNameById = new Map(plants.map((p) => [p.id, p.name]))

    if (plantIds.length === 0) {
      const empty: PunctualityReportsPayload = {
        year: period.year,
        month: period.month,
        operators: [],
      }
      return NextResponse.json(empty)
    }

    const { from, to } = monthDateKeysUTC(period.year, period.month)

    let query = supabase
      .from('operator_evaluation_events')
      .select(
        `
        id,
        operator_id,
        plant_id,
        event_date,
        status,
        reason,
        source_completion_id,
        profiles:operator_id ( nombre, apellido, employee_code )
      `
      )
      .in('plant_id', plantIds)
      .eq('event_type', 'punctuality')
      .gte('event_date', from)
      .lte('event_date', to)
      .order('event_date', { ascending: true })

    if (operatorId) query = query.eq('operator_id', operatorId)

    const { data, error } = await query
    if (error) {
      console.error('[punctuality-reports]', error)
      return NextResponse.json({ error: 'Error al obtener reportes de puntualidad' }, { status: 500 })
    }

    const byOperator = new Map<string, PunctualityOperatorReport>()

    for (const row of data ?? []) {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const operatorName =
        `${profile?.nombre ?? ''} ${profile?.apellido ?? ''}`.trim() || 'Operador'

      if (!byOperator.has(row.operator_id)) {
        byOperator.set(row.operator_id, {
          operator_id: row.operator_id,
          operator_name: operatorName,
          employee_code: profile?.employee_code ?? null,
          plant_id: row.plant_id,
          plant_name: plantNameById.get(row.plant_id) ?? '—',
          punctuality_pct: 0,
          days_total: 0,
          days_on_time: 0,
          days_late: 0,
          days_absent: 0,
          days: [],
        })
      }

      const bucket = byOperator.get(row.operator_id)!
      bucket.days.push({
        event_date: row.event_date,
        status: row.status,
        reason: row.reason,
        source_completion_id: row.source_completion_id,
      })
      bucket.days_total += 1
      if (row.status === 'on_time') bucket.days_on_time += 1
      else if (row.status === 'late') bucket.days_late += 1
      else if (row.status === 'absent') bucket.days_absent += 1
    }

    for (const op of byOperator.values()) {
      op.punctuality_pct =
        op.days_total > 0 ? Math.round((op.days_on_time / op.days_total) * 1000) / 10 : 0
    }

    const operators = [...byOperator.values()].sort((a, b) =>
      a.operator_name.localeCompare(b.operator_name, 'es')
    )

    const payload: PunctualityReportsPayload = {
      year: period.year,
      month: period.month,
      operators,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('[punctuality-reports]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
