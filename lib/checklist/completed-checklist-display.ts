/**
 * Helpers for rendering completed checklist items grouped by template sections.
 * Sections are keyed by id — never collapse duplicate titles (version snapshots
 * may contain multiple sections with the same name).
 */

export type CompletedChecklistSectionLike = {
  id?: string
  title?: string
  order_index?: number
  section_type?: string | null
  checklist_items?: Array<{
    id?: string
    item_id?: string
    description?: string
    order_index?: number
  }>
  items?: Array<{
    id?: string
    item_id?: string
    description?: string
    order_index?: number
  }>
}

export type CompletedChecklistItemLike = {
  item_id: string
  description?: string | null
  section_title?: string | null
}

export function getSectionChecklistItems(
  section: CompletedChecklistSectionLike
): Array<{
  id?: string
  item_id?: string
  description?: string
  order_index?: number
}> {
  return section.checklist_items ?? section.items ?? []
}

export function getEffectiveTemplateItemId(item: {
  id?: string
  item_id?: string
}): string | undefined {
  return item.id ?? item.item_id
}

/** Keep every distinct section id; do not merge sections that share a title. */
export function normalizeCompletedChecklistSections<T extends CompletedChecklistSectionLike>(
  sections: T[] | null | undefined
): T[] {
  const seenIds = new Set<string>()
  const result: T[] = []

  for (const section of sections ?? []) {
    if (!section) continue
    const id = section.id
    if (id) {
      if (seenIds.has(id)) continue
      seenIds.add(id)
    }
    result.push(section)
  }

  return result
}

export function sortSectionsByOrder<T extends CompletedChecklistSectionLike>(
  sections: T[]
): T[] {
  return [...sections].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
  )
}

export function buildItemDescriptionMap(
  sections: CompletedChecklistSectionLike[]
): Map<string, string> {
  const map = new Map<string, string>()

  for (const section of sections) {
    for (const item of getSectionChecklistItems(section)) {
      const desc = item.description?.trim()
      if (!desc) continue
      const id = getEffectiveTemplateItemId(item)
      if (id) map.set(id, desc)
    }
  }

  return map
}

export function resolveCompletedItemDescription(
  itemId: string,
  completedItem: CompletedChecklistItemLike | undefined,
  descriptionMap: Map<string, string>
): string {
  const fromMap = descriptionMap.get(itemId)?.trim()
  if (fromMap) return fromMap

  const fromCompleted = completedItem?.description?.trim()
  if (fromCompleted) return fromCompleted

  return `Item ${itemId.slice(0, 8)}`
}

export type MapCompletedItemsToSectionsInput = {
  sections: CompletedChecklistSectionLike[]
  completedItems: CompletedChecklistItemLike[]
}

export type SectionCompletedItemsGroup = {
  section: CompletedChecklistSectionLike
  items: Array<{
    templateItemId: string
    description: string
    completed: CompletedChecklistItemLike
  }>
}

/** Map completed_items to checklist sections by template item id across all sections. */
export function mapCompletedItemsToChecklistSections(
  input: MapCompletedItemsToSectionsInput
): {
  groups: SectionCompletedItemsGroup[]
  displayedItemIds: Set<string>
  orphanedItems: CompletedChecklistItemLike[]
} {
  const sections = sortSectionsByOrder(
    normalizeCompletedChecklistSections(input.sections)
  )
  const descriptionMap = buildItemDescriptionMap(sections)
  const completionById = new Map(
    input.completedItems
      .filter((item) => item.item_id)
      .map((item) => [item.item_id, item] as const)
  )
  const displayedItemIds = new Set<string>()
  const groups: SectionCompletedItemsGroup[] = []

  for (const section of sections) {
    const checklistSectionTypes = new Set([
      'checklist',
      'cleanliness_bonus',
      undefined,
      null,
    ])
    if (
      section.section_type &&
      !checklistSectionTypes.has(section.section_type)
    ) {
      continue
    }

    const templateItems = getSectionChecklistItems(section)
    const matchedItems = templateItems
      .map((templateItem) => {
        const templateItemId = getEffectiveTemplateItemId(templateItem)
        if (!templateItemId) return null
        const completed = completionById.get(templateItemId)
        if (!completed) return null
        displayedItemIds.add(templateItemId)
        return {
          templateItemId,
          orderIndex: templateItem.order_index ?? 0,
          description: resolveCompletedItemDescription(
            templateItemId,
            completed,
            descriptionMap
          ),
          completed,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(({ templateItemId, description, completed }) => ({
        templateItemId,
        description,
        completed,
      }))

    if (matchedItems.length === 0) continue

    groups.push({ section, items: matchedItems })
  }

  const orphanedItems = input.completedItems.filter(
    (item) => item.item_id && !displayedItemIds.has(item.item_id)
  )

  return { groups, displayedItemIds, orphanedItems }
}

export function countChecklistSectionItems(
  sections: CompletedChecklistSectionLike[],
  securityData?: Record<string, unknown> | null
): number {
  return normalizeCompletedChecklistSections(sections).reduce((total, section) => {
    const securityForSection =
      section.id && securityData ? securityData[section.id] : undefined
    const isSecuritySection =
      section.section_type === 'security_talk' || !!securityForSection

    if (
      section.section_type === 'checklist' ||
      section.section_type === 'cleanliness_bonus' ||
      (!section.section_type && !isSecuritySection)
    ) {
      return total + getSectionChecklistItems(section).length
    }

    return total
  }, 0)
}
