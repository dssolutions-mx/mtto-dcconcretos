import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isPlantaAsset,
  PLANTA_MODEL_ID,
  roleInExecutorRoles,
} from '@/lib/checklist/executor-roles'
import type {
  PlantControlDueSummary,
  PlantOperationsDueConfig,
  ScheduleDueStatus,
} from '@/types/plant-operations-schedule'
import {
  countBonusClosureDecisionsInPayload,
  scheduleHasVisibleDraft,
} from '@/lib/checklist/schedule-draft-display'
import { isChecklistScheduleDraftPayload } from '@/lib/checklist/schedule-draft'

export type { ScheduleDueStatus } from '@/types/plant-operations-schedule'

export type PlantOperationsSchedule = {
  scheduleId: string
  assetId: string
  assetCode: string | null
  assetName: string | null
  checklistName: string | null
  status: string
  scheduledDay: string | null
  frequency?: string | null
  isBonusClosure?: boolean
  deadlineDay?: number
  dueStatus?: ScheduleDueStatus
  draftPayload?: unknown
  draftUpdatedAt?: string | null
}

type RawScheduleRow = {
  id: string
  asset_id: string | null
  status: string | null
  scheduled_day: string | null
  scheduled_date: string | null
  template_id?: string | null
  draft_payload?: unknown
  draft_updated_at?: string | null
  checklists?: {
    name?: string | null
    executor_roles?: string[] | null
    frequency?: string | null
    equipment_models?: { maintenance_unit?: string | null } | null
  } | null
  assets?: {
    id?: string
    name?: string | null
    asset_id?: string | null
    model_id?: string | null
    plant_id?: string | null
    equipment_models?: { maintenance_unit?: string | null } | null
  } | null
}

function normalizeNested<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function isCompletedStatus(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase()
  return s === 'completado' || s === 'completed'
}

function formatUTCDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** First calendar day of a month — canonical scheduled_day for monthly PLANTA bonus_closure. */
export function monthlyScheduleDayKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export function monthPeriodFromTodayKey(todayKey: string): {
  year: number
  month: number
  monthPrefix: string
  scheduleDay: string
} {
  const [yearStr, monthStr] = todayKey.split('-')
  const year = Number(yearStr) || new Date().getUTCFullYear()
  const month = Number(monthStr) || new Date().getUTCMonth() + 1
  return {
    year,
    month,
    monthPrefix: `${yearStr}-${monthStr}`,
    scheduleDay: monthlyScheduleDayKey(year, month),
  }
}

export function monthlySchedulePairExists(
  existing: Array<{ asset_id: string | null; template_id: string | null }>,
  assetId: string,
  templateId: string
): boolean {
  return existing.some(
    (row) => row.asset_id === assetId && row.template_id === templateId
  )
}

export type MonthlyScheduleInsertRow = {
  template_id: string
  asset_id: string
  scheduled_day: string
  scheduled_date: string
  status: 'pendiente'
}

/**
 * Ensures each PLANTA asset has a mensual bonus_closure schedule for the current month.
 * Idempotent: skips asset+template pairs that already have any schedule in the month.
 */
export async function ensureMonthlyBonusClosureSchedules(
  supabase: SupabaseClient,
  plantIds: string[],
  todayKey: string
): Promise<{ created: number; scheduleIds: string[] }> {
  if (plantIds.length === 0) return { created: 0, scheduleIds: [] }

  const { monthPrefix, scheduleDay } = monthPeriodFromTodayKey(todayKey)

  const { data: plantAssets, error: assetsError } = await supabase
    .from('assets')
    .select('id, plant_id, model_id, equipment_models ( maintenance_unit )')
    .in('plant_id', plantIds)
    .eq('status', 'operational')

  if (assetsError) {
    console.error('[plant-operations-schedule] ensure monthly assets', assetsError)
    return { created: 0, scheduleIds: [] }
  }

  const plantaAssets = (plantAssets ?? []).filter((a) =>
    isPlantaAsset({
      modelId: a.model_id,
      maintenanceUnit: normalizeNested(a.equipment_models)?.maintenance_unit,
    })
  )

  if (plantaAssets.length === 0) return { created: 0, scheduleIds: [] }

  const plantaAssetIds = plantaAssets.map((a) => a.id)

  const { data: monthlyTemplates, error: templatesError } = await supabase
    .from('checklists')
    .select('id')
    .eq('model_id', PLANTA_MODEL_ID)
    .eq('frequency', 'mensual')

  if (templatesError) {
    console.error('[plant-operations-schedule] ensure monthly templates', templatesError)
    return { created: 0, scheduleIds: [] }
  }

  const templateIds = (monthlyTemplates ?? []).map((t) => t.id).filter(Boolean)
  if (templateIds.length === 0) return { created: 0, scheduleIds: [] }

  const { data: bonusSections, error: sectionError } = await supabase
    .from('checklist_sections')
    .select('checklist_id')
    .in('checklist_id', templateIds)
    .eq('section_type', 'bonus_closure')

  if (sectionError) {
    console.error('[plant-operations-schedule] ensure monthly sections', sectionError)
    return { created: 0, scheduleIds: [] }
  }

  const bonusTemplateIds = [
    ...new Set(
      (bonusSections ?? [])
        .map((s) => s.checklist_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  if (bonusTemplateIds.length === 0) return { created: 0, scheduleIds: [] }

  const { data: existingSchedules, error: existingError } = await supabase
    .from('checklist_schedules')
    .select('id, asset_id, template_id')
    .in('asset_id', plantaAssetIds)
    .in('template_id', bonusTemplateIds)
    .like('scheduled_day', `${monthPrefix}%`)

  if (existingError) {
    console.error('[plant-operations-schedule] ensure monthly existing', existingError)
    return { created: 0, scheduleIds: [] }
  }

  const existing = existingSchedules ?? []
  const toInsert: MonthlyScheduleInsertRow[] = []

  for (const asset of plantaAssets) {
    for (const templateId of bonusTemplateIds) {
      if (monthlySchedulePairExists(existing, asset.id, templateId)) continue
      toInsert.push({
        template_id: templateId,
        asset_id: asset.id,
        scheduled_day: scheduleDay,
        scheduled_date: `${scheduleDay}T00:00:00.000Z`,
        status: 'pendiente',
      })
    }
  }

  if (toInsert.length === 0) return { created: 0, scheduleIds: [] }

  const { data: inserted, error: insertError } = await supabase
    .from('checklist_schedules')
    .insert(toInsert)
    .select('id')

  if (insertError) {
    console.error('[plant-operations-schedule] ensure monthly insert', insertError)
    return { created: 0, scheduleIds: [] }
  }

  const scheduleIds = (inserted ?? []).map((row) => row.id).filter(Boolean)
  return { created: scheduleIds.length, scheduleIds }
}

export type ComputeDueStatusInput = {
  scheduledDay?: string | null
  status?: string | null
  frequency?: string | null
  /** When true, uses monthly deadline_day rules (bonus_closure templates). */
  isBonusClosure?: boolean
}

const DEFAULT_MONTHLY_DEADLINE_DAY = 24

/**
 * Daily: scheduled_day vs today (UTC).
 * Monthly bonus_closure: due by deadline_day of the scheduled month (default 24).
 */
export function computeDueStatus(
  schedule: ComputeDueStatusInput,
  config?: PlantOperationsDueConfig
): ScheduleDueStatus {
  const todayKey = config?.todayKey ?? formatUTCDateKey(new Date())

  if (isCompletedStatus(schedule.status)) {
    return 'on_time'
  }

  const frequency = (schedule.frequency ?? 'diario').toLowerCase()
  const isMonthly =
    schedule.isBonusClosure ||
    frequency === 'mensual' ||
    frequency === 'monthly'

  if (isMonthly) {
    const scheduledDay = schedule.scheduledDay ?? todayKey
    const [yearStr, monthStr] = scheduledDay.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    if (!year || !month) return 'overdue'

    const deadlineDay = config?.deadlineDay ?? DEFAULT_MONTHLY_DEADLINE_DAY
    const deadlineKey = `${yearStr}-${monthStr}-${String(deadlineDay).padStart(2, '0')}`

    if (todayKey < deadlineKey) return 'on_time'
    if (todayKey === deadlineKey) return 'due_today'
    return 'overdue'
  }

  const day = schedule.scheduledDay ?? todayKey
  if (day > todayKey) return 'on_time'
  if (day === todayKey) return 'due_today'
  return 'overdue'
}

/** Days until monthly bonus_closure deadline (0 = due today, negative = overdue). */
export function monthlyClosureCountdown(
  scheduledDay: string | null | undefined,
  config?: PlantOperationsDueConfig
): number | null {
  const todayKey = config?.todayKey ?? formatUTCDateKey(new Date())
  const day = scheduledDay ?? todayKey
  const [yearStr, monthStr] = day.split('-')
  if (!yearStr || !monthStr) return null

  const deadlineDay = config?.deadlineDay ?? DEFAULT_MONTHLY_DEADLINE_DAY
  const deadlineKey = `${yearStr}-${monthStr}-${String(deadlineDay).padStart(2, '0')}`

  const today = new Date(`${todayKey}T00:00:00.000Z`)
  const deadline = new Date(`${deadlineKey}T00:00:00.000Z`)
  return Math.round((deadline.getTime() - today.getTime()) / 86_400_000)
}

function scheduleDay(row: RawScheduleRow): string {
  if (row.scheduled_day) return row.scheduled_day
  if (row.scheduled_date) return String(row.scheduled_date).split('T')[0]
  return ''
}

/**
 * PLANTA-model daily schedules visible to DOSIFICADOR / JEFE_PLANTA by plant scope
 * (no asset_operators assignment required).
 */
export async function getPlantOperationsSchedules(
  supabase: SupabaseClient,
  plantIds: string[],
  role: string,
  todayKey: string
): Promise<PlantOperationsSchedule[]> {
  if (plantIds.length === 0) return []
  if (role !== 'DOSIFICADOR' && role !== 'JEFE_PLANTA') return []

  const { data: plantAssets, error: assetsError } = await supabase
    .from('assets')
    .select(
      `
      id,
      name,
      asset_id,
      model_id,
      plant_id,
      equipment_models ( maintenance_unit )
    `
    )
    .in('plant_id', plantIds)
    .eq('status', 'operational')

  if (assetsError) {
    console.error('[plant-operations-schedule] assets', assetsError)
    return []
  }

  const plantaAssetIds = (plantAssets ?? [])
    .filter((a) =>
      isPlantaAsset({
        modelId: a.model_id,
        maintenanceUnit: normalizeNested(a.equipment_models)?.maintenance_unit,
      })
    )
    .map((a) => a.id)

  if (plantaAssetIds.length === 0) return []

  const { data: rawSchedules, error: schedError } = await supabase
    .from('checklist_schedules')
    .select(
      `
      id,
      asset_id,
      status,
      scheduled_day,
      scheduled_date,
      draft_payload,
      draft_updated_at,
      checklists!template_id (
        name,
        executor_roles,
        model_id,
        frequency,
        equipment_models ( maintenance_unit )
      ),
      assets (
        id,
        name,
        asset_id,
        model_id,
        plant_id,
        equipment_models ( maintenance_unit )
      )
    `
    )
    .in('asset_id', plantaAssetIds)
    .lte('scheduled_day', todayKey)

  if (schedError) {
    console.error('[plant-operations-schedule] schedules', schedError)
    return []
  }

  const assetById = new Map((plantAssets ?? []).map((a) => [a.id, a]))
  const results: PlantOperationsSchedule[] = []

  for (const row of rawSchedules ?? []) {
    const checklist = normalizeNested(row.checklists)
    if (!checklist || checklist.frequency !== 'diario') continue
    if (!roleInExecutorRoles(role, checklist.executor_roles)) continue

    const day = scheduleDay(row)
    if (!day) continue
    const dueTodayOrOverdue =
      day === todayKey || (day < todayKey && !isCompletedStatus(row.status))
    if (!dueTodayOrOverdue) continue

    const asset =
      normalizeNested(row.assets) ?? assetById.get(row.asset_id ?? '')
    if (!asset?.id) continue

    const dueStatus = computeDueStatus(
      {
        scheduledDay: day,
        status: row.status,
        frequency: checklist.frequency,
      },
      { todayKey }
    )

    results.push({
      scheduleId: row.id,
      assetId: asset.id,
      assetCode: asset.asset_id ?? null,
      assetName: asset.name ?? null,
      checklistName: checklist.name ?? null,
      status: row.status ?? 'pendiente',
      scheduledDay: day,
      dueStatus,
      draftPayload: row.draft_payload,
      draftUpdatedAt: row.draft_updated_at ?? null,
    })
  }

  results.sort((a, b) => (a.assetCode ?? '').localeCompare(b.assetCode ?? '', 'es'))
  return results
}

/** Monthly PLANTA bonus_closure schedules (pending in current month). */
export async function getMonthlyBonusClosureSchedules(
  supabase: SupabaseClient,
  plantIds: string[],
  role: string,
  todayKey: string
): Promise<PlantOperationsSchedule[]> {
  if (plantIds.length === 0) return []
  if (role !== 'DOSIFICADOR' && role !== 'JEFE_PLANTA') return []

  const [yearStr, monthStr] = todayKey.split('-')
  const monthPrefix = `${yearStr}-${monthStr}`

  const { data: plantAssets, error: assetsError } = await supabase
    .from('assets')
    .select(
      `
      id,
      name,
      asset_id,
      model_id,
      plant_id,
      equipment_models ( maintenance_unit )
    `
    )
    .in('plant_id', plantIds)
    .eq('status', 'operational')

  if (assetsError) {
    console.error('[plant-operations-schedule] monthly assets', assetsError)
    return []
  }

  const plantaAssetIds = (plantAssets ?? [])
    .filter((a) =>
      isPlantaAsset({
        modelId: a.model_id,
        maintenanceUnit: normalizeNested(a.equipment_models)?.maintenance_unit,
      })
    )
    .map((a) => a.id)

  if (plantaAssetIds.length === 0) return []

  const { data: rawSchedules, error: schedError } = await supabase
    .from('checklist_schedules')
    .select(
      `
      id,
      asset_id,
      status,
      scheduled_day,
      scheduled_date,
      template_id,
      draft_payload,
      draft_updated_at,
      checklists!template_id (
        name,
        executor_roles,
        model_id,
        frequency,
        equipment_models ( maintenance_unit )
      ),
      assets (
        id,
        name,
        asset_id,
        model_id,
        plant_id,
        equipment_models ( maintenance_unit )
      )
    `
    )
    .in('asset_id', plantaAssetIds)
    .like('scheduled_day', `${monthPrefix}%`)

  if (schedError) {
    console.error('[plant-operations-schedule] monthly schedules', schedError)
    return []
  }

  const templateIds = [
    ...new Set(
      (rawSchedules ?? [])
        .map((row) => row.template_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const bonusClosureTemplateIds = new Set<string>()
  const deadlineByTemplate = new Map<string, number>()

  const uniqueTemplateIds = templateIds

  if (uniqueTemplateIds.length > 0) {
    const { data: bonusSections, error: sectionError } = await supabase
      .from('checklist_sections')
      .select('checklist_id, section_type, bonus_closure_config')
      .in('checklist_id', uniqueTemplateIds)
      .eq('section_type', 'bonus_closure')

    if (sectionError) {
      console.error('[plant-operations-schedule] bonus_closure sections', sectionError)
    } else {
      for (const section of bonusSections ?? []) {
        if (!section.checklist_id) continue
        bonusClosureTemplateIds.add(section.checklist_id)
        const cfg = section.bonus_closure_config as { deadline_day?: number } | null
        if (cfg?.deadline_day) {
          deadlineByTemplate.set(section.checklist_id, cfg.deadline_day)
        }
      }
    }
  }

  const assetById = new Map((plantAssets ?? []).map((a) => [a.id, a]))
  const results: PlantOperationsSchedule[] = []

  for (const row of rawSchedules ?? []) {
    const checklist = normalizeNested(row.checklists)
    if (!checklist || checklist.frequency !== 'mensual') continue
    if (!row.template_id || !bonusClosureTemplateIds.has(row.template_id)) continue
    if (!roleInExecutorRoles(role, checklist.executor_roles)) continue

    const day = scheduleDay(row)
    if (!day) continue

    const asset =
      normalizeNested(row.assets) ?? assetById.get(row.asset_id ?? '')
    if (!asset?.id) continue

    const deadlineDay =
      deadlineByTemplate.get(row.template_id) ?? DEFAULT_MONTHLY_DEADLINE_DAY

    const dueStatus = computeDueStatus(
      {
        scheduledDay: day,
        status: row.status,
        frequency: checklist.frequency,
        isBonusClosure: true,
      },
      { todayKey, deadlineDay }
    )

    if (isCompletedStatus(row.status)) continue

    results.push({
      scheduleId: row.id,
      assetId: asset.id,
      assetCode: asset.asset_id ?? null,
      assetName: asset.name ?? null,
      checklistName: checklist.name ?? null,
      status: row.status ?? 'pendiente',
      scheduledDay: day,
      frequency: checklist.frequency,
      isBonusClosure: true,
      deadlineDay,
      dueStatus,
      draftPayload: row.draft_payload,
      draftUpdatedAt: row.draft_updated_at ?? null,
    })
  }

  return results
}

/** Summary for plant-daily-readiness "Control de planta" row. */
export function summarizePlantControlReadiness(
  schedules: PlantOperationsSchedule[]
): {
  readiness: 'listo' | 'pendiente'
  pendingScheduleId: string | null
  checklistName: string | null
} {
  if (schedules.length === 0) {
    return { readiness: 'listo', pendingScheduleId: null, checklistName: null }
  }
  const pending = schedules.find((s) => !isCompletedStatus(s.status))
  if (!pending) {
    return {
      readiness: 'listo',
      pendingScheduleId: null,
      checklistName: schedules[0]?.checklistName ?? null,
    }
  }
  return {
    readiness: 'pendiente',
    pendingScheduleId: pending.scheduleId,
    checklistName: pending.checklistName,
  }
}

/** Due status card data for dosificador dashboard. */
export function summarizePlantControlDue(
  schedules: PlantOperationsSchedule[],
  config?: PlantOperationsDueConfig,
  monthlySchedules: PlantOperationsSchedule[] = []
): PlantControlDueSummary | null {
  const allPending = [
    ...schedules.filter((s) => !isCompletedStatus(s.status)),
    ...monthlySchedules.filter((s) => !isCompletedStatus(s.status)),
  ]

  if (schedules.length === 0 && monthlySchedules.length === 0) return null

  const monthlyPending = monthlySchedules.find((s) => !isCompletedStatus(s.status))
  const dailyPending = schedules.find((s) => !isCompletedStatus(s.status))

  const pending = monthlyPending ?? dailyPending ?? monthlySchedules[0] ?? schedules[0]

  const dueStatus =
    pending.dueStatus ??
    computeDueStatus(
      {
        scheduledDay: pending.scheduledDay,
        status: pending.status,
        frequency: pending.isBonusClosure ? 'mensual' : 'diario',
        isBonusClosure: pending.isBonusClosure,
      },
      {
        ...config,
        deadlineDay: pending.deadlineDay ?? config?.deadlineDay,
      }
    )

  const monthlyClosureDaysRemaining = monthlyPending?.scheduledDay
    ? monthlyClosureCountdown(monthlyPending.scheduledDay, {
        todayKey: config?.todayKey,
        deadlineDay: monthlyPending.deadlineDay ?? config?.deadlineDay,
      })
    : null

  const draftSchedule = monthlyPending ?? dailyPending ?? pending
  const draftPayload = isChecklistScheduleDraftPayload(draftSchedule.draftPayload)
    ? draftSchedule.draftPayload
    : null
  const hasDraft = scheduleHasVisibleDraft({
    draft_payload: draftSchedule.draftPayload,
    draft_updated_at: draftSchedule.draftUpdatedAt,
  })

  return {
    dueStatus,
    scheduleId: pending.scheduleId,
    checklistName: pending.checklistName,
    scheduledDay: pending.scheduledDay,
    monthlyClosureDaysRemaining,
    hasDraft,
    draftUpdatedAt: draftSchedule.draftUpdatedAt ?? null,
    bonusClosureDraftDecisions: monthlyPending
      ? countBonusClosureDecisionsInPayload(draftPayload)
      : null,
  }
}
