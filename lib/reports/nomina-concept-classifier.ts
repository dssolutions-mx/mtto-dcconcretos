/**
 * Canonical payroll concept buckets for nómina cost analysis.
 * Maps manual_financial_adjustments rows (nomina category) into comparable
 * concepts: formal payroll, bonuses, overtime, apoyos, other cash.
 */

export type NominaConceptId =
  | 'nomina_formal'
  | 'tiempo_extra'
  | 'bono'
  | 'apoyo'
  | 'otro_efectivo'

export const NOMINA_CONCEPT_ORDER: NominaConceptId[] = [
  'nomina_formal',
  'bono',
  'tiempo_extra',
  'apoyo',
  'otro_efectivo',
]

export const NOMINA_CONCEPT_LABELS: Record<NominaConceptId, string> = {
  nomina_formal: 'Nómina formal',
  bono: 'Bonos',
  tiempo_extra: 'Tiempo extra',
  apoyo: 'Apoyos',
  otro_efectivo: 'Otros pagos en efectivo',
}

export type NominaConceptInput = {
  is_bonus?: boolean | null
  is_cash_payment?: boolean | null
  subcategory?: string | null
  expense_subcategory?: string | null
  description?: string | null
}

function upper(s: string | null | undefined): string {
  return (s ?? '').trim().toUpperCase()
}

/** Classify a nomina adjustment into a payroll concept bucket. */
export function classifyNominaConcept(adj: NominaConceptInput): NominaConceptId {
  const desc = upper(adj.description)
  const sub = upper(adj.subcategory)
  const expSub = upper(adj.expense_subcategory)

  if (
    adj.is_bonus ||
    expSub.includes('BONO') ||
    sub.includes('BONO') ||
    desc.includes('BONO')
  ) {
    return 'bono'
  }

  if (
    expSub.includes('TIEMPO EXTRA') ||
    sub.includes('TIEMPO EXTRA') ||
    desc.includes('TIEMPO EXTRA')
  ) {
    return 'tiempo_extra'
  }

  if (
    desc.includes('APOYO') ||
    expSub.includes('APOYO') ||
    sub.includes('APOYO')
  ) {
    return 'apoyo'
  }

  if (adj.is_cash_payment) {
    return 'otro_efectivo'
  }

  return 'nomina_formal'
}

export function nominaConceptLabel(id: NominaConceptId): string {
  return NOMINA_CONCEPT_LABELS[id]
}
