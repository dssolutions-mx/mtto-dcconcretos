import { isCleanlinessSection } from '@/lib/hr/cleanliness-prefill'

export type TemplateSectionRef = {
  section_type?: string | null
  title?: string | null
  items?: Array<{ id: string }> | null
}

/** Prefer explicit section_type; fall back to legacy title matching. */
export function matchesCleanlinessBonusSection(section: TemplateSectionRef): boolean {
  if (section.section_type === 'cleanliness_bonus') return true
  return isCleanlinessSection(section.title ?? '')
}

export function collectCleanlinessItemIds(sections: TemplateSectionRef[] | null | undefined): string[] {
  if (!sections || !Array.isArray(sections)) return []

  const itemIds: string[] = []
  for (const section of sections) {
    if (!section.items || !Array.isArray(section.items)) continue
    if (!matchesCleanlinessBonusSection(section)) continue
    for (const item of section.items) {
      itemIds.push(item.id)
    }
  }
  return itemIds
}
