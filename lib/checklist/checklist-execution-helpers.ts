/**
 * Equipment meter visibility for checklist execution — avoids forcing horómetro/odómetro
 * when the model is configured as none or unknown.
 */
export type VisibleMeters = "hours" | "kilometers" | "both" | "none"

export function computeVisibleMeters(
  maintenanceUnitRaw: string | null | undefined
): VisibleMeters {
  const u = (maintenanceUnitRaw ?? "").trim().toLowerCase()
  if (!u || u === "none" || u === "n/a" || u === "na" || u === "sin_medidor") {
    return "none"
  }
  if (u === "kilometers" || u === "km" || u === "kilometros" || u === "kilómetros") {
    return "kilometers"
  }
  if (u === "both" || u === "hours_and_kilometers" || u === "hours_kilometers") {
    return "both"
  }
  return "hours"
}

/** Field operators who get simplified auto–work-order flow + operator dashboard redirect */
export function isOperatorChecklistRole(role: string | null | undefined): boolean {
  if (!role) return false
  const r = role.toUpperCase()
  return r === "OPERADOR" || r === "DOSIFICADOR"
}

export function buildCorrectiveDescriptionFromIssues(
  checklistName: string,
  items: Array<{
    description: string
    status: string
    notes?: string
    sectionTitle?: string
  }>
): string {
  const failedItems = items.filter((i) => i.status === "fail")
  const flaggedItems = items.filter((i) => i.status === "flag")

  let desc = `Acción correctiva generada desde checklist: ${checklistName}\n\n`

  if (failedItems.length > 0) {
    desc += `Elementos fallidos (${failedItems.length}):\n`
    failedItems.forEach((item, index) => {
      desc += `${index + 1}. ${item.description}`
      if (item.sectionTitle) desc += ` (${item.sectionTitle})`
      if (item.notes) desc += ` - ${item.notes}`
      desc += "\n"
    })
    desc += "\n"
  }

  if (flaggedItems.length > 0) {
    desc += `Elementos marcados para revisión (${flaggedItems.length}):\n`
    flaggedItems.forEach((item, index) => {
      desc += `${index + 1}. ${item.description}`
      if (item.sectionTitle) desc += ` (${item.sectionTitle})`
      if (item.notes) desc += ` - ${item.notes}`
      desc += "\n"
    })
  }

  return desc.trim()
}
