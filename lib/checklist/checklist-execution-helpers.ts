/**
 * Equipment meter visibility for checklist execution — avoids forcing horómetro/odómetro
 * when the model is configured as none or unknown.
 */
export type VisibleMeters = "hours" | "kilometers" | "both" | "none"

/** Normalize category for comparisons (lowercase, strip accents). */
export function normalizeEquipmentCategory(category: string | null | undefined): string {
  return (category ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

/**
 * Which meters to show on checklist readings.
 * @param modelCategory equipment_models.category — used when DB still says "hours" for mezcladoras/camiones,
 *   and to keep cargadores frontales / generadores on horas solamente.
 */
export function computeVisibleMeters(
  maintenanceUnitRaw: string | null | undefined,
  modelCategory?: string | null
): VisibleMeters {
  const cat = normalizeEquipmentCategory(modelCategory)

  // Cargadores frontales: solo horómetro (sin odómetro en checklist)
  if (cat === "cargador frontal") {
    return "hours"
  }
  // Generadores: solo horas
  if (cat.includes("generador")) {
    return "hours"
  }

  const u = (maintenanceUnitRaw ?? "").trim().toLowerCase()
  if (!u || u === "none" || u === "n/a" || u === "na" || u === "sin_medidor") {
    return "none"
  }
  if (u === "kilometers" || u === "km" || u === "kilometros" || u === "kilómetros") {
    return "kilometers"
  }
  if (
    u === "both" ||
    u === "hours_and_kilometers" ||
    u === "hours_kilometers" ||
    u === "horas_y_kilometros" ||
    u === "horas y kilómetros"
  ) {
    return "both"
  }

  // Mezcladoras y camiones: horómetro + odómetro aunque el modelo legacy diga solo "hours"
  if (cat === "mezcladora de concreto" || cat === "camion") {
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
