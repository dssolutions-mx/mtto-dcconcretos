import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSecurityTalkEventRows } from '@/lib/hr/operator-evaluation-events'
import type { SecurityTalkData } from '@/types'

export type SecurityTalkEventRow = {
  id: string
  operator_id: string
  operator_name: string
  employee_code: string | null
  plant_id: string
  plant_name: string
  event_date: string
  topic: string | null
  reflection: string | null
  evidence: unknown
  source_completion_id: string
}

export type SecurityTalkSessionAttendee = {
  operator_id: string
  operator_name: string
  employee_code: string | null
}

export type SecurityTalkSession = {
  source_completion_id: string
  event_date: string
  plant_id: string
  plant_name: string
  topic: string | null
  reflection: string | null
  evidence: unknown
  attendees: SecurityTalkSessionAttendee[]
  attendee_count: number
}

export type SecurityTalkProductionDay = {
  operator_id: string
  operator_name: string
  employee_code: string | null
  plant_id: string
  plant_name: string
  event_date: string
}

export type SecurityTalkOperatorAttendance = {
  operator_id: string
  operator_name: string
  employee_code: string | null
  plant_id: string
  plant_name: string
  production_days: number
  talks_attended: number
  gap_days: number
  attended_dates: string[]
  missed_dates: string[]
}

export type SecurityTalkReportsSummary = {
  talks_logged: number
  unique_production_days_with_talk: number
  attendance_rate_pct: number | null
  operators_with_gaps: number
  total_production_days: number
}

export type SecurityTalkProfileMeta = {
  operator_name: string
  employee_code: string | null
}

export type SecurityTalkCompletionFallback = {
  id: string
  schedule_id: string | null
  asset_id: string | null
  completion_date: string
  security_data: Record<string, SecurityTalkData>
  plant_id: string
  scheduled_day: string | null
  scheduled_date: string | null
  primary_operator_id?: string | null
}

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map((part) => parseInt(part, 10))
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().split('T')[0]
}

export function resolveSecurityTalkEventDate(input: {
  scheduled_day?: string | null
  scheduled_date?: string | null
  completion_date?: string | null
}): string {
  if (input.scheduled_day) return input.scheduled_day
  if (input.scheduled_date) return String(input.scheduled_date).split('T')[0]
  if (input.completion_date) return String(input.completion_date).split('T')[0]
  return new Date().toISOString().split('T')[0]
}

export function hasNonEmptySecurityData(
  securityData: Record<string, SecurityTalkData> | null | undefined
): securityData is Record<string, SecurityTalkData> {
  if (!securityData || typeof securityData !== 'object') return false
  return Object.values(securityData).some((section) => {
    if (!section || typeof section !== 'object') return false
    const attendees = section.attendees ?? []
    if (attendees.length > 0) return true
    if (section.attendance === true) return true
    if (section.topic?.trim()) return true
    if (section.reflection?.trim()) return true
    return (section.evidence?.length ?? 0) > 0
  })
}

export function buildFallbackSecurityTalkEventRows(
  completion: SecurityTalkCompletionFallback,
  plantNameById: Map<string, string>,
  profileByOperatorId: Map<string, SecurityTalkProfileMeta>
): SecurityTalkEventRow[] {
  if (!hasNonEmptySecurityData(completion.security_data)) return []

  const eventDate = resolveSecurityTalkEventDate({
    scheduled_day: completion.scheduled_day,
    scheduled_date: completion.scheduled_date,
    completion_date: completion.completion_date,
  })

  const rawRows = buildSecurityTalkEventRows(
    completion.plant_id,
    {
      id: completion.id,
      schedule_id: completion.schedule_id ?? completion.id,
      event_date: eventDate,
      asset_id: completion.asset_id,
    },
    completion.security_data,
    completion.primary_operator_id
  )

  return rawRows.map((row) => {
    const profile = profileByOperatorId.get(row.operator_id)
    return {
      id: `fallback:${completion.id}:${row.operator_id}`,
      operator_id: row.operator_id,
      operator_name: profile?.operator_name ?? 'Operador',
      employee_code: profile?.employee_code ?? null,
      plant_id: row.plant_id,
      plant_name: plantNameById.get(row.plant_id) ?? '—',
      event_date: row.event_date,
      topic: (row.metadata as { topic?: string | null } | null)?.topic ?? null,
      reflection: (row.metadata as { reflection?: string | null } | null)?.reflection ?? null,
      evidence: row.evidence ?? null,
      source_completion_id: completion.id,
    }
  })
}

/**
 * Prefer denormalized events; fill gaps from completed_checklists.security_data.
 */
export function mergeSecurityTalkEventRows(
  eventRows: SecurityTalkEventRow[],
  fallbackRows: SecurityTalkEventRow[]
): SecurityTalkEventRow[] {
  const coveredCompletionIds = new Set(
    eventRows.map((row) => row.source_completion_id).filter(Boolean)
  )
  const coveredKeys = new Set(
    eventRows.map((row) => `${row.source_completion_id}:${row.operator_id}`)
  )

  const merged = [...eventRows]
  for (const row of fallbackRows) {
    if (coveredCompletionIds.has(row.source_completion_id)) continue
    const key = `${row.source_completion_id}:${row.operator_id}`
    if (coveredKeys.has(key)) continue
    merged.push(row)
    coveredKeys.add(key)
  }

  return merged.sort((a, b) => {
    const dateCmp = b.event_date.localeCompare(a.event_date)
    if (dateCmp !== 0) return dateCmp
    return a.operator_name.localeCompare(b.operator_name, 'es')
  })
}

export async function fetchSecurityTalkCompletionFallbacks(
  supabase: SupabaseClient,
  params: {
    plantIds: string[]
    from: string
    to: string
    operatorId?: string | null
  }
): Promise<SecurityTalkCompletionFallback[]> {
  const { plantIds, from, to, operatorId } = params
  if (plantIds.length === 0) return []

  const { data: plantAssets, error: assetsError } = await supabase
    .from('assets')
    .select('id')
    .in('plant_id', plantIds)
    .eq('status', 'operational')

  if (assetsError) {
    console.error('[security-talk-reports] fallback assets', assetsError)
    return []
  }

  const assetIds = (plantAssets ?? []).map((asset) => asset.id).filter(Boolean)
  if (assetIds.length === 0) return []

  // Loose completion_date window so late syncs still match scheduled_day in-period.
  const paddedFrom = shiftDateKey(from, -7)
  const paddedTo = shiftDateKey(to, 7)

  const { data, error } = await supabase
    .from('completed_checklists')
    .select(
      `
      id,
      schedule_id,
      asset_id,
      completion_date,
      security_data,
      assets!inner(plant_id),
      checklist_schedules(scheduled_day, scheduled_date)
    `
    )
    .in('asset_id', assetIds)
    .not('security_data', 'is', null)
    .gte('completion_date', `${paddedFrom}T00:00:00`)
    .lte('completion_date', `${paddedTo}T23:59:59.999`)

  if (error) {
    console.error('[security-talk-reports] fallback completions', error)
    return []
  }

  const results: SecurityTalkCompletionFallback[] = []

  for (const row of data ?? []) {
    const securityData = row.security_data as Record<string, SecurityTalkData> | null
    if (!hasNonEmptySecurityData(securityData)) continue

    const asset = Array.isArray(row.assets) ? row.assets[0] : row.assets
    const plantId = (asset as { plant_id?: string | null } | null)?.plant_id
    if (!plantId || !plantIds.includes(plantId)) continue

    const schedule = Array.isArray(row.checklist_schedules)
      ? row.checklist_schedules[0]
      : row.checklist_schedules
    const eventDate = resolveSecurityTalkEventDate({
      scheduled_day: (schedule as { scheduled_day?: string | null } | null)?.scheduled_day,
      scheduled_date: (schedule as { scheduled_date?: string | null } | null)?.scheduled_date,
      completion_date: row.completion_date,
    })

    if (eventDate < from || eventDate > to) continue

    const completion: SecurityTalkCompletionFallback = {
      id: row.id,
      schedule_id: row.schedule_id,
      asset_id: row.asset_id,
      completion_date: row.completion_date,
      security_data: securityData,
      plant_id: plantId,
      scheduled_day: (schedule as { scheduled_day?: string | null } | null)?.scheduled_day ?? null,
      scheduled_date: (schedule as { scheduled_date?: string | null } | null)?.scheduled_date ?? null,
    }

    if (operatorId) {
      const rawRows = buildSecurityTalkEventRows(
        plantId,
        {
          id: completion.id,
          schedule_id: completion.schedule_id ?? completion.id,
          event_date: eventDate,
          asset_id: completion.asset_id,
        },
        securityData
      )
      if (!rawRows.some((eventRow) => eventRow.operator_id === operatorId)) continue
    }

    results.push(completion)
  }

  return results
}

export async function resolvePrimaryOperatorIdsByAsset(
  supabase: SupabaseClient,
  assetIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (assetIds.length === 0) return map

  const { data, error } = await supabase
    .from('asset_operators_full')
    .select('asset_id, operator_id, assignment_type, status')
    .in('asset_id', assetIds)
    .eq('status', 'active')

  if (error) {
    console.error('[security-talk-reports] asset_operators_full', error)
    return map
  }

  const byAsset = new Map<string, Array<{ operator_id: string; assignment_type?: string | null }>>()
  for (const row of data ?? []) {
    if (!row.asset_id || !row.operator_id) continue
    const bucket = byAsset.get(row.asset_id) ?? []
    bucket.push(row)
    byAsset.set(row.asset_id, bucket)
  }

  for (const [assetId, rows] of byAsset) {
    const primary = rows.find((row) => row.assignment_type === 'primary') ?? rows[0]
    if (primary?.operator_id) map.set(assetId, primary.operator_id)
  }

  return map
}

export async function fetchSecurityTalkProfileMeta(
  supabase: SupabaseClient,
  operatorIds: string[]
): Promise<Map<string, SecurityTalkProfileMeta>> {
  const map = new Map<string, SecurityTalkProfileMeta>()
  if (operatorIds.length === 0) return map

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, employee_code')
    .in('id', operatorIds)

  if (error) {
    console.error('[security-talk-reports] profiles', error)
    return map
  }

  for (const profile of data ?? []) {
    map.set(profile.id, {
      operator_name: `${profile.nombre ?? ''} ${profile.apellido ?? ''}`.trim() || 'Operador',
      employee_code: profile.employee_code ?? null,
    })
  }

  return map
}

export async function buildSecurityTalkRowsFromCompletionFallbacks(
  supabase: SupabaseClient,
  completions: SecurityTalkCompletionFallback[],
  plantNameById: Map<string, string>
): Promise<SecurityTalkEventRow[]> {
  if (completions.length === 0) return []

  const assetIds = [
    ...new Set(completions.map((completion) => completion.asset_id).filter(Boolean) as string[]),
  ]
  const primaryByAsset = await resolvePrimaryOperatorIdsByAsset(supabase, assetIds)

  const operatorIds = new Set<string>()
  for (const completion of completions) {
    completion.primary_operator_id =
      (completion.asset_id ? primaryByAsset.get(completion.asset_id) : null) ?? null
    const rows = buildFallbackSecurityTalkEventRows(completion, plantNameById, new Map())
    for (const row of rows) operatorIds.add(row.operator_id)
  }

  const profileByOperatorId = await fetchSecurityTalkProfileMeta(supabase, [...operatorIds])
  const allRows: SecurityTalkEventRow[] = []

  for (const completion of completions) {
    allRows.push(
      ...buildFallbackSecurityTalkEventRows(completion, plantNameById, profileByOperatorId)
    )
  }

  return allRows
}

export function aggregateSecurityTalkSessions(
  rows: SecurityTalkEventRow[]
): SecurityTalkSession[] {
  const byCompletion = new Map<string, SecurityTalkSession>()

  for (const row of rows) {
    if (!row.source_completion_id) continue

    let session = byCompletion.get(row.source_completion_id)
    if (!session) {
      session = {
        source_completion_id: row.source_completion_id,
        event_date: row.event_date,
        plant_id: row.plant_id,
        plant_name: row.plant_name,
        topic: row.topic,
        reflection: row.reflection,
        evidence: row.evidence,
        attendees: [],
        attendee_count: 0,
      }
      byCompletion.set(row.source_completion_id, session)
    }

    session.attendees.push({
      operator_id: row.operator_id,
      operator_name: row.operator_name,
      employee_code: row.employee_code,
    })
    session.attendee_count = session.attendees.length
  }

  return [...byCompletion.values()].sort((a, b) => {
    const dateCmp = b.event_date.localeCompare(a.event_date)
    if (dateCmp !== 0) return dateCmp
    return a.plant_name.localeCompare(b.plant_name, 'es')
  })
}

export function aggregateSecurityTalkOperatorAttendance(
  talkRows: SecurityTalkEventRow[],
  productionDays: SecurityTalkProductionDay[]
): SecurityTalkOperatorAttendance[] {
  const attendedDatesByOperator = new Map<string, Set<string>>()
  const operatorMeta = new Map<
    string,
    {
      operator_name: string
      employee_code: string | null
      plant_id: string
      plant_name: string
    }
  >()

  for (const row of talkRows) {
    if (!attendedDatesByOperator.has(row.operator_id)) {
      attendedDatesByOperator.set(row.operator_id, new Set())
    }
    attendedDatesByOperator.get(row.operator_id)!.add(row.event_date)
    operatorMeta.set(row.operator_id, {
      operator_name: row.operator_name,
      employee_code: row.employee_code,
      plant_id: row.plant_id,
      plant_name: row.plant_name,
    })
  }

  const productionDatesByOperator = new Map<string, Set<string>>()
  for (const day of productionDays) {
    if (!productionDatesByOperator.has(day.operator_id)) {
      productionDatesByOperator.set(day.operator_id, new Set())
    }
    productionDatesByOperator.get(day.operator_id)!.add(day.event_date)
    if (!operatorMeta.has(day.operator_id)) {
      operatorMeta.set(day.operator_id, {
        operator_name: day.operator_name,
        employee_code: day.employee_code,
        plant_id: day.plant_id,
        plant_name: day.plant_name,
      })
    }
  }

  const operatorIds = new Set([
    ...attendedDatesByOperator.keys(),
    ...productionDatesByOperator.keys(),
  ])

  const results: SecurityTalkOperatorAttendance[] = []

  for (const operatorId of operatorIds) {
    const meta = operatorMeta.get(operatorId)
    if (!meta) continue

    const productionDates = [...(productionDatesByOperator.get(operatorId) ?? [])].sort()
    const attendedDates = [...(attendedDatesByOperator.get(operatorId) ?? [])]
      .filter((date) => productionDates.includes(date))
      .sort()
    const missedDates = productionDates.filter(
      (date) => !attendedDatesByOperator.get(operatorId)?.has(date)
    )

    results.push({
      operator_id: operatorId,
      operator_name: meta.operator_name,
      employee_code: meta.employee_code,
      plant_id: meta.plant_id,
      plant_name: meta.plant_name,
      production_days: productionDates.length,
      talks_attended: attendedDates.length,
      gap_days: missedDates.length,
      attended_dates: attendedDates,
      missed_dates: missedDates,
    })
  }

  return results.sort((a, b) => a.operator_name.localeCompare(b.operator_name, 'es'))
}

export function computeSecurityTalkSummary(
  sessions: SecurityTalkSession[],
  operatorAttendance: SecurityTalkOperatorAttendance[]
): SecurityTalkReportsSummary {
  const uniqueDaysWithTalk = new Set(
    sessions.map((session) => `${session.plant_id}:${session.event_date}`)
  )

  const totalProductionDays = operatorAttendance.reduce(
    (sum, op) => sum + op.production_days,
    0
  )
  const totalAttended = operatorAttendance.reduce((sum, op) => sum + op.talks_attended, 0)
  const operatorsWithGaps = operatorAttendance.filter((op) => op.gap_days > 0).length

  const attendanceRatePct =
    totalProductionDays > 0
      ? Math.round((totalAttended / totalProductionDays) * 1000) / 10
      : null

  return {
    talks_logged: sessions.length,
    unique_production_days_with_talk: uniqueDaysWithTalk.size,
    attendance_rate_pct: attendanceRatePct,
    operators_with_gaps: operatorsWithGaps,
    total_production_days: totalProductionDays,
  }
}
