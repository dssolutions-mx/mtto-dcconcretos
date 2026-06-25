import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateCleanlinessEvaluationByTemplate,
  isCleanlinessSection,
} from '@/lib/hr/cleanliness-prefill'
import { validateBonusClosureSectionPayload } from '@/lib/checklist/bonus-closure-validation'
import { validatePunctualitySectionPayload } from '@/lib/checklist/punctuality-validation'
import type {
  BonusClosureSectionData,
  PlantOperationsData,
  PunctualitySectionData,
  SecurityTalkData,
} from '@/types'

export type OperatorEvaluationEventType =
  | 'punctuality'
  | 'cleanliness_weekly'
  | 'cleanliness_closure'
  | 'security_talk'

export type OperatorEvaluationCompletion = {
  id: string
  schedule_id: string
  /** Calendar date for daily/weekly events (YYYY-MM-DD). */
  event_date: string
  asset_id?: string | null
  template_version_id?: string | null
}

export type OperatorEvaluationEventRow = {
  plant_id: string
  operator_id: string
  event_type: OperatorEvaluationEventType
  event_date: string
  period_year?: number | null
  period_month?: number | null
  status: string
  source_schedule_id: string
  source_completion_id: string
  section_id?: string | null
  reason?: string | null
  evidence?: unknown
  metadata?: unknown
}

export type CompletedItemForEvents = {
  item_id: string
  status?: string
  description?: string | null
  section_type?: string | null
}

function hasCleanlinessBonusItems(items: CompletedItemForEvents[] | undefined): boolean {
  return (items ?? []).some((item) => item.section_type === 'cleanliness_bonus')
}

export function buildPunctualityEventRows(
  plantId: string,
  completion: OperatorEvaluationCompletion,
  plantOperationsData: PlantOperationsData | Record<string, unknown> | null | undefined
): OperatorEvaluationEventRow[] {
  if (!plantOperationsData || typeof plantOperationsData !== 'object') return []

  const rows: OperatorEvaluationEventRow[] = []

  for (const [sectionId, raw] of Object.entries(plantOperationsData)) {
    if (!validatePunctualitySectionPayload(raw)) continue
    const data = raw as PunctualitySectionData
    if (data.had_production === false) continue
    if (data.had_production !== true) continue

    for (const entry of data.entries ?? []) {
      if (!entry.operator_id) continue
      rows.push({
        plant_id: plantId,
        operator_id: entry.operator_id,
        event_type: 'punctuality',
        event_date: completion.event_date,
        status: entry.status,
        source_schedule_id: completion.schedule_id,
        source_completion_id: completion.id,
        section_id: sectionId,
        reason: entry.notes?.trim() || null,
        metadata: {
          had_production: data.had_production,
        },
      })
    }
  }

  return rows
}

export function buildBonusClosureEventRows(
  plantId: string,
  completion: OperatorEvaluationCompletion,
  plantOperationsData: PlantOperationsData | Record<string, unknown> | null | undefined
): OperatorEvaluationEventRow[] {
  if (!plantOperationsData || typeof plantOperationsData !== 'object') return []

  const rows: OperatorEvaluationEventRow[] = []

  for (const [sectionId, raw] of Object.entries(plantOperationsData)) {
    if (!validateBonusClosureSectionPayload(raw)) continue
    const data = raw as BonusClosureSectionData

    for (const decision of data.decisions ?? []) {
      if (!decision.operator_id) continue
      rows.push({
        plant_id: plantId,
        operator_id: decision.operator_id,
        event_type: 'cleanliness_closure',
        event_date: completion.event_date,
        period_year: data.period_year ?? null,
        period_month: data.period_month ?? null,
        status: decision.eligible ? 'eligible' : 'ineligible',
        source_schedule_id: completion.schedule_id,
        source_completion_id: completion.id,
        section_id: sectionId,
        reason: decision.ineligible_reason?.trim() || null,
        evidence: decision.evidence ?? null,
        metadata: {
          weekly_pass_rate: decision.weekly_pass_rate,
          evaluation_ids: decision.evaluation_ids,
          system_suggested_eligible: decision.system_suggested_eligible,
          employee_code: decision.employee_code ?? null,
        },
      })
    }
  }

  return rows
}

export function buildSecurityTalkEventRows(
  plantId: string,
  completion: OperatorEvaluationCompletion,
  securityData: Record<string, SecurityTalkData> | null | undefined,
  primaryOperatorId?: string | null
): OperatorEvaluationEventRow[] {
  if (!securityData || typeof securityData !== 'object') return []

  const rows: OperatorEvaluationEventRow[] = []

  for (const [sectionId, data] of Object.entries(securityData)) {
    const attendees = data.attendees ?? []
    if (attendees.length > 0) {
      for (const operatorId of attendees) {
        if (!operatorId) continue
        rows.push({
          plant_id: plantId,
          operator_id: operatorId,
          event_type: 'security_talk',
          event_date: completion.event_date,
          status: 'attended',
          source_schedule_id: completion.schedule_id,
          source_completion_id: completion.id,
          section_id: sectionId,
          evidence: data.evidence ?? null,
          metadata: {
            topic: data.topic ?? null,
            reflection: data.reflection ?? null,
          },
        })
      }
      continue
    }

    if (data.attendance === true && primaryOperatorId) {
      rows.push({
        plant_id: plantId,
        operator_id: primaryOperatorId,
        event_type: 'security_talk',
        event_date: completion.event_date,
        status: 'attended',
        source_schedule_id: completion.schedule_id,
        source_completion_id: completion.id,
        section_id: sectionId,
        evidence: data.evidence ?? null,
        metadata: {
          topic: data.topic ?? null,
          reflection: data.reflection ?? null,
          attendance_mode: 'operator',
        },
      })
    }
  }

  return rows
}

export function buildCleanlinessWeeklyEventRow(
  plantId: string,
  completion: OperatorEvaluationCompletion,
  operatorId: string,
  evaluation: {
    passed_both: boolean
    overall_score: number
    interior_status: string
    exterior_status: string
  },
  sectionIds: string[]
): OperatorEvaluationEventRow {
  return {
    plant_id: plantId,
    operator_id: operatorId,
    event_type: 'cleanliness_weekly',
    event_date: completion.event_date,
    status: evaluation.passed_both ? 'pass' : 'fail',
    source_schedule_id: completion.schedule_id,
    source_completion_id: completion.id,
    section_id: sectionIds[0] ?? null,
    metadata: {
      overall_score: evaluation.overall_score,
      interior_status: evaluation.interior_status,
      exterior_status: evaluation.exterior_status,
      section_ids: sectionIds,
      asset_id: completion.asset_id ?? null,
    },
  }
}

async function replaceEventsForType(
  supabase: SupabaseClient,
  completionId: string,
  eventType: OperatorEvaluationEventType,
  rows: OperatorEvaluationEventRow[]
): Promise<number> {
  const { error: deleteError } = await supabase
    .from('operator_evaluation_events')
    .delete()
    .eq('source_completion_id', completionId)
    .eq('event_type', eventType)

  if (deleteError) {
    console.error(`[operator-evaluation-events] delete ${eventType}`, deleteError)
    throw deleteError
  }

  if (rows.length === 0) return 0

  const { error: insertError } = await supabase
    .from('operator_evaluation_events')
    .insert(rows)

  if (insertError) {
    console.error(`[operator-evaluation-events] insert ${eventType}`, insertError)
    throw insertError
  }

  return rows.length
}

export async function writePunctualityEvents(
  supabase: SupabaseClient,
  completion: OperatorEvaluationCompletion,
  plantOperationsData: PlantOperationsData | Record<string, unknown> | null | undefined,
  plantId: string
): Promise<number> {
  if (!plantId) return 0
  const rows = buildPunctualityEventRows(plantId, completion, plantOperationsData)
  return replaceEventsForType(supabase, completion.id, 'punctuality', rows)
}

export async function writeBonusClosureEvents(
  supabase: SupabaseClient,
  completion: OperatorEvaluationCompletion,
  plantOperationsData: PlantOperationsData | Record<string, unknown> | null | undefined,
  plantId: string
): Promise<number> {
  if (!plantId) return 0
  const rows = buildBonusClosureEventRows(plantId, completion, plantOperationsData)
  return replaceEventsForType(supabase, completion.id, 'cleanliness_closure', rows)
}

export async function writeSecurityTalkEvents(
  supabase: SupabaseClient,
  completion: OperatorEvaluationCompletion,
  securityData: Record<string, SecurityTalkData> | null | undefined,
  plantId: string,
  primaryOperatorId?: string | null
): Promise<number> {
  if (!plantId) return 0
  const rows = buildSecurityTalkEventRows(
    plantId,
    completion,
    securityData,
    primaryOperatorId
  )
  return replaceEventsForType(supabase, completion.id, 'security_talk', rows)
}

async function resolvePrimaryOperatorId(
  supabase: SupabaseClient,
  assetId: string | null | undefined
): Promise<string | null> {
  if (!assetId) return null

  const { data, error } = await supabase
    .from('asset_operators_full')
    .select('operator_id, assignment_type, status')
    .eq('asset_id', assetId)
    .eq('status', 'active')

  if (error) {
    console.error('[operator-evaluation-events] asset_operators_full', error)
    return null
  }

  const primary =
    (data ?? []).find((row) => row.assignment_type === 'primary') ?? data?.[0]
  return primary?.operator_id ?? null
}

async function resolveCleanlinessItemIds(
  supabase: SupabaseClient,
  templateVersionId: string | null | undefined
): Promise<string[]> {
  if (!templateVersionId) return []

  const { data, error } = await supabase
    .from('checklist_template_versions')
    .select('sections')
    .eq('id', templateVersionId)
    .single()

  if (error || !data?.sections) {
    if (error) console.error('[operator-evaluation-events] template_versions', error)
    return []
  }

  const sections = data.sections as Array<{
    title?: string
    items?: Array<{ id: string }>
  }>

  const itemIds: string[] = []
  for (const section of sections) {
    if (!section.items || !Array.isArray(section.items)) continue
    if (!isCleanlinessSection(section.title ?? '')) continue
    for (const item of section.items) {
      itemIds.push(item.id)
    }
  }
  return itemIds
}

export async function writeCleanlinessWeeklyEvents(
  supabase: SupabaseClient,
  completion: OperatorEvaluationCompletion,
  plantId: string,
  completedItems: CompletedItemForEvents[] | null | undefined
): Promise<number> {
  if (!plantId || !hasCleanlinessBonusItems(completedItems ?? undefined)) {
    return 0
  }

  const cleanlinessItemIds = await resolveCleanlinessItemIds(
    supabase,
    completion.template_version_id
  )
  if (cleanlinessItemIds.length === 0) return 0

  const evaluation = calculateCleanlinessEvaluationByTemplate(
    completedItems ?? [],
    cleanlinessItemIds
  )
  if (!evaluation) return 0

  const operatorId = await resolvePrimaryOperatorId(supabase, completion.asset_id)
  if (!operatorId) return 0

  const row = buildCleanlinessWeeklyEventRow(
    plantId,
    completion,
    operatorId,
    evaluation,
    []
  )

  return replaceEventsForType(supabase, completion.id, 'cleanliness_weekly', [row])
}

export type WriteAllOperatorEvaluationEventsInput = {
  completion: OperatorEvaluationCompletion
  plantId: string
  plantOperationsData?: PlantOperationsData | Record<string, unknown> | null
  securityData?: Record<string, SecurityTalkData> | null
  completedItems?: CompletedItemForEvents[] | null
}

/**
 * Idempotent writers for all evaluation event types after checklist completion.
 */
export async function writeAllOperatorEvaluationEvents(
  supabase: SupabaseClient,
  input: WriteAllOperatorEvaluationEventsInput
): Promise<{ total: number; byType: Record<OperatorEvaluationEventType, number> }> {
  const { completion, plantId, plantOperationsData, securityData, completedItems } =
    input

  if (!plantId || !completion.id) {
    return {
      total: 0,
      byType: {
        punctuality: 0,
        cleanliness_weekly: 0,
        cleanliness_closure: 0,
        security_talk: 0,
      },
    }
  }

  const primaryOperatorId = await resolvePrimaryOperatorId(
    supabase,
    completion.asset_id
  )

  const [punctuality, closure, security, weekly] = await Promise.all([
    writePunctualityEvents(supabase, completion, plantOperationsData, plantId),
    writeBonusClosureEvents(supabase, completion, plantOperationsData, plantId),
    writeSecurityTalkEvents(
      supabase,
      completion,
      securityData,
      plantId,
      primaryOperatorId
    ),
    writeCleanlinessWeeklyEvents(supabase, completion, plantId, completedItems),
  ])

  const byType = {
    punctuality,
    cleanliness_weekly: weekly,
    cleanliness_closure: closure,
    security_talk: security,
  }

  return {
    total: punctuality + weekly + closure + security,
    byType,
  }
}
