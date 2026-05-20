import type {
  DieselOperationalDetails,
  ManttoOperationalDetails,
} from '@/lib/reports/ingresos-gastos-operational-details'

export type OperationalCategory = 'diesel' | 'mantto'
export type ManttoBucket = 'preventive' | 'corrective'

export const OPERATIONAL_KEYS = {
  diesel: 'all-diesel',
  mantto: 'all-mantto',
} as const

export function manttoBucketKey(bucket: ManttoBucket): string {
  return `mantto-${bucket}`
}

export type OperationalDetailsState =
  | DieselOperationalDetails
  | ManttoOperationalDetails
  | null

export function isDieselDetails(
  d: OperationalDetailsState
): d is DieselOperationalDetails {
  return d != null && d.category === 'diesel'
}

export function isManttoDetails(
  d: OperationalDetailsState
): d is ManttoOperationalDetails {
  return d != null && d.category === 'mantto'
}
