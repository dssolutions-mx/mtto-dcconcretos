export const FREQUENCY_LABELS: Record<string, string> = {
  diario: 'Diario',
  semanal: 'Semanal',
  mensual: 'Mensual',
}

export const SPECIAL_SECTION_LABELS: Record<string, string> = {
  operator_punctuality: 'Puntualidad',
  bonus_closure: 'Cierre de bono',
  security_talk: 'Charla de seguridad',
  cleanliness_bonus: 'Limpieza / bono',
  evidence: 'Evidencia',
  tire_readings: 'Lectura de llantas',
}

export function frequencyLabel(frequency: string | null | undefined): string {
  if (!frequency) return 'Sin frecuencia'
  return FREQUENCY_LABELS[frequency] ?? frequency
}

export function collectSpecialSectionTypes(
  sections: Array<{ section_type: string | null }> | null | undefined
): string[] {
  if (!sections?.length) return []
  const seen = new Set<string>()
  const types: string[] = []
  for (const section of sections) {
    const type = section.section_type
    if (!type || type === 'checklist') continue
    if (seen.has(type)) continue
    seen.add(type)
    types.push(type)
  }
  return types
}
