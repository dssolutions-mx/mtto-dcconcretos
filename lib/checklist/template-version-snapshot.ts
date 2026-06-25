/**
 * Section snapshot shape stored in checklist_template_versions.sections (JSONB).
 * Mirrors create_template_version / restore_template_version in Postgres.
 */

export type ChecklistItemVersionSnapshot = {
  id?: string
  description: string
  required: boolean
  order_index: number
  item_type: string
  expected_value?: string | null
  tolerance?: string | null
}

export type SectionVersionSnapshot = {
  id?: string
  title: string
  order_index: number
  section_type?: string | null
  security_config?: unknown
  cleanliness_config?: unknown
  punctuality_config?: unknown
  bonus_closure_config?: unknown
  tire_readings_config?: unknown
  evidence_config?: unknown
  funnel_config?: unknown
  items: ChecklistItemVersionSnapshot[]
}

export const SECTION_VERSION_SNAPSHOT_CONFIG_KEYS = [
  'security_config',
  'cleanliness_config',
  'punctuality_config',
  'bonus_closure_config',
  'tire_readings_config',
  'evidence_config',
  'funnel_config',
] as const

export type SectionVersionConfigKey =
  (typeof SECTION_VERSION_SNAPSHOT_CONFIG_KEYS)[number]

type SectionSnapshotInput = {
  id?: string
  title: string
  order_index: number
  section_type?: string | null
  security_config?: unknown
  cleanliness_config?: unknown
  punctuality_config?: unknown
  bonus_closure_config?: unknown
  tire_readings_config?: unknown
  evidence_config?: unknown
  funnel_config?: unknown
  items?: Array<{
    id?: string
    description: string
    required?: boolean
    order_index: number
    item_type?: string
    expected_value?: string | null
    tolerance?: string | null
  }>
}

/** Build the JSON section object persisted by create_template_version. */
export function buildSectionVersionSnapshot(
  section: SectionSnapshotInput
): SectionVersionSnapshot {
  return {
    id: section.id,
    title: section.title,
    order_index: section.order_index,
    section_type: section.section_type ?? null,
    security_config: section.security_config ?? null,
    cleanliness_config: section.cleanliness_config ?? null,
    punctuality_config: section.punctuality_config ?? null,
    bonus_closure_config: section.bonus_closure_config ?? null,
    tire_readings_config: section.tire_readings_config ?? null,
    evidence_config: section.evidence_config ?? null,
    funnel_config: section.funnel_config ?? null,
    items: (section.items ?? []).map((item) => ({
      id: item.id,
      description: item.description,
      required: item.required ?? true,
      order_index: item.order_index,
      item_type: item.item_type ?? 'check',
      expected_value: item.expected_value ?? null,
      tolerance: item.tolerance ?? null,
    })),
  }
}

/** Keys present on a parsed section snapshot (for restore validation). */
export function sectionVersionSnapshotKeys(
  snapshot: SectionVersionSnapshot
): string[] {
  const keys = new Set<string>([
    'id',
    'title',
    'order_index',
    'section_type',
    'items',
    ...SECTION_VERSION_SNAPSHOT_CONFIG_KEYS,
  ])
  return Object.keys(snapshot).filter((k) => keys.has(k))
}

export function hasSectionVersionConfigFields(
  snapshot: Record<string, unknown>
): boolean {
  return SECTION_VERSION_SNAPSHOT_CONFIG_KEYS.every((key) =>
    Object.prototype.hasOwnProperty.call(snapshot, key)
  )
}
