import {
  getBonusClosureSectionProgress,
} from '@/lib/checklist/bonus-closure-validation'
import {
  getPunctualitySectionProgress,
  normalizePunctualityConfig,
} from '@/lib/checklist/punctuality-validation'
import {
  getSectionFunnelLane,
  type SectionFunnelInput,
  type SectionFunnelLane,
} from './section-funnel'
import {
  countCompletedTireReadings,
  normalizeTireReadingsConfig,
  validateTireReadingsSection,
} from '@/lib/tires/tire-readings-validation'
import type { BonusClosureSectionData, PunctualitySectionData } from '@/types'
import {
  DEFAULT_SECURITY_CONFIG,
  normalizeSecurityConfig,
  resolveSecurityTalkUiMode,
  type SecurityTalkExecutorContext,
} from '@/lib/checklist/security-talk-validation'

export type SectionProgressSlice = SectionFunnelInput & {
  total: number
  completed: number
  hasIssues?: boolean
}

export type ChecklistProgressAggregate = {
  totalItems: number
  completedItems: number
  maintenanceTotal: number
  maintenanceCompleted: number
  operationsTotal: number
  operationsCompleted: number
  sectionsWithMaintenanceIssues: number
  progressPercentage: number
}

export interface SectionProgressCounts {
  total: number
  completed: number
  hasIssues: boolean
  isComplete: boolean
}

export function clampSectionProgress(
  total: number,
  completed: number
): { total: number; completed: number } {
  const safeTotal = Math.max(0, total)
  return {
    total: safeTotal,
    completed: Math.min(Math.max(0, completed), safeTotal),
  }
}

export function resolveEvidenceRequiredPhotoCount(config: {
  categories?: string[]
  min_photos?: number
}): number {
  const categories = config.categories ?? []
  const minPhotos =
    typeof config.min_photos === 'number' ? config.min_photos : 1
  return categories.length * minPhotos
}

export function getEvidenceSectionProgress(
  sectionEvidences: unknown[],
  config: { categories?: string[]; min_photos?: number }
): { total: number; completed: number } {
  const requiredPhotos = resolveEvidenceRequiredPhotoCount(config)
  if (requiredPhotos === 0) {
    return { total: 0, completed: 0 }
  }
  return clampSectionProgress(requiredPhotos, sectionEvidences.length)
}

export function getSecurityTalkSectionProgress(
  sectionSecurityData: Record<string, unknown>,
  configInput: Record<string, unknown> | null | undefined,
  executorOrRole?: string | null | SecurityTalkExecutorContext
): { total: number; completed: number } {
  const templateConfig = normalizeSecurityConfig(
    configInput && typeof configInput === 'object'
      ? (configInput as Partial<typeof DEFAULT_SECURITY_CONFIG>)
      : null
  )
  const uiMode = resolveSecurityTalkUiMode(templateConfig, executorOrRole ?? null)
  const isPlantManagerMode = uiMode === 'plant_manager'
  const attendees = sectionSecurityData.attendees
  const hasAttendance = isPlantManagerMode
    ? Array.isArray(attendees) && attendees.length > 0
    : sectionSecurityData.attendance === true

  const shouldRequireDetails =
    !templateConfig.require_attendance || hasAttendance

  let totalFields = 0
  let completedFields = 0

  if (templateConfig.require_attendance) {
    totalFields++
    if (hasAttendance) completedFields++
  }

  if (templateConfig.require_topic && shouldRequireDetails) {
    totalFields++
    const topic = sectionSecurityData.topic
    if (typeof topic === 'string' && topic.trim().length > 0) {
      completedFields++
    }
  }

  if (templateConfig.require_reflection && shouldRequireDetails) {
    totalFields++
    const reflection = sectionSecurityData.reflection
    if (typeof reflection === 'string' && reflection.trim().length > 0) {
      completedFields++
    }
  }

  if (totalFields === 0) {
    return { total: 1, completed: 1 }
  }

  return clampSectionProgress(totalFields, completedFields)
}

export interface ComputeSectionProgressInput {
  section: {
    id: string
    section_type?: string
    title?: string
    funnel_config?: { lane?: string } | null
    checklist_items?: Array<{ id: string }>
    items?: Array<{ id: string }>
    evidence_config?: { categories?: string[]; min_photos?: number }
    cleanliness_config?: { areas?: string[]; min_photos?: number }
    security_config?: Record<string, unknown>
    punctuality_config?: unknown
    bonus_closure_config?: unknown
    tire_readings_config?: unknown
  }
  itemStatus: Record<string, string | boolean | null | undefined>
  sectionEvidences: Array<{ status?: string }>
  sectionSecurityData: Record<string, unknown>
  sectionPlantData: PunctualitySectionData | BonusClosureSectionData | undefined
  sectionTireReadings: Array<Record<string, unknown>>
  /** Executor profile — security talk progress respects operator vs plant-staff UI mode. */
  executorRole?: string | null
  executorBusinessRole?: string | null
}

export function computeSectionProgressCounts(
  input: ComputeSectionProgressInput
): SectionProgressCounts {
  const {
    section,
    itemStatus,
    sectionEvidences,
    sectionSecurityData,
    sectionPlantData,
    sectionTireReadings,
  } = input

  if (section.section_type === 'evidence') {
    const config = section.evidence_config ?? {}
    const { total, completed } = getEvidenceSectionProgress(
      sectionEvidences,
      config
    )
    return {
      total,
      completed,
      hasIssues: sectionEvidences.some((entry) => entry.status === 'failed'),
      isComplete: total === 0 ? true : completed >= total,
    }
  }

  if (section.section_type === 'cleanliness_bonus') {
    const items = section.checklist_items ?? section.items ?? []
    const itemsCompleted = items.filter((item) => itemStatus[item.id]).length
    const hasItemIssues = items.some(
      (item) =>
        itemStatus[item.id] === 'flag' || itemStatus[item.id] === 'fail'
    )

    return {
      total: items.length,
      completed: itemsCompleted,
      hasIssues:
        hasItemIssues ||
        sectionEvidences.some((entry) => entry.status === 'failed'),
      isComplete: items.length === 0 ? true : itemsCompleted === items.length,
    }
  }

  if (section.section_type === 'security_talk') {
    const { total, completed } = getSecurityTalkSectionProgress(
      sectionSecurityData,
      section.security_config,
      {
        role: input.executorRole,
        business_role: input.executorBusinessRole,
      }
    )
    return {
      total,
      completed,
      hasIssues: false,
      isComplete: total === 0 ? true : completed >= total,
    }
  }

  if (section.section_type === 'operator_punctuality') {
    const config = normalizePunctualityConfig(
      section.punctuality_config as Parameters<typeof normalizePunctualityConfig>[0]
    )
    const { total, completed } = getPunctualitySectionProgress(
      sectionPlantData as PunctualitySectionData | undefined,
      config
    )
    return {
      total,
      completed,
      hasIssues: false,
      isComplete: total === 0 ? true : completed >= total,
    }
  }

  if (section.section_type === 'bonus_closure') {
    const bonusData = sectionPlantData as BonusClosureSectionData | undefined
    const operatorCount = bonusData?.decisions?.length ?? 0
    const { total, completed } = getBonusClosureSectionProgress(
      bonusData,
      operatorCount
    )
    return {
      total,
      completed,
      hasIssues: false,
      isComplete: total === 0 ? true : completed >= total,
    }
  }

  if (section.section_type === 'tire_readings') {
    const config = normalizeTireReadingsConfig(section.tire_readings_config)
    if (config.reading_mode === 'none' || sectionTireReadings.length === 0) {
      return {
        total: 0,
        completed: 0,
        hasIssues: false,
        isComplete: true,
      }
    }

    const completed = countCompletedTireReadings(
      sectionTireReadings as Parameters<typeof countCompletedTireReadings>[0],
      config
    )
    const validation = validateTireReadingsSection({
      readings: sectionTireReadings as Parameters<
        typeof validateTireReadingsSection
      >[0]['readings'],
      positionCount: sectionTireReadings.length,
      config,
      sectionTitle: section.title,
    })

    const { total, completed: cappedCompleted } = clampSectionProgress(
      sectionTireReadings.length,
      completed
    )

    return {
      total,
      completed: cappedCompleted,
      hasIssues: false,
      isComplete: validation.valid,
    }
  }

  const items = section.checklist_items ?? section.items ?? []
  const completed = items.filter((item) => itemStatus[item.id]).length
  const lane = getSectionFunnelLane(section)
  const hasItemIssues = items.some(
    (item) => itemStatus[item.id] === 'flag' || itemStatus[item.id] === 'fail'
  )

  return {
    total: items.length,
    completed,
    hasIssues: lane === 'operations_evaluation' ? false : hasItemIssues,
    isComplete: items.length === 0 ? true : completed === items.length,
  }
}

export function aggregateChecklistProgress(
  sections: SectionProgressSlice[]
): ChecklistProgressAggregate {
  let totalItems = 0
  let rawCompletedItems = 0
  let maintenanceTotal = 0
  let maintenanceCompleted = 0
  let operationsTotal = 0
  let operationsCompleted = 0
  let sectionsWithMaintenanceIssues = 0

  for (const section of sections) {
    const lane = getSectionFunnelLane(section)
    const { total, completed } = clampSectionProgress(
      section.total,
      section.completed
    )

    totalItems += total
    rawCompletedItems += completed

    if (lane === 'operations_evaluation') {
      operationsTotal += total
      operationsCompleted += completed
    } else {
      maintenanceTotal += total
      maintenanceCompleted += completed
      if (section.hasIssues) {
        sectionsWithMaintenanceIssues++
      }
    }
  }

  const completedItems = Math.min(rawCompletedItems, totalItems)

  return {
    totalItems,
    completedItems,
    maintenanceTotal,
    maintenanceCompleted,
    operationsTotal,
    operationsCompleted,
    sectionsWithMaintenanceIssues,
    progressPercentage:
      totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
  }
}

export function getFunnelLaneLabel(lane: SectionFunnelLane): string {
  return lane === 'operations_evaluation' ? 'Operaciones' : 'Mantenimiento'
}
