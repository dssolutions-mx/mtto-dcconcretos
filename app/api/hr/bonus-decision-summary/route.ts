import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext, canAccessRHReporting } from '@/lib/auth/server-authorization'
import {
  aggregateBonusPaySheetRows,
  monthDateKeysUTC,
  summarizeBonusPaySheet,
} from '@/lib/hr/bonus-decision-summary'
import {
  fetchEvaluationEventsForPeriod,
  fetchOperatorsForPlants,
  resolvePlantIds,
} from '@/lib/hr/bonus-decision-hub-queries'
import type { BonusDecisionSummaryPayload } from '@/types/bonus-decision-hub'

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

    const plants = await resolvePlantIds(supabase, {
      businessUnitId,
      plantId,
    })

    if (plants.length === 0) {
      const empty: BonusDecisionSummaryPayload = {
        year: period.year,
        month: period.month,
        plant_id: plantId && plantId !== 'all' ? plantId : null,
        business_unit_id: businessUnitId && businessUnitId !== 'all' ? businessUnitId : null,
        rows: [],
        summary: {
          total_operators: 0,
          closure_completed: 0,
          closure_eligible: 0,
          avg_punctuality_pct: null,
          avg_cleanliness_pass_rate: null,
        },
      }
      return NextResponse.json(empty)
    }

    const plantIds = plants.map((p) => p.id)
    const plantNameById = new Map(plants.map((p) => [p.id, p.name]))
    const { from, to } = monthDateKeysUTC(period.year, period.month)

    const [operators, events] = await Promise.all([
      fetchOperatorsForPlants(supabase, plantIds, plantNameById),
      fetchEvaluationEventsForPeriod(supabase, plantIds, {
        year: period.year,
        month: period.month,
        from,
        to,
      }),
    ])

    const operatorSeeds = operators.map((op) => ({
      ...op,
      plant_name: plantNameById.get(op.plant_id) ?? op.plant_name,
    }))

    const eventSeeds = events.map((e) => ({
      operator_id: e.operator_id,
      plant_id: e.plant_id,
      event_type: e.event_type,
      event_date: e.event_date,
      status: e.status,
      period_year: e.period_year,
      period_month: e.period_month,
      metadata: e.metadata,
    }))

    const rows = aggregateBonusPaySheetRows(operatorSeeds, eventSeeds, period)
    const summary = summarizeBonusPaySheet(rows)

    const payload: BonusDecisionSummaryPayload = {
      year: period.year,
      month: period.month,
      plant_id: plantId && plantId !== 'all' ? plantId : null,
      business_unit_id: businessUnitId && businessUnitId !== 'all' ? businessUnitId : null,
      rows,
      summary,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('[bonus-decision-summary]', error)
    return NextResponse.json({ error: 'Error al obtener la nómina de bonos' }, { status: 500 })
  }
}
