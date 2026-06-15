/**
 * Mirrors SQL `normalize_issue_core_item` for client-side grouping and previews.
 */
export function normalizeIssueCoreItem(description: string | null | undefined): string {
  if (!description?.trim()) return ""

  let text = description.trim()
  const dashIdx = text.indexOf(" - ")
  if (dashIdx > 0) {
    text = text.slice(0, dashIdx).trim()
  }

  return text.replace(/\s+/g, " ").trim().toUpperCase()
}

export function generateCanonicalIssueKey(
  assetId: string,
  description: string | null | undefined,
): string {
  return `${assetId}_${normalizeIssueCoreItem(description)}`
}
