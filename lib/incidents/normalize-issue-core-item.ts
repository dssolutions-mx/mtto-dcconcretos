/**
 * Mirrors SQL `normalize_issue_core_item` for client-side grouping and previews.
 */

/** Checklist template suffixes stripped after the core item label. */
const CHECKLIST_CORE_SUFFIXES: RegExp[] = [
  /\s+EN\s+BUEN\s+ESTADO$/i,
  /\s+FUNCIONANDO$/i,
  /\s+FUNCIONAN$/i,
]

function stripChecklistBoilerplateSuffixes(core: string): string {
  let text = core
  let changed = true
  while (changed) {
    changed = false
    for (const pattern of CHECKLIST_CORE_SUFFIXES) {
      const next = text.replace(pattern, "").trim()
      if (next !== text) {
        text = next
        changed = true
      }
    }
  }
  return text
}

export function normalizeIssueCoreItem(description: string | null | undefined): string {
  if (!description?.trim()) return ""

  let text = description.trim()
  const dashIdx = text.indexOf(" - ")
  if (dashIdx > 0) {
    text = text.slice(0, dashIdx).trim()
  }

  text = text.replace(/\s+/g, " ").trim().toUpperCase()
  return stripChecklistBoilerplateSuffixes(text)
}

export function generateCanonicalIssueKey(
  assetId: string,
  description: string | null | undefined,
): string {
  return `${assetId}_${normalizeIssueCoreItem(description)}`
}
