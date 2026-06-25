import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase-server'

import { loadActorContext, canAccessRHReporting } from '@/lib/auth/server-authorization'

import { monthDateKeysUTC } from '@/lib/hr/bonus-decision-summary'

import { resolvePlantIds } from '@/lib/hr/bonus-decision-hub-queries'

import {
  aggregateSecurityTalkOperatorAttendance,
  aggregateSecurityTalkSessions,
  buildSecurityTalkRowsFromCompletionFallbacks,
  computeSecurityTalkSummary,
  fetchSecurityTalkCompletionFallbacks,
  mergeSecurityTalkEventRows,
  type SecurityTalkEventRow,
  type SecurityTalkProductionDay,
} from '@/lib/hr/security-talk-reports'

import type { SecurityTalkReport, SecurityTalkReportsPayload } from '@/types/bonus-decision-hub'

function parsePeriod(searchParams: URLSearchParams): { year: number; month: number } | null {
  const now = new Date()
  const year = parseInt(searchParams.get('year') ?? String(now.getUTCFullYear()), 10)
  const month = parseInt(searchParams.get('month') ?? String(now.getUTCMonth() + 1), 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null
  }
  return { year, month }
}

type ProfileJoin = {
  nombre?: string | null
  apellido?: string | null
  employee_code?: string | null
}

function profileName(profile: ProfileJoin | ProfileJoin[] | null | undefined): {
  operatorName: string
  employeeCode: string | null
} {
  const row = Array.isArray(profile) ? profile[0] : profile
  const operatorName = `${row?.nombre ?? ''} ${row?.apellido ?? ''}`.trim() || 'Operador'
  return { operatorName, employeeCode: row?.employee_code ?? null }
}

function mapTalkRow(
  row: {
    id: string
    operator_id: string
    plant_id: string
    event_date: string
    evidence: unknown
    metadata: unknown
    source_completion_id: string
    profiles: ProfileJoin | ProfileJoin[] | null
  },
  plantNameById: Map<string, string>
): SecurityTalkEventRow {
  const { operatorName, employeeCode } = profileName(row.profiles)
  const meta = (row.metadata as Record<string, unknown> | null) ?? null
  const topic = typeof meta?.topic === 'string' ? meta.topic : null
  const reflection = typeof meta?.reflection === 'string' ? meta.reflection : null

  return {
    id: row.id,
    operator_id: row.operator_id,
    operator_name: operatorName,
    employee_code: employeeCode,
    plant_id: row.plant_id,
    plant_name: plantNameById.get(row.plant_id) ?? '—',
    event_date: row.event_date,
    topic,
    reflection,
    evidence: row.evidence,
    source_completion_id: row.source_completion_id,
  }
}

function toSecurityTalkReport(row: SecurityTalkEventRow): SecurityTalkReport {
  return {
    id: row.id,
    operator_id: row.operator_id,
    operator_name: row.operator_name,
    employee_code: row.employee_code,
    plant_id: row.plant_id,
    plant_name: row.plant_name,
    event_date: row.event_date,
    topic: row.topic,
    reflection: row.reflection,
    evidence: row.evidence,
    source_completion_id: row.source_completion_id,
  }
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
      const empty: SecurityTalkReportsPayload = {
        year: period.year,
        month: period.month,
        talks: [],
        sessions: operatorId ? undefined : [],
        operators: operatorId ? undefined : [],
        summary: operatorId
          ? undefined
          : {
              talks_logged: 0,
              unique_production_days_with_talk: 0,
              attendance_rate_pct: null,
              operators_with_gaps: 0,
              total_production_days: 0,
            },
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
        evidence,
        metadata,
        source_completion_id,
        profiles:operator_id ( nombre, apellido, employee_code )
      `
      )
      .in('plant_id', plantIds)
      .eq('event_type', 'security_talk')
      .gte('event_date', from)
      .lte('event_date', to)
      .order('event_date', { ascending: false })

    if (operatorId) query = query.eq('operator_id', operatorId)

    const { data, error } = await query
    if (error) {
      console.error('[security-talk-reports] events', error)
      return NextResponse.json({ error: 'Error al obtener charlas de seguridad' }, { status: 500 })
    }

    const eventRows = (data ?? []).map((row) => mapTalkRow(row, plantNameById))

    const completionFallbacks = await fetchSecurityTalkCompletionFallbacks(supabase, {
      plantIds,
      from,
      to,
      operatorId,
    })
    const fallbackRows = await buildSecurityTalkRowsFromCompletionFallbacks(
      supabase,
      completionFallbacks,
      plantNameById
    )
    const mergedRows = mergeSecurityTalkEventRows(eventRows, fallbackRows)

    if (fallbackRows.length > 0 && eventRows.length === 0) {
      console.info(
        `[security-talk-reports] using security_data fallback for ${fallbackRows.length} talk row(s) in ${period.year}-${period.month}`
      )
    }

    const talks = mergedRows.map(toSecurityTalkReport)

    if (operatorId) {
      const payload: SecurityTalkReportsPayload = {
        year: period.year,
        month: period.month,
        talks,
      }
      return NextResponse.json(payload)
    }

    let productionDays: SecurityTalkProductionDay[] = []
    const { data: punctualityData, error: punctualityError } = await supabase
      .from('operator_evaluation_events')
      .select(
        `
        operator_id,
        plant_id,
        event_date,
        profiles:operator_id ( nombre, apellido, employee_code )
      `
      )
      .in('plant_id', plantIds)
      .eq('event_type', 'punctuality')
      .gte('event_date', from)
      .lte('event_date', to)

    if (punctualityError) {
      console.error('[security-talk-reports] punctuality', punctualityError)
    } else {
      productionDays = (punctualityData ?? []).map((row) => {
        const { operatorName, employeeCode } = profileName(row.profiles)
        return {
          operator_id: row.operator_id,
          operator_name: operatorName,
          employee_code: employeeCode,
          plant_id: row.plant_id,
          plant_name: plantNameById.get(row.plant_id) ?? '—',
          event_date: row.event_date,
        }
      })
    }

    const sessions = aggregateSecurityTalkSessions(mergedRows)
    const operators = aggregateSecurityTalkOperatorAttendance(mergedRows, productionDays)
    const summary = computeSecurityTalkSummary(sessions, operators)

    const payload: SecurityTalkReportsPayload = {
      year: period.year,
      month: period.month,
      talks,
      sessions,
      operators,
      summary,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('[security-talk-reports]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
