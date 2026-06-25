import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext, canAccessRHReporting } from '@/lib/auth/server-authorization'
import {
  aggregateBonusPaySheetRows,
  monthDateKeysUTC,
} from '@/lib/hr/bonus-decision-summary'
import {
  fetchEvaluationEventsForPeriod,
  fetchOperatorsForPlants,
  resolvePlantIds,
} from '@/lib/hr/bonus-decision-hub-queries'
import type { BonusPaySheetRow } from '@/types/bonus-decision-hub'

function parsePeriod(searchParams: URLSearchParams): { year: number; month: number } | null {
  const now = new Date()
  const year = parseInt(searchParams.get('year') ?? String(now.getUTCFullYear()), 10)
  const month = parseInt(searchParams.get('month') ?? String(now.getUTCMonth() + 1), 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null
  }
  return { year, month }
}

function trafficLightLabel(light: BonusPaySheetRow['traffic_light']): string {
  switch (light) {
    case 'green':
      return 'Verde'
    case 'yellow':
      return 'Amarillo'
    case 'red':
      return 'Rojo'
    default:
      return 'Sin datos'
  }
}

function recommendationLabel(rec: BonusPaySheetRow['system_recommendation']): string {
  switch (rec) {
    case 'eligible':
      return 'Apto'
    case 'ineligible':
      return 'No apto'
    default:
      return 'Pendiente'
  }
}

function closureLabel(value: boolean | null): string {
  if (value === true) return 'Sí'
  if (value === false) return 'No'
  return 'Pendiente'
}

function formatPct(value: number | null): string {
  if (value == null) return '—'
  return `${value}%`
}

function escapeCsv(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function rowsToCsv(rows: BonusPaySheetRow[], period: { year: number; month: number }): string {
  const headers = [
    'Año',
    'Mes',
    'Operador',
    'Código',
    'Planta',
    '% Puntualidad',
    '% Limpieza',
    'Cierre oficial',
    'Recomendación sistema',
    'Semáforo',
  ]

  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [
        String(period.year),
        String(period.month),
        escapeCsv(row.operator_name),
        escapeCsv(row.employee_code ?? ''),
        escapeCsv(row.plant_name),
        formatPct(row.punctuality_pct),
        formatPct(row.cleanliness_pass_rate),
        closureLabel(row.closure_official),
        recommendationLabel(row.system_recommendation),
        trafficLightLabel(row.traffic_light),
      ].join(',')
    ),
  ]

  return lines.join('\n')
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
      const csv = rowsToCsv([], period)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="nomina-bonos-${period.year}-${String(period.month).padStart(2, '0')}.csv"`,
        },
      })
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
    const csv = rowsToCsv(rows, period)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="nomina-bonos-${period.year}-${String(period.month).padStart(2, '0')}.csv"`,
      },
    })
  } catch (error) {
    console.error('[bonus-decision-export]', error)
    return NextResponse.json({ error: 'Error al exportar la nómina de bonos' }, { status: 500 })
  }
}
